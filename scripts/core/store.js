/**
 * ローカルストレージ入出力
 * ============================================================
 * 保存キーと JSON の読み書きをここに閉じ込める。
 * 画面側は「プロフィール」「履歴」「設定」というデータの形だけを意識すればよい。
 *
 * 旧バージョン(Ver.1.x)のキーからの移行もここで面倒を見る。
 */
(() => {
  "use strict";

  /* 現行キー */
  const KEYS = {
    profile: "Checker.profile",
    history: "Checker.history",
    settings: "Checker.settings",
    migrated: "Checker.migrated",
  };

  /* Ver.1.x のキー（移行元） */
  const LEGACY_KEYS = {
    profile: "UserInfo",
    history: "HistoryInfoStrage",
  };

  /** 履歴の保持上限 */
  const HISTORY_LIMIT = 200;

  const DEFAULT_SETTINGS = { theme: "dark", useProfile: true };

  /* ========================================================
   *  低レベル入出力
   * --------------------------------------------------------
   *  プライベートモードや file:// で開いた場合、localStorage への
   *  アクセス自体が例外になることがある。保存できなくてもアプリは
   *  動き続けてほしいので、ここで全部受け止める。
   * ======================================================== */
  function readRaw(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn(`[store] ${key} の読み込みに失敗しました`, error);
      return null;
    }
  }

  function writeRaw(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn(`[store] ${key} の保存に失敗しました`, error);
      return false;
    }
  }

  function removeRaw(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`[store] ${key} の削除に失敗しました`, error);
    }
  }

  function readJson(key, fallback) {
    const raw = readRaw(key);
    if (!raw) return fallback;

    try {
      const parsed = JSON.parse(raw);
      return parsed === null ? fallback : parsed;
    } catch (error) {
      console.warn(`[store] ${key} の解析に失敗しました`, error);
      return fallback;
    }
  }

  const writeJson = (key, value) => writeRaw(key, JSON.stringify(value));

  /* ========================================================
   *  プロフィール
   * ======================================================== */

  /**
   * 保存済みプロフィールを取得する
   * @returns {object|null} 未登録なら null
   */
  function loadProfile() {
    const profile = readJson(KEYS.profile, null);
    return profile && typeof profile === "object" ? profile : null;
  }

  function saveProfile(profile) {
    return writeJson(KEYS.profile, profile);
  }

  function clearProfile() {
    removeRaw(KEYS.profile);
  }

  /* ========================================================
   *  履歴
   * ======================================================== */

  /** @returns {object[]} 新しい順の履歴配列 */
  function loadHistory() {
    const history = readJson(KEYS.history, []);
    return Array.isArray(history) ? history : [];
  }

  /**
   * 履歴を1件追加する（先頭に積み、上限を超えた分は捨てる）
   * @param {object} record
   */
  function addHistory(record) {
    const history = loadHistory();
    history.unshift(record);
    writeJson(KEYS.history, history.slice(0, HISTORY_LIMIT));
    return history;
  }

  /**
   * 履歴を1件削除する
   * @param {string} id
   */
  function removeHistory(id) {
    const history = loadHistory().filter((record) => record.id !== id);
    writeJson(KEYS.history, history);
    return history;
  }

  function clearHistory() {
    removeRaw(KEYS.history);
  }

  /* ========================================================
   *  設定（テーマなど）
   * ======================================================== */
  function loadSettings() {
    return { ...DEFAULT_SETTINGS, ...readJson(KEYS.settings, {}) };
  }

  function saveSettings(patch) {
    return writeJson(KEYS.settings, { ...loadSettings(), ...patch });
  }

  /* ========================================================
   *  Ver.1.x からのデータ移行
   * ======================================================== */

  /**
   * 旧キーのデータを現行スキーマへ移し替える。
   * 初回のみ実行し、旧データは念のため消さずに残す。
   *
   * 旧プロフィール: {gender, age, btype, weight, weekly}
   * 旧履歴:         {ts, bac, rank, message, CreateDrink:[{type, abv, count, vol}]}
   */
  function migrateLegacyData() {
    if (readRaw(KEYS.migrated)) return;

    const legacyProfile = readJson(LEGACY_KEYS.profile, null);
    if (legacyProfile && !loadProfile()) {
      saveProfile({
        sex: legacyProfile.gender === "female" ? "female" : "male",
        age: Number(legacyProfile.age) || 30,
        // 身長は旧バージョンに存在しないため未設定のまま（古典式にフォールバックする）
        heightCm: null,
        weightKg: Number(legacyProfile.weight) || 60,
        weeklyDays: Number(legacyProfile.weekly) || 0,
      });
    }

    const legacyHistory = readJson(LEGACY_KEYS.history, null);
    if (Array.isArray(legacyHistory) && loadHistory().length === 0) {
      const converted = legacyHistory.map((record, index) => ({
        id: `legacy-${index}-${record.ts || index}`,
        ts: record.ts || new Date().toISOString(),
        bac: Number(record.bac) || 0,
        peakBac: Number(record.bac) || 0,
        grams: null, // 旧履歴は純アルコール量を保持していない
        rank: record.rank || "-",
        stage: "",
        message: record.message || "",
        elapsedHours: 0,
        usedProfile: false,
        legacy: true,
        drinks: (record.CreateDrink || []).map((drink) => ({
          name: drink.type || "不明",
          abv: Number(drink.abv) || 0,
          volMl: Number(drink.vol) || 0,
          count: Number(drink.count) || 0,
        })),
      }));
      writeJson(KEYS.history, converted.slice(0, HISTORY_LIMIT));
    }

    writeRaw(KEYS.migrated, "1");
  }

  /* ========================================================
   *  公開
   * ======================================================== */
  window.App = window.App || {};
  window.App.store = {
    migrateLegacyData,
    loadProfile,
    saveProfile,
    clearProfile,
    loadHistory,
    addHistory,
    removeHistory,
    clearHistory,
    loadSettings,
    saveSettings,
    HISTORY_LIMIT,
  };
})();
