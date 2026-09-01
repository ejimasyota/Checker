/**
 * プロフィール入力ビュー
 * ============================================================
 * 体格と飲酒習慣を預かる画面。入力すると、その場で分配係数 r と
 * 分解速度 β がどう変わるかを見せて、数字の意味が伝わるようにする。
 *
 * 旧実装からの変更点:
 *   - 計算に使えない血液型を廃止し、代わりに身長（Seidl式に必要）を追加
 *   - HTML の onblur 直書きをやめ、この中でイベントを束ねる
 */
(() => {
  "use strict";

  const { qs, el, parseNumber } = window.App.dom;
  const { num } = window.App.format;
  const { distributionRatio, eliminationRate, withDefaults, DEFAULT_PROFILE } =
    window.App.bac;
  const store = window.App.store;

  /** 入力の許容範囲 */
  const LIMITS = {
    age: { min: 0, max: 120, integer: true },
    heightCm: { min: 0, max: 250, integer: true },
    weightKg: { min: 0, max: 250 },
    weeklyDays: { min: 0, max: 7, integer: true },
  };

  let fields;
  let coefficientView;
  let summaryView;
  let notifyChange = () => {};

  /* ========================================================
   *  フォーム ⇄ データ
   * ======================================================== */

  /**
   * 入力欄の内容をプロフィールオブジェクトにする。
   * 空欄は 0 ではなく null（＝未入力）として扱い、計算側で標準値に委ねる。
   */
  function readForm() {
    const readNumber = (input, rule) =>
      input.value.trim() === "" ? null : parseNumber(input.value, rule);

    return {
      sex: qs('input[name="sex"]:checked')?.value || "male",
      age: readNumber(fields.age, LIMITS.age),
      heightCm: readNumber(fields.heightCm, LIMITS.heightCm),
      weightKg: readNumber(fields.weightKg, LIMITS.weightKg),
      weeklyDays: parseNumber(fields.weeklyDays.value, LIMITS.weeklyDays),
    };
  }

  /**
   * プロフィールを入力欄へ流し込む。
   * 未登録のときに標準値を書き込むと「登録済み」に見えてしまうので、空欄のままにする。
   */
  function writeForm(profile) {
    if (!profile) {
      clearForm();
      return;
    }

    qs(`input[name="sex"][value="${profile.sex || "male"}"]`).checked = true;
    fields.age.value = profile.age ?? "";
    fields.heightCm.value = profile.heightCm ?? "";
    fields.weightKg.value = profile.weightKg ?? "";
    fields.weeklyDays.value = profile.weeklyDays ?? DEFAULT_PROFILE.weeklyDays;
  }

  function clearForm() {
    qs('input[name="sex"][value="male"]').checked = true;
    fields.age.value = "";
    fields.heightCm.value = "";
    fields.weightKg.value = "";
    fields.weeklyDays.value = DEFAULT_PROFILE.weeklyDays;
  }

  /* ========================================================
   *  表示の更新
   * ======================================================== */

  /** 入力中の値から係数がどうなるかを見せる（未入力の項目は標準値で補う） */
  function renderCoefficients() {
    const input = readForm();
    const profile = withDefaults(input);
    const ratio = distributionRatio(profile);
    const beta = eliminationRate(profile);

    coefficientView.replaceChildren(
      el("div", { className: "coef" }, [
        el("span", { className: "coef__label", textContent: "分配係数 r" }),
        el("b", { className: "coef__value", textContent: num(ratio.value, 3) }),
        el("span", {
          className: "coef__note",
          textContent:
            ratio.method === "seidl"
              ? "身長・体重から個人推定"
              : "身長未入力のため標準値",
        }),
      ]),
      el("div", { className: "coef" }, [
        el("span", { className: "coef__label", textContent: "分解速度 β" }),
        el("b", {
          className: "coef__value",
          // β は「1時間あたりに下がるBACの％」。単位換算せずそのまま出す
          textContent: `${num(beta, 3)} %/h`,
        }),
        el("span", {
          className: "coef__note",
          textContent: `週${profile.weeklyDays}日の飲酒・${profile.age}歳で補正`,
        }),
      ]),
      el("div", { className: "coef" }, [
        el("span", { className: "coef__label", textContent: "1時間で抜ける量" }),
        el("b", {
          className: "coef__value",
          textContent: `${num(beta * ratio.value * profile.weightKg * 10, 1)} g`,
        }),
        el("span", { className: "coef__note", textContent: "純アルコール換算" }),
      ])
    );

    qs("#WeeklyValue").textContent = `${profile.weeklyDays}日`;
  }

  /** 判定画面のサイドに出す要約 */
  function renderSummary() {
    const profile = store.loadProfile();

    if (!profile) {
      summaryView.replaceChildren(
        el("p", { className: "empty", textContent: "未登録（標準体型で計算します）" })
      );
      return;
    }

    const rows = [
      ["性別", profile.sex === "female" ? "女性" : "男性"],
      ["年齢", `${profile.age}歳`],
      ["身長", profile.heightCm ? `${profile.heightCm}cm` : "未登録"],
      ["体重", `${profile.weightKg}kg`],
      ["週の飲酒", `${profile.weeklyDays}日`],
    ];

    summaryView.replaceChildren(
      el(
        "dl",
        { className: "summary-list" },
        rows.flatMap(([label, value]) => [
          el("dt", { textContent: label }),
          el("dd", { textContent: value }),
        ])
      )
    );
  }

  /* ========================================================
   *  保存・削除
   * ======================================================== */

  function save() {
    const profile = readForm();

    if (!profile.weightKg) {
      window.App.Dialog.alert("体重は必須です。計算の土台になります。");
      fields.weightKg.focus();
      return;
    }

    store.saveProfile(profile);
    writeForm(profile);
    renderSummary();
    renderCoefficients();
    notifyChange();
    window.App.Toast.show("プロフィールを保存しました");
  }

  async function clear() {
    if (!store.loadProfile()) {
      window.App.Dialog.alert("保存されたプロフィールはありません。");
      return;
    }

    const ok = await window.App.Dialog.confirm("プロフィールを削除しますか？", {
      okLabel: "削除する",
      danger: true,
    });
    if (!ok) return;

    store.clearProfile();
    clearForm();
    renderSummary();
    renderCoefficients();
    notifyChange();
    window.App.Toast.show("プロフィールを削除しました", "info");
  }

  /* ========================================================
   *  公開
   * ======================================================== */
  window.App.views = window.App.views || {};
  window.App.views.profile = {
    init(options) {
      fields = {
        age: qs("#AgeInput"),
        heightCm: qs("#HeightInput"),
        weightKg: qs("#WeightInput"),
        weeklyDays: qs("#WeeklyInput"),
      };
      coefficientView = qs("#ProfileCoefficients");
      summaryView = options.summaryView;
      notifyChange = options.onChange || (() => {});

      writeForm(store.loadProfile());
      renderCoefficients();
      renderSummary();

      /* どこを触っても係数プレビューが追従する */
      qs("#ProfileForm").addEventListener("input", renderCoefficients);
      qs("#ProfileForm").addEventListener("submit", (event) => {
        event.preventDefault();
        save();
      });
      qs("#ClearProfileButton").addEventListener("click", clear);
    },

    renderSummary,
  };
})();
