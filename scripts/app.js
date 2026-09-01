/**
 * アプリケーション本体
 * ============================================================
 * 各ビューを繋ぎ、状態が変わるたびに再計算して結果を配る司令塔。
 *
 * 画面の流れ:
 *   入力が変わる → recalculate() → 推定 → 結果ビューへ反映
 *   「履歴に残す」を押したときだけ localStorage へ記録する
 */
(() => {
  "use strict";

  const { qs, qsa, el } = window.App.dom;
  const { duration } = window.App.format;
  const { estimate } = window.App.bac;
  const store = window.App.store;
  const views = window.App.views;

  /** 経過時間の上限(h)。日をまたいだ入力ミスで極端な値にならないように */
  const MAX_ELAPSED_HOURS = 24;

  /** 現在値の再計算間隔(ms)。放置しても表示が古くならないようにする */
  const REFRESH_INTERVAL_MS = 60_000;

  /** @type {{startTime:Date, useProfile:boolean, lastResult:object|null}} */
  const state = {
    startTime: new Date(),
    useProfile: true,
    lastResult: null,
  };

  /* ========================================================
   *  画面切り替え（タブ）
   * ======================================================== */
  function showView(name) {
    qsa(".view").forEach((view) => {
      view.classList.toggle("is-active", view.id === `view-${name}`);
    });

    qsa(".tab").forEach((tab) => {
      const active = tab.dataset.view === name;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ========================================================
   *  テーマ
   * ======================================================== */
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    qs("#ThemeToggleButton").textContent = theme === "dark" ? "☀️" : "🌙";
    qs("#ThemeToggleButton").title =
      theme === "dark" ? "ライトテーマに切り替え" : "ダークテーマに切り替え";
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    store.saveSettings({ theme: next });
  }

  /* ========================================================
   *  飲み始めた時刻
   * ======================================================== */

  /** 入力欄("HH:MM")を、今より過去の日時として解釈する */
  function readStartTime() {
    const [hour, minute] = qs("#StartTimeInput").value.split(":").map(Number);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return new Date();

    const now = new Date();
    const start = new Date(now);
    start.setHours(hour, minute, 0, 0);

    // 未来の時刻なら「昨日のその時間」とみなす（深夜に日をまたいだ場合）
    if (start > now) start.setDate(start.getDate() - 1);

    return start;
  }

  function writeStartTime(date) {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    qs("#StartTimeInput").value = `${hh}:${mm}`;
  }

  /** 飲み始めからの経過時間(h) */
  function elapsedHours() {
    const hours = (Date.now() - state.startTime.getTime()) / 3600e3;
    return Math.min(MAX_ELAPSED_HOURS, Math.max(0, hours));
  }

  /* ========================================================
   *  再計算
   * ======================================================== */
  function recalculate() {
    const drinks = views.drinks
      .getDrinks()
      .filter((drink) => drink.count > 0 && drink.volMl > 0 && drink.abv > 0);

    if (drinks.length === 0) {
      state.lastResult = null;
      views.result.renderEmpty();
      updateElapsedHint(null);
      qs("#SaveResultButton").disabled = true;
      return;
    }

    const profile = state.useProfile ? store.loadProfile() : null;
    const result = estimate({
      drinks,
      profile,
      elapsedHours: elapsedHours(),
    });

    state.lastResult = { result, drinks, profileUsed: Boolean(profile) };
    views.result.render(result, Boolean(profile));
    updateElapsedHint(result);
    qs("#SaveResultButton").disabled = false;
  }

  /** 経過時間の説明文。分解された量を添えて、時刻入力の意味を伝える */
  function updateElapsedHint(result) {
    const hours = elapsedHours();
    const hint = qs("#ElapsedHint");

    if (hours <= 0) {
      hint.textContent = "たった今飲み終えた前提で計算します。";
      return;
    }

    const decomposed = result
      ? `（その間に BAC ${(result.peakBac - result.bac).toFixed(3)}% ぶん分解されました）`
      : "";
    hint.textContent = `飲み始めから ${duration(hours)} 経過${decomposed}`;
  }

  /* ========================================================
   *  履歴への保存
   * ======================================================== */
  function saveResult() {
    if (!state.lastResult) return;

    const { result, drinks, profileUsed } = state.lastResult;

    store.addHistory({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: new Date().toISOString(),
      bac: Number(result.bac.toFixed(4)),
      peakBac: Number(result.peakBac.toFixed(4)),
      grams: Number(result.grams.toFixed(1)),
      rank: result.rank.key,
      stage: result.rank.stage,
      tone: result.rank.tone,
      message: result.rank.message,
      elapsedHours: Number(result.elapsedHours.toFixed(2)),
      usedProfile: profileUsed,
      drinks: drinks.map((drink) => ({
        name: drink.name || "自由入力",
        abv: drink.abv,
        volMl: drink.volMl,
        count: drink.count,
      })),
    });

    views.history.render();
    window.App.Toast.show("履歴に記録しました");
  }

  /* ========================================================
   *  イベント配線
   * ======================================================== */
  function bindEvents() {
    /* タブ */
    qsa(".tab").forEach((tab) => {
      tab.addEventListener("click", () => showView(tab.dataset.view));
    });

    qs("#ThemeToggleButton").addEventListener("click", toggleTheme);

    /* 飲み始めた時刻 */
    qs("#StartTimeInput").addEventListener("change", () => {
      state.startTime = readStartTime();
      recalculate();
    });

    qsa("#ElapsedChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const minutesAgo = Number(chip.dataset.minutes);
        state.startTime = new Date(Date.now() - minutesAgo * 60_000);
        writeStartTime(state.startTime);
        recalculate();
      });
    });

    /* プロフィールを使うかどうか */
    qs("#UseProfileCheck").addEventListener("change", (event) => {
      state.useProfile = event.target.checked;
      store.saveSettings({ useProfile: state.useProfile });
      updateProfileHint();
      recalculate();
    });

    /* ドリンク操作 */
    qs("#AddCustomButton").addEventListener("click", () => views.drinks.addCustom());

    qs("#ResetDrinksButton").addEventListener("click", async () => {
      if (views.drinks.getDrinks().length === 0) return;

      const ok = await window.App.Dialog.confirm("追加したお酒をすべて消しますか？", {
        okLabel: "消す",
        danger: true,
      });
      if (ok) views.drinks.reset();
    });

    qs("#SaveResultButton").addEventListener("click", saveResult);

    /* プロフィール未登録のまま判定しようとしたときの導線 */
    qs("#ProfileHint").addEventListener("click", (event) => {
      if (event.target.closest("[data-goto-profile]")) showView("profile");
    });
  }

  /** プロフィールの有無に応じて、判定画面の注記を出し分ける */
  function updateProfileHint() {
    const hint = qs("#ProfileHint");
    const profile = store.loadProfile();

    if (!state.useProfile) {
      hint.replaceChildren("標準体型（男性 60kg）で計算します。");
      return;
    }

    if (!profile) {
      hint.replaceChildren(
        "プロフィールが未登録のため標準体型で計算します。",
        el("button", {
          type: "button",
          className: "link-btn",
          dataset: { gotoProfile: "1" },
          textContent: "今すぐ登録する",
        })
      );
      return;
    }

    hint.replaceChildren(
      `登録した体格で計算します（${profile.sex === "female" ? "女性" : "男性"} ${
        profile.weightKg
      }kg${profile.heightCm ? ` / ${profile.heightCm}cm` : ""}）。`
    );
  }

  /* ========================================================
   *  起動
   * ======================================================== */
  function init() {
    store.migrateLegacyData();

    const settings = store.loadSettings();
    applyTheme(settings.theme);

    state.useProfile = settings.useProfile;
    qs("#UseProfileCheck").checked = state.useProfile;

    state.startTime = new Date();
    writeStartTime(state.startTime);

    views.result.init({
      panel: qs("#ResultPanel"),
      miniSummary: qs("#MiniSummary"),
    });

    views.drinks.init({
      presetGrid: qs("#PresetGrid"),
      listContainer: qs("#DrinkList"),
      onChange: recalculate,
    });

    views.profile.init({
      summaryView: qs("#ProfileSummary"),
      onChange: () => {
        updateProfileHint();
        recalculate();
      },
    });

    views.history.init({
      listContainer: qs("#HistoryList"),
      countLabel: qs("#HistoryCount"),
      clearButton: qs("#ClearHistoryButton"),
    });

    bindEvents();
    updateProfileHint();
    showView("judge");
    recalculate();

    // 時間が経てば BAC は下がる。開きっぱなしでも表示を追従させる
    setInterval(recalculate, REFRESH_INTERVAL_MS);
  }

  /* 読み込みが済んだ後にこのファイルが評価された場合でも起動できるようにする */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
