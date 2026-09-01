/**
 * 判定結果ビュー
 * ============================================================
 * 推定結果を「ランク → ゲージ → 指標 → 内訳」の順で見せる。
 * 判定ボタンを押さなくても入力に追従して更新される。
 */
(() => {
  "use strict";

  const { el } = window.App.dom;
  const { num, duration, clock } = window.App.format;
  const { DRIVE_LIMIT_BAC, GAUGE_MAX_BAC } = window.App.bac;

  let panel;
  let miniSummary;

  /* ========================================================
   *  部品
   * ======================================================== */

  /**
   * 指標タイル
   * @param {string} label 見出し
   * @param {string} value 主値
   * @param {string} unit  単位（省略可）
   * @param {string} note  補足（省略可）
   */
  function statTile(label, value, unit, note) {
    return el("div", { className: "stat" }, [
      el("dt", { className: "stat__label", textContent: label }),
      el("dd", { className: "stat__value" }, [
        value,
        unit ? el("small", { textContent: unit }) : null,
      ]),
      note ? el("dd", { className: "stat__note", textContent: note }) : null,
    ]);
  }

  /** BACゲージ。酒気帯び基準の位置に目盛りを立てる */
  function gauge(result) {
    const drivePercent = (DRIVE_LIMIT_BAC / GAUGE_MAX_BAC) * 100;

    return el("div", { className: "gauge" }, [
      el("div", { className: "gauge__track" }, [
        el("div", {
          className: `gauge__fill gauge__fill--${result.rank.tone}`,
          style: { width: `${result.gaugeRatio * 100}%` },
        }),
        el("div", {
          className: "gauge__tick",
          style: { left: `${drivePercent}%` },
          title: "酒気帯び運転の基準 (0.03%)",
        }),
      ]),
      /* 左端の「0」は運転基準のラベルと重なるので置かない */
      el("div", { className: "gauge__scale" }, [
        el("span", {
          className: "gauge__scale-mark",
          style: { left: `${drivePercent}%` },
          textContent: "0.03 運転基準",
        }),
        el("span", { className: "gauge__scale-max", textContent: `${GAUGE_MAX_BAC}%〜` }),
      ]),
    ]);
  }

  /** 計算の内訳（何をどう使ったのかを開いて確認できるように） */
  function breakdown(result, profileUsed) {
    const rows = [
      ["純アルコール量 A", `${num(result.grams, 1)} g`],
      ["分配係数 r", `${num(result.r, 3)}（${result.rMethod === "seidl" ? "Seidl式で個人推定" : "標準値"}）`],
      ["分解速度 β", `${num(result.beta * 1000, 1)} × 10⁻³ %/h`],
      ["経過時間 t", duration(result.elapsedHours)],
      ["ピークBAC", `${num(result.peakBac, 3)} %`],
      ["分解された量", `${num(result.peakBac - result.bac, 3)} %`],
      ["使用プロフィール", profileUsed ? "登録内容" : "標準体型（男性 60kg）"],
    ];

    return el("details", { className: "breakdown" }, [
      el("summary", { textContent: "計算の内訳を見る" }),
      el(
        "dl",
        { className: "breakdown__list" },
        rows.flatMap(([label, value]) => [
          el("dt", { textContent: label }),
          el("dd", { textContent: value }),
        ])
      ),
    ]);
  }

  /* ========================================================
   *  描画
   * ======================================================== */

  /** 1杯も入力されていないときの表示 */
  function renderEmpty() {
    panel.replaceChildren(
      el("div", { className: "result result--empty" }, [
        el("div", { className: "result__placeholder-icon", textContent: "🍻" }),
        el("p", {
          className: "empty",
          textContent: "お酒を追加すると、ここに推定結果がリアルタイムで出ます。",
        }),
      ])
    );
    updateMini(null);
  }

  /**
   * 結果を描画する
   * @param {object} result   App.bac.estimate() の戻り値
   * @param {boolean} profileUsed プロフィールを使ったか
   */
  function render(result, profileUsed) {
    const { rank, guideline } = result;

    panel.replaceChildren(
      el("div", { className: `result result--${rank.tone}` }, [
        /* ランクと現在値 */
        el("div", { className: "result__head" }, [
          el("div", {
            className: `rank-badge rank-badge--${rank.tone}`,
            textContent: rank.key,
          }),
          el("div", { className: "result__headline" }, [
            el("p", { className: "result__stage", textContent: rank.stage }),
            el("p", { className: "result__bac" }, [
              el("b", { textContent: num(result.bac, 3) }),
              el("span", { textContent: "% 推定BAC" }),
            ]),
          ]),
        ]),

        gauge(result),

        el("p", { className: "result__message", textContent: rank.message }),

        /* 主要指標 */
        el("dl", { className: "stats" }, [
          statTile(
            "純アルコール量",
            num(result.grams, 1),
            "g",
            `適量20gの ${num(guideline.units, 1)} 杯分`
          ),
          statTile(
            "ピークBAC",
            num(result.peakBac, 3),
            "%",
            "全量が吸収された時点の最大値"
          ),
          statTile(
            "シラフに戻る",
            clock(result.soberAt),
            null,
            `あと ${duration(result.hoursToSober)}`
          ),
          statTile(
            "運転基準を下回る",
            result.hoursToDrive > 0 ? clock(result.driveAt) : "基準以下",
            null,
            result.hoursToDrive > 0
              ? `あと ${duration(result.hoursToDrive)}`
              : "それでも運転はしないこと"
          ),
          statTile(
            "厚労省基準比",
            num(guideline.riskRatio, 0),
            "%",
            `基準は ${guideline.riskDailyG}g/日`
          ),
          statTile(
            "この量を週に続けると",
            num(guideline.weeklyG, 0),
            "g",
            "週の飲酒日数ぶんの合計"
          ),
        ]),

        breakdown(result, profileUsed),
      ])
    );

    updateMini(result);
  }

  /** スマホ用の固定サマリーバー */
  function updateMini(result) {
    if (!miniSummary) return;

    if (!result || result.grams <= 0) {
      miniSummary.hidden = true;
      return;
    }

    miniSummary.hidden = false;
    miniSummary.replaceChildren(
      el("span", {
        className: `rank-badge rank-badge--${result.rank.tone} rank-badge--sm`,
        textContent: result.rank.key,
      }),
      el("span", { className: "mini-summary__main" }, [
        el("b", { textContent: num(result.bac, 3) }),
        el("span", { textContent: "% BAC" }),
      ]),
      el("span", {
        className: "mini-summary__sub",
        textContent: `純アルコール ${num(result.grams, 1)}g`,
      })
    );
  }

  window.App.views = window.App.views || {};
  window.App.views.result = {
    init(options) {
      panel = options.panel;
      miniSummary = options.miniSummary;

      /* サマリーバーをタップしたら結果パネルまでスクロールする */
      miniSummary?.addEventListener("click", () => {
        panel.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    },
    render,
    renderEmpty,
  };
})();
