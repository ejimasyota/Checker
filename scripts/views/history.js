/**
 * 判定履歴ビュー
 * ============================================================
 * 過去の判定をカードで並べる。1件ずつ削除できる点が旧実装との違い。
 */
(() => {
  "use strict";

  const { el, delegate } = window.App.dom;
  const { num, dateTime, duration } = window.App.format;
  const { rankOf } = window.App.bac;
  const store = window.App.store;

  let listContainer;
  let countLabel;

  /* ========================================================
   *  カードの組み立て
   * ======================================================== */

  /** 内訳（何をどれだけ飲んだか） */
  function drinkLines(record) {
    return el(
      "ul",
      { className: "history__drinks" },
      record.drinks.map((drink) =>
        el("li", {}, [
          el("span", { className: "history__drink-name", textContent: drink.name }),
          el("span", {
            className: "history__drink-spec",
            textContent: `${drink.abv}% ・ ${drink.volMl}ml × ${drink.count}`,
          }),
        ])
      )
    );
  }

  function renderCard(record) {
    // 旧バージョンの履歴には tone が無いので、BAC から引き直す
    const tone = record.tone || rankOf(record.bac).tone;
    const timestamp = new Date(record.ts);

    return el("article", { className: "history-card", dataset: { id: record.id } }, [
      el("div", { className: "history-card__head" }, [
        el("span", {
          className: `rank-badge rank-badge--${tone} rank-badge--sm`,
          textContent: record.rank,
        }),
        el("div", { className: "history-card__title" }, [
          el("p", { className: "history-card__bac" }, [
            el("b", { textContent: num(record.bac, 3) }),
            el("span", { textContent: "% BAC" }),
            record.stage
              ? el("span", { className: "history-card__stage", textContent: record.stage })
              : null,
          ]),
          el("p", {
            className: "history-card__meta",
            textContent: [
              dateTime(timestamp),
              record.grams !== null && record.grams !== undefined
                ? `純アルコール ${num(record.grams, 1)}g`
                : null,
              record.elapsedHours ? `経過 ${duration(record.elapsedHours)}` : null,
            ]
              .filter(Boolean)
              .join(" ・ "),
          }),
        ]),
        el("button", {
          type: "button",
          className: "icon-btn icon-btn--sm",
          dataset: { action: "delete" },
          textContent: "✕",
          title: "この履歴を削除",
          "aria-label": "この履歴を削除",
        }),
      ]),

      el("p", { className: "history-card__message", textContent: record.message }),

      record.drinks.length
        ? el("details", { className: "history-card__detail" }, [
            el("summary", { textContent: `飲んだもの（${record.drinks.length}種）` }),
            drinkLines(record),
          ])
        : null,
    ]);
  }

  /* ========================================================
   *  描画
   * ======================================================== */

  function render() {
    const history = store.loadHistory();
    countLabel.textContent = history.length ? `${history.length}件` : "";

    if (history.length === 0) {
      listContainer.replaceChildren(
        el("p", { className: "empty", textContent: "履歴はまだありません。" })
      );
      return;
    }

    listContainer.replaceChildren(...history.map(renderCard));
  }

  /* ========================================================
   *  操作
   * ======================================================== */

  async function clearAll() {
    if (store.loadHistory().length === 0) {
      window.App.Dialog.alert("履歴はまだありません。");
      return;
    }

    const ok = await window.App.Dialog.confirm("履歴をすべて削除しますか？", {
      okLabel: "削除する",
      danger: true,
    });
    if (!ok) return;

    store.clearHistory();
    render();
    window.App.Toast.show("履歴を削除しました", "info");
  }

  window.App.views = window.App.views || {};
  window.App.views.history = {
    init(options) {
      listContainer = options.listContainer;
      countLabel = options.countLabel;

      delegate(listContainer, "click", '[data-action="delete"]', (_event, button) => {
        store.removeHistory(button.closest(".history-card").dataset.id);
        render();
        window.App.Toast.show("1件削除しました", "info");
      });

      options.clearButton.addEventListener("click", clearAll);
      render();
    },

    render,
  };
})();
