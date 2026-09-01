/**
 * 飲んだお酒の入力ビュー
 * ============================================================
 * プリセットをタップして1杯ずつ積み上げ、行ごとに度数・容量・本数を微調整する。
 *
 * 旧実装からの改善点:
 *   - 「チェックボックス + 本数」の二重管理をやめ、本数だけで表現する
 *   - 要素生成のたびに style を直書きしていたのをやめ、CSS クラスへ寄せる
 *   - 行ごとに listener を張らず、コンテナへのイベント委譲でまとめて捌く
 *   - 数値欄に inputmode を付け、スマホで数字キーボードが出るようにする
 */
(() => {
  "use strict";

  const { qs, qsa, el, delegate, parseNumber } = window.App.dom;
  const { num } = window.App.format;
  const { gramsPerServing } = window.App.bac;
  const PRESETS = window.App.presets;

  /** 入力できる範囲。想定外の値でも計算が破綻しないよう頭を押さえる */
  const LIMITS = {
    abv: { min: 0, max: 100 },
    volMl: { min: 0, max: 5000 },
    count: { min: 0, max: 99, integer: true },
  };

  /** @type {{uid:string, icon:string, name:string, abv:number, volMl:number, count:number}[]} */
  let drinks = [];

  /** 変更を app 側へ知らせるコールバック */
  let notifyChange = () => {};

  let presetGrid;
  let listContainer;

  let uidSeq = 0;
  const nextUid = () => `d${++uidSeq}`;

  /* ========================================================
   *  状態の操作
   * ======================================================== */

  /** プリセットを1杯足す。既にあるものは本数を +1 する */
  function addPreset(presetId) {
    const preset = PRESETS.find((item) => item.id === presetId);
    if (!preset) return;

    const existing = drinks.find((drink) => drink.presetId === presetId);
    if (existing) {
      existing.count = Math.min(LIMITS.count.max, existing.count + 1);
    } else {
      drinks.push({
        uid: nextUid(),
        presetId: preset.id,
        icon: preset.icon,
        name: preset.name,
        abv: preset.abv,
        volMl: preset.volMl,
        count: 1,
      });
    }
    renderAll();
  }

  /** 自由入力の行を足して、品名欄にフォーカスする */
  function addCustom() {
    const drink = {
      uid: nextUid(),
      presetId: null,
      icon: "🍹",
      name: "",
      abv: 5,
      volMl: 350,
      count: 1,
    };
    drinks.push(drink);
    renderAll();

    const nameInput = qs(`[data-uid="${drink.uid}"] [data-field="name"]`, listContainer);
    nameInput?.focus();
  }

  function removeDrink(uid) {
    drinks = drinks.filter((drink) => drink.uid !== uid);
    renderAll();
  }

  const findDrink = (uid) => drinks.find((drink) => drink.uid === uid);

  /* ========================================================
   *  描画
   * ======================================================== */

  function renderPresets() {
    presetGrid.replaceChildren(
      ...PRESETS.map((preset) =>
        el(
          "button",
          {
            type: "button",
            className: "preset",
            dataset: { preset: preset.id },
            title: `${preset.name} ${preset.abv}% / ${preset.volMl}ml`,
          },
          [
            el("span", { className: "preset__icon", textContent: preset.icon }),
            el("span", { className: "preset__name", textContent: preset.name }),
            el("span", {
              className: "preset__meta",
              textContent: `${preset.abv}% ・ ${preset.volMl}ml`,
            }),
            el("span", { className: "preset__count", hidden: true }),
          ]
        )
      )
    );
  }

  /** プリセットボタンに「何杯追加済みか」のバッジを反映する */
  function refreshPresetBadges() {
    qsa(".preset", presetGrid).forEach((button) => {
      const drink = drinks.find((item) => item.presetId === button.dataset.preset);
      const badge = qs(".preset__count", button);
      const count = drink ? drink.count : 0;

      badge.textContent = count;
      badge.hidden = count <= 0;
      button.classList.toggle("is-selected", count > 0);
    });
  }

  /** 1行ぶんの DOM を組み立てる */
  function renderRow(drink) {
    const numberField = (label, field, unit, rule) =>
      el("label", { className: "mini-field" }, [
        el("span", { className: "mini-field__label", textContent: label }),
        el("span", { className: "mini-field__control" }, [
          el("input", {
            type: "text",
            className: "input input--num",
            inputMode: "decimal",
            value: String(drink[field]),
            dataset: { field },
            maxLength: rule.integer ? 2 : 4,
          }),
          el("span", { className: "mini-field__unit", textContent: unit }),
        ]),
      ]);

    return el("article", { className: "drink", dataset: { uid: drink.uid } }, [
      el("div", { className: "drink__head" }, [
        el("span", { className: "drink__icon", textContent: drink.icon }),
        el("input", {
          type: "text",
          className: "input input--name",
          value: drink.name,
          placeholder: "品名を入力",
          dataset: { field: "name" },
          "aria-label": "品名",
        }),
        el("button", {
          type: "button",
          className: "icon-btn icon-btn--sm",
          dataset: { action: "remove" },
          textContent: "✕",
          title: "この行を削除",
          "aria-label": `${drink.name || "この行"}を削除`,
        }),
      ]),

      el("div", { className: "drink__body" }, [
        numberField("度数", "abv", "%", LIMITS.abv),
        numberField("容量", "volMl", "ml", LIMITS.volMl),

        el("div", { className: "stepper" }, [
          el("button", {
            type: "button",
            className: "stepper__btn",
            dataset: { action: "dec" },
            textContent: "−",
            "aria-label": "1杯減らす",
          }),
          el("input", {
            type: "text",
            className: "input stepper__input",
            inputMode: "numeric",
            value: String(drink.count),
            dataset: { field: "count" },
            maxLength: 2,
            "aria-label": "杯数",
          }),
          el("button", {
            type: "button",
            className: "stepper__btn",
            dataset: { action: "inc" },
            textContent: "＋",
            "aria-label": "1杯増やす",
          }),
        ]),
      ]),

      el("p", { className: "drink__grams" }, [
        "純アルコール ",
        el("b", { textContent: num(gramsPerServing(drink) * drink.count, 1) }),
        " g",
      ]),
    ]);
  }

  function renderList() {
    if (drinks.length === 0) {
      listContainer.replaceChildren(
        el("p", {
          className: "empty",
          textContent: "まだ1杯も追加されていません。上のボタンから選んでください。",
        })
      );
      return;
    }

    listContainer.replaceChildren(...drinks.map(renderRow));
  }

  /** 行の再生成をせず、純アルコール量の表示だけ更新する（入力中のフォーカスを守る） */
  function refreshRowGrams(uid) {
    const drink = findDrink(uid);
    const target = qs(`[data-uid="${uid}"] .drink__grams b`, listContainer);
    if (drink && target) {
      target.textContent = num(gramsPerServing(drink) * drink.count, 1);
    }
  }

  function renderAll() {
    renderList();
    refreshPresetBadges();
    notifyChange();
  }

  /* ========================================================
   *  イベント
   * ======================================================== */

  function bindEvents() {
    /* プリセットのタップで1杯追加 */
    delegate(presetGrid, "click", ".preset", (_event, button) => {
      addPreset(button.dataset.preset);
    });

    /* 行内のボタン（削除・増減） */
    delegate(listContainer, "click", "[data-action]", (_event, button) => {
      const uid = button.closest(".drink").dataset.uid;
      const drink = findDrink(uid);
      if (!drink) return;

      switch (button.dataset.action) {
        case "remove":
          removeDrink(uid);
          break;
        case "inc":
          drink.count = Math.min(LIMITS.count.max, drink.count + 1);
          syncCountField(uid, drink.count);
          break;
        case "dec":
          // 0 杯まで減らしたら行ごと消す
          if (drink.count <= 1) {
            removeDrink(uid);
          } else {
            drink.count -= 1;
            syncCountField(uid, drink.count);
          }
          break;
      }
    });

    /* 入力中: 値を状態へ反映（行は作り直さない） */
    delegate(listContainer, "input", "[data-field]", (_event, input) => {
      const uid = input.closest(".drink").dataset.uid;
      const drink = findDrink(uid);
      if (!drink) return;

      const field = input.dataset.field;
      drink[field] =
        field === "name" ? input.value : parseNumber(input.value, LIMITS[field]);

      refreshRowGrams(uid);
      refreshPresetBadges();
      notifyChange();
    });

    /* 入力確定: 全角を直し、上下限に丸めた値を画面へ書き戻す（blur は伝播しないので focusout） */
    delegate(listContainer, "focusout", "[data-field]", (_event, input) => {
      const uid = input.closest(".drink").dataset.uid;
      const drink = findDrink(uid);
      if (!drink || input.dataset.field === "name") return;

      input.value = String(drink[input.dataset.field]);
    });
  }

  /** 増減ボタン操作の結果を画面へ反映する */
  function syncCountField(uid, count) {
    const input = qs(`[data-uid="${uid}"] [data-field="count"]`, listContainer);
    if (input) input.value = String(count);

    refreshRowGrams(uid);
    refreshPresetBadges();
    notifyChange();
  }

  /* ========================================================
   *  公開
   * ======================================================== */
  window.App.views = window.App.views || {};
  window.App.views.drinks = {
    /**
     * @param {{presetGrid:Element, listContainer:Element, onChange:Function}} options
     */
    init(options) {
      presetGrid = options.presetGrid;
      listContainer = options.listContainer;
      notifyChange = options.onChange || (() => {});

      renderPresets();
      bindEvents();
      renderAll();
    },

    addCustom,

    /** 全部消して最初の状態へ戻す */
    reset() {
      drinks = [];
      renderAll();
    },

    /** 計算・保存用のスナップショット */
    getDrinks: () => drinks.map((drink) => ({ ...drink })),

    isEmpty: () => drinks.every((drink) => drink.count <= 0),
  };
})();
