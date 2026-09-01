/**
 * 血中アルコール濃度(BAC)推定エンジン
 * ============================================================
 * 画面には一切依存しない純粋な計算モジュール。
 *
 * 【基本式】改良ウィドマーク式 + ゼロ次消失
 *
 *     BAC(%) = A / (r × W) × 100 − β × t
 *
 *     A : 摂取した純アルコール量(g)  = Σ 容量(ml) × 本数 × 度数(%) / 100 × 0.789
 *     W : 体重(g)
 *     r : 体内水分の分配係数         → Seidl式で身長・体重・性別から個人化
 *     β : アルコール分解速度(%/h)    → 性別・飲酒頻度・年齢で補正
 *     t : 飲み始めからの経過時間(h)
 *
 * 【旧実装からの変更点】
 *   - 根拠不明の吸収率 0.7 を廃止（ウィドマーク式に元々含まれない係数だった）
 *   - r を固定値(男0.68/女0.55)から Seidl式による個人推定へ
 *   - 経過時間による分解を導入し「現在値」と「ピーク値」を分けて算出
 *   - 未使用だった年齢・週の飲酒日数を β の補正に反映
 *
 * 【出典】
 *   Seidl S. et al. (2000) Int J Legal Med 114:71-77 (分配係数 r の推定式)
 *   道路交通法施行令 第44条の3（酒気帯び = 呼気0.15mg/L ≒ 血中0.03%）
 *   厚生労働省「健康に配慮した飲酒に関するガイドライン」(2024)
 */
