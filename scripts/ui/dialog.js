/**
 * ダイアログ / トースト
 * ============================================================
 * - Dialog.confirm() : 取り返しのつかない操作の確認に使う（Promise<boolean>）
 * - Dialog.alert()   : 入力の不備など、必ず読ませたい通知に使う（Promise<void>）
 * - Toast.show()     : 保存完了など、流れを止めたくない通知に使う
 *
 * 旧実装からの改善点:
 *   - Esc / 背景クリックで閉じられる、Enter で決定できる
 *   - 開いた時にボタンへフォーカスし、閉じたら元の要素へ戻す
 *   - 背景の実装を position:fixed の inset:0 に修正（10000px 指定の撤去）
 */
(() => {
  "use strict";

  const { el } = window.App.dom;

  /** フェードアウトにかける時間(ms)。CSS 側の transition と揃える */
  const FADE_MS = 160;

  /* ========================================================
   *  ダイアログ
   * ======================================================== */

  /**
   * ダイアログを開く共通処理
   * @param {object} options
   * @param {string} options.message  本文
   * @param {Array}  options.buttons  [{label, value, variant, primary}]
   * @returns {Promise<any>} 押されたボタンの value
   */
  function open({ message, buttons }) {
    return new Promise((resolve) => {
      const lastFocused = document.activeElement;

      const backdrop = el("div", { className: "dialog-backdrop" });
      const box = el(
        "div",
        {
          className: "dialog",
          role: "dialog",
          "aria-modal": "true",
        },
        [
          el("p", { className: "dialog__message", textContent: message }),
          el(
            "div",
            { className: "dialog__actions" },
            buttons.map((button) =>
              el("button", {
                type: "button",
                className: `btn btn--${button.variant || "ghost"}`,
                textContent: button.label,
                onclick: () => close(button.value),
              })
            )
          ),
        ]
      );

      /** 後片付け。二重呼び出しされても一度だけ動く */
      let closed = false;
      function close(value) {
        if (closed) return;
        closed = true;

        document.removeEventListener("keydown", onKeyDown);
        backdrop.classList.remove("is-open");
        box.classList.remove("is-open");

        setTimeout(() => {
          backdrop.remove();
          box.remove();
          if (lastFocused instanceof HTMLElement) lastFocused.focus();
        }, FADE_MS);

        resolve(value);
      }

      /** Esc = 打ち消し / Enter = 主ボタン */
      function onKeyDown(event) {
        if (event.key === "Escape") {
          close(buttons.find((b) => !b.primary)?.value ?? false);
        } else if (event.key === "Enter") {
          close(buttons.find((b) => b.primary)?.value ?? true);
        }
      }

      backdrop.addEventListener("click", () =>
        close(buttons.find((b) => !b.primary)?.value ?? false)
      );
      document.addEventListener("keydown", onKeyDown);

      document.body.append(backdrop, box);

      requestAnimationFrame(() => {
        backdrop.classList.add("is-open");
        box.classList.add("is-open");
        box.querySelector(".btn")?.focus();
      });
    });
  }

  const Dialog = {
    /** @returns {Promise<void>} */
    alert(message) {
      return open({
        message,
        buttons: [
          { label: "閉じる", value: undefined, variant: "primary", primary: true },
        ],
      });
    },

    /**
     * @param {string} message
     * @param {{okLabel?:string, cancelLabel?:string, danger?:boolean}} [options]
     * @returns {Promise<boolean>}
     */
    confirm(message, options = {}) {
      return open({
        message,
        buttons: [
          {
            label: options.okLabel || "はい",
            value: true,
            variant: options.danger ? "danger" : "primary",
            primary: true,
          },
          { label: options.cancelLabel || "いいえ", value: false, variant: "ghost" },
        ],
      });
    },
  };

  /* ========================================================
   *  トースト
   * ======================================================== */
  const TOAST_MS = 2600;

  const Toast = {
    /**
     * 画面下に短く出す通知
     * @param {string} message
     * @param {"info"|"success"|"warn"} [type]
     */
    show(message, type = "success") {
      let stack = document.getElementById("ToastStack");
      if (!stack) {
        stack = el("div", {
          id: "ToastStack",
          className: "toast-stack",
          role: "status",
          "aria-live": "polite",
        });
        document.body.append(stack);
      }

      const toast = el("div", {
        className: `toast toast--${type}`,
        textContent: message,
      });
      stack.append(toast);

      requestAnimationFrame(() => toast.classList.add("is-open"));

      setTimeout(() => {
        toast.classList.remove("is-open");
        setTimeout(() => toast.remove(), FADE_MS);
      }, TOAST_MS);
    },
  };

  window.App.Dialog = Dialog;
  window.App.Toast = Toast;
})();
