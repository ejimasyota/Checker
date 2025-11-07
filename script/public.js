class DialogInfo {
  constructor() {
    this.fadeDuration = 150;
  }

  /* 基本のダイアログ要素を生成 */
  createDialogBase(message = "") {
    // 背景（バックドロップ）
    const backdrop = document.createElement("div");
    backdrop.className = "dialogBackdrop";

    // ダイアログ本体
    const container = document.createElement("div");
    container.className = "dialogContainer";
    container.setAttribute("role", "dialog");
    container.setAttribute("aria-modal", "true");

    // メッセージ部分
    const msg = document.createElement("p");
    msg.className = "dialogMessage";
    msg.textContent = message;

    container.appendChild(msg);
    document.body.append(backdrop, container);

    // フェードイン
    requestAnimationFrame(() => {
      backdrop.classList.add("fadeIn");
      container.classList.add("fadeIn");
    });

    return { container, backdrop, msg };
  }

  /* アラート表示 */
  ShowDialog(message = "") {
    return new Promise((resolve) => {
      const { container, backdrop } = this.createDialogBase(message);

      const btnWrap = document.createElement("div");
      btnWrap.className = "ButtonContainer";
      const closeBtn = document.createElement("button");
      closeBtn.textContent = "閉じる";
      closeBtn.classList.add("Button");

      btnWrap.appendChild(closeBtn);
      container.appendChild(btnWrap);

      closeBtn.onclick = () => {
        this.closeDialog(container, backdrop);
        resolve();
      };
    });
  }

  /* コンファーム表示 */
  ShowConfirmDialog(message = "") {
    return new Promise((resolve) => {
      const { container, backdrop } = this.createDialogBase(message);

      const btnWrap = document.createElement("div");
      btnWrap.className = "ButtonContainer";

      const yesBtn = document.createElement("button");
      yesBtn.textContent = "はい";
      yesBtn.classList.add("Button");
      yesBtn.style.background = "var(--accent)";
      yesBtn.style.color = "#07203a";

      const noBtn = document.createElement("button");
      noBtn.textContent = "いいえ";
      noBtn.classList.add("Button");
      noBtn.style.background = "transparent";
      noBtn.style.border = "1px solid rgba(255,255,255,0.1)";
      noBtn.style.color = "var(--muted)";

      btnWrap.append(yesBtn, noBtn);
      container.appendChild(btnWrap);

      yesBtn.onclick = () => {
        this.closeDialog(container, backdrop);
        resolve(true);
      };
      noBtn.onclick = () => {
        this.closeDialog(container, backdrop);
        resolve(false);
      };
    });
  }

  /* 閉じる共通処理（アニメ付き） */
  closeDialog(container, backdrop) {
    container.classList.remove("fadeIn");
    backdrop.classList.remove("fadeIn");
    container.classList.add("fadeOut");
    backdrop.classList.add("fadeOut");

    setTimeout(() => {
      container.remove();
      backdrop.remove();
    }, this.fadeDuration);
  }
}

/* クラス公開 */
window.DialogInfo = DialogInfo;