(() => {
  "use strict";

  /* ========================================================
   *  定数
   * ======================================================== */
  /** エタノールの比重 (g/ml) */
  const ETHANOL_DENSITY = 0.789;

  /** 酒気帯び運転の基準に相当する血中濃度(%)。呼気0.15mg/L × 血液呼気比2100 ≒ 0.03% */
  const DRIVE_LIMIT_BAC = 0.03;

  /** 分解速度の基準値(%/h)。男性 0.015 / 女性 0.017 が一般的な報告値 */
  const BASE_BETA = { male: 0.015, female: 0.017 };

  /** 分解速度の下限・上限(%/h)。個人差の報告範囲に収める */
  const BETA_RANGE = { min: 0.01, max: 0.025 };

  /** 分配係数の下限・上限。Seidl式が極端な体格で破綻するのを防ぐ */
  const R_RANGE = { min: 0.4, max: 0.9 };

  /** 身長が未登録のときに使う古典的ウィドマーク係数 */
  const CLASSIC_R = { male: 0.68, female: 0.55 };

  /** 厚労省ガイドラインの「生活習慣病リスクを高める」1日あたり純アルコール量(g) */
  const RISK_DAILY_G = { male: 40, female: 20 };

  /** 「節度ある適度な飲酒」の目安(g/日)。1単位表示にも使う */
  const MODERATE_DAILY_G = 20;

  /** ゲージ表示の上限BAC(%)。これを超えたら振り切れ扱い */
  const GAUGE_MAX_BAC = 0.4;

  /**
   * プロフィール未登録時に使う標準体型。
   * 身長だけは「不明」を意味する null にしておき、勝手な体格を仮定せず
   * 古典的ウィドマーク係数へフォールバックさせる。
   */
  const DEFAULT_PROFILE = Object.freeze({
    sex: "male",
    age: 30,
    heightCm: null,
    weightKg: 60,
    weeklyDays: 2,
  });

  /* ========================================================
   *  酩酊ランク定義（上限BAC%の昇順）
   * ======================================================== */
  const RANKS = [
    {
      key: "G",
      max: 0.02,
      stage: "シラフ",
      tone: "calm",
      message: "ほぼシラフです。飲みましょう。",
    },
    {
      key: "F",
      max: 0.04,
      stage: "爽快期",
      tone: "calm",
      message: "少し酔った程度です。飲みましょう。",
    },
    {
      key: "E",
      max: 0.06,
      stage: "爽快期",
      tone: "good",
      message:
        "軽度の酩酊状態です。気分が高揚し、判断が少し鈍ります。まだ飲みましょう。",
    },
    {
      key: "D",
      max: 0.1,
      stage: "ほろ酔い期",
      tone: "good",
      message:
        "中等度の酩酊状態です。声が大きくなり、抑制が低下します。まだいけます。",
    },
    {
      key: "C",
      max: 0.13,
      stage: "ほろ酔い期",
      tone: "warn",
      message:
        "完全に酔っています。バランス感覚の低下や誤判断が見られます。正直まだいけます。",
    },
    {
      key: "B",
      max: 0.16,
      stage: "酩酊初期",
      tone: "warn",
      message: "高度の酩酊状態です。二次会には顔だけ出しましょう。",
    },
    {
      key: "A",
      max: 0.2,
      stage: "酩酊期",
      tone: "hot",
      message: "危険な状態です。無理せず飲みましょう。",
    },
    {
      key: "S",
      max: 0.25,
      stage: "酩酊期",
      tone: "hot",
      message: "昏睡寸前の状態です。三次会は厳しいかもしれません。",
    },
    {
      key: "SS",
      max: 0.31,
      stage: "酩酊期",
      tone: "danger",
      message: "非常に危険な状態です。車の運転はしない方が無難かもしれません。",
    },
    {
      key: "SSS",
      max: 0.4,
      stage: "泥酔期",
      tone: "danger",
      message: "極めて危険な状態です。SNSリテラシーが危険値に達しています。",
    },
    {
      key: "💀",
      max: Infinity,
      stage: "昏睡期",
      tone: "danger",
      message: "ブラウザを閉じて遺族となる方々に連絡してください。",
    },
  ];

  /* ========================================================
   *  小さなヘルパ
   * ======================================================== */
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  /**
   * 未入力の項目を標準値で埋めたプロフィールを返す
   * （未入力は null / undefined / 空文字で表される）
   * @param {object} [profile]
   */
  function withDefaults(profile) {
    const given = Object.entries(profile || {}).filter(
      ([, value]) => value !== null && value !== undefined && value !== ""
    );
    return { ...DEFAULT_PROFILE, ...Object.fromEntries(given) };
  }

  /* ========================================================
   *  各要素の計算
   * ======================================================== */

  /**
   * 1杯（1本）あたりの純アルコール量(g)を求める
   * @param {{abv:number, volMl:number}} drink
   */
  function gramsPerServing(drink) {
    const abv = clamp(toNumber(drink.abv), 0, 100);
    const volMl = Math.max(0, toNumber(drink.volMl));
    return volMl * (abv / 100) * ETHANOL_DENSITY;
  }

  /**
   * ドリンク配列の合計純アルコール量(g)を求める
   * @param {{abv:number, volMl:number, count:number}[]} drinks
   */
  function totalGrams(drinks) {
    return (drinks || []).reduce((sum, drink) => {
      const count = Math.max(0, toNumber(drink.count));
      return sum + gramsPerServing(drink) * count;
    }, 0);
  }

  /**
   * 分配係数 r を求める
   *
   * 身長が登録されていれば Seidl式で個人化し、無ければ古典的な固定値を使う。
   *   男性: r = 0.31608 − 0.004821 × W + 0.4632 × H
   *   女性: r = 0.31223 − 0.006446 × W + 0.4466 × H
   *   （W: 体重kg / H: 身長m）
   *
   * @param {{sex:string, heightCm:number, weightKg:number}} profile
   * @returns {{value:number, method:"seidl"|"classic"}}
   */
  function distributionRatio(profile) {
    const isFemale = profile.sex === "female";
    const weightKg = toNumber(profile.weightKg);
    const heightM = toNumber(profile.heightCm) / 100;

    // 身長・体重が現実的な範囲に無い場合は古典式へフォールバック
    const inRange =
      heightM >= 1.2 && heightM <= 2.3 && weightKg >= 25 && weightKg <= 250;
    if (!inRange) {
      return {
        value: isFemale ? CLASSIC_R.female : CLASSIC_R.male,
        method: "classic",
      };
    }

    const raw = isFemale
      ? 0.31223 - 0.006446 * weightKg + 0.4466 * heightM
      : 0.31608 - 0.004821 * weightKg + 0.4632 * heightM;

    return { value: clamp(raw, R_RANGE.min, R_RANGE.max), method: "seidl" };
  }

  /**
   * アルコール分解速度 β(%/h) を求める
   *
   *   基準値(性別) × 年齢補正 + 飲酒頻度補正
   *   - 飲酒頻度: 常習的に飲むほど代謝酵素が誘導され速くなる（週7日で +0.004）
   *   - 年齢    : 40歳を超えると肝機能の低下で緩やかに遅くなる（下限 -15%）
   *
   * @param {{sex:string, age:number, weeklyDays:number}} profile
   */
  function eliminationRate(profile) {
    const base = profile.sex === "female" ? BASE_BETA.female : BASE_BETA.male;

    const weeklyDays = clamp(toNumber(profile.weeklyDays), 0, 7);
    const habitBonus = (weeklyDays / 7) * 0.004;

    const age = clamp(toNumber(profile.age, 30), 0, 120);
    const ageFactor = age > 40 ? clamp(1 - (age - 40) * 0.0025, 0.85, 1) : 1;

    return clamp(base * ageFactor + habitBonus, BETA_RANGE.min, BETA_RANGE.max);
  }

  /**
   * BAC値から酩酊ランクを判定する
   * @param {number} bac 血中アルコール濃度(%)
   */
  function rankOf(bac) {
    return RANKS.find((rank) => bac < rank.max) || RANKS[RANKS.length - 1];
  }

  /**
   * 厚労省ガイドラインとの比較情報を作る
   * @param {number} grams 今回の純アルコール量(g)
   * @param {{sex:string, weeklyDays:number}} profile
   */
  function guidelineCompare(grams, profile) {
    const riskDailyG =
      profile.sex === "female" ? RISK_DAILY_G.female : RISK_DAILY_G.male;
    const weeklyDays = clamp(toNumber(profile.weeklyDays), 0, 7);

    return {
      /** 生活習慣病リスクが高まる1日量(g) */
      riskDailyG,
      /** 今回の量がその基準の何%にあたるか */
      riskRatio: (grams / riskDailyG) * 100,
      /** 「適度な飲酒」20g を1単位としたドリンク数 */
      units: grams / MODERATE_DAILY_G,
      /** このペースを週の飲酒日数ぶん続けた場合の週間量(g) */
      weeklyG: grams * weeklyDays,
    };
  }

  /* ========================================================
   *  メイン: 推定処理
   * ======================================================== */

  /**
   * 飲酒内容とプロフィールから酩酊状態を推定する
   *
   * @param {object} input
   * @param {Array}  input.drinks           ドリンク配列 {name, abv, volMl, count}
   * @param {object} [input.profile]        プロフィール（未指定なら標準体型）
   * @param {number} [input.elapsedHours=0] 飲み始めからの経過時間(h)
   * @param {Date}   [input.now]            基準時刻（テスト用に差し替え可能）
   * @returns {object} 推定結果
   */
  function estimate(input) {
    const profile = withDefaults(input.profile);
    const now = input.now instanceof Date ? input.now : new Date();
    const elapsedHours = Math.max(0, toNumber(input.elapsedHours));

    const grams = totalGrams(input.drinks);
    const ratio = distributionRatio(profile);
    const beta = eliminationRate(profile);

    // 体重が未入力・非現実的な値なら標準体重で計算する（0除算と桁違いの結果を防ぐ）
    const weightKg = toNumber(profile.weightKg);
    const weightG =
      (weightKg >= 25 && weightKg <= 250 ? weightKg : DEFAULT_PROFILE.weightKg) *
      1000;

    // 全量が吸収され切ったときの最大値
    const peakBac = (grams / (ratio.value * weightG)) * 100;
    // 経過時間ぶんを肝臓が分解した後の「現在値」
    const bac = Math.max(0, peakBac - beta * elapsedHours);

    // 完全に抜けるまで / 酒気帯び基準を下回るまでの時間(h)
    const hoursToSober = bac / beta;
    const hoursToDrive =
      bac > DRIVE_LIMIT_BAC ? (bac - DRIVE_LIMIT_BAC) / beta : 0;

    return {
      grams,
      peakBac,
      bac,
      elapsedHours,
      /** 分配係数と、その推定に使った方法 */
      r: ratio.value,
      rMethod: ratio.method,
      /** 分解速度(%/h) */
      beta,
      hoursToSober,
      hoursToDrive,
      soberAt: new Date(now.getTime() + hoursToSober * 3600e3),
      driveAt: new Date(now.getTime() + hoursToDrive * 3600e3),
      rank: rankOf(bac),
      guideline: guidelineCompare(grams, profile),
      /** ゲージ描画用の 0〜1 の割合 */
      gaugeRatio: clamp(bac / GAUGE_MAX_BAC, 0, 1),
    };
  }

  /* ========================================================
   *  公開
   * ======================================================== */
  window.App = window.App || {};
  window.App.bac = {
    estimate,
    withDefaults,
    rankOf,
    gramsPerServing,
    totalGrams,
    distributionRatio,
    eliminationRate,
    RANKS,
    DEFAULT_PROFILE,
    DRIVE_LIMIT_BAC,
    MODERATE_DAILY_G,
    GAUGE_MAX_BAC,
  };
})();
