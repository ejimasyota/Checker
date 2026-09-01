/**
 * DOM ユーティリティ / 表示フォーマッタ
 * ============================================================
 * 画面まわりで何度も書きたくなる短い処理をここに集約する。
 */
(() => {
  "use strict";

  /* ========================================================
   *  要素の取得・生成
   * ======================================================== */
  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => [
    ...root.querySelectorAll(selector),
  ];

  /**
   * 要素を1つ作る
   * @param {string} tag
   * @param {object} [props]    className / textContent / dataset / style / その他属性
   * @param {Array}  [children] 子要素または文字列の配列
   */
  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);

    Object.entries(props).forEach(([key, value]) => {
      if (value === null || value === undefined) return;

      if (key === "dataset") {
        Object.assign(node.dataset, value);
      } else if (key === "style") {
        Object.assign(node.style, value);
      } else if (key in node) {
        node[key] = value;
      } else {
        node.setAttribute(key, value);
      }
    });

    children.flat().forEach((child) => {
      if (child === null || child === undefined || child === false) return;
      node.append(child);
    });

    return node;
  }

  /**
   * イベント委譲。子要素を作り直しても購読し直す必要がなくなる。
   * @param {Element} root      監視するコンテナ
   * @param {string}  type      イベント種別
   * @param {string}  selector  反応させたい子要素のセレクタ
   * @param {(event:Event, target:Element) => void} handler
   */
  function delegate(root, type, selector, handler) {
    root.addEventListener(type, (event) => {
      const target = event.target.closest(selector);
      if (target && root.contains(target)) handler(event, target);
    });
  }

  /* ========================================================
   *  数値入力の正規化
   * ======================================================== */

  /** 全角の数字・小数点・マイナスを半角へ直す */
  const toHalfWidth = (text) =>
    String(text ?? "").replace(/[０-９．－]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xfee0)
    );

  /**
   * 入力欄の文字列を数値として読み取る
   * @param {string} raw
   * @param {{min?:number, max?:number, integer?:boolean, fallback?:number}} [rule]
   * @returns {number} 数値にならない場合は fallback（既定 0）
   */
  function parseNumber(raw, rule = {}) {
    const { min = -Infinity, max = Infinity, integer = false, fallback = 0 } = rule;
    const parsed = parseFloat(toHalfWidth(raw));
    if (!Number.isFinite(parsed)) return fallback;

    const bounded = Math.min(max, Math.max(min, parsed));
    return integer ? Math.round(bounded) : bounded;
  }

  /* ========================================================
   *  表示フォーマッタ
   * ======================================================== */

  /** 小数第 digits 位までの文字列にする（末尾の 0 は残す） */
  const num = (value, digits = 1) =>
    Number.isFinite(value) ? value.toFixed(digits) : "-";

  /**
   * 時間(h)を「4時間20分」形式にする
   * @param {number} hours
   */
  function duration(hours) {
    if (!Number.isFinite(hours) || hours <= 0) return "0分";

    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;

    if (h === 0) return `${m}分`;
    if (m === 0) return `${h}時間`;
    return `${h}時間${m}分`;
  }

  /** 日付を "23:10" 形式にする */
  const time = (date) =>
    `${String(date.getHours()).padStart(2, "0")}:${String(
      date.getMinutes()
    ).padStart(2, "0")}`;

  /**
   * 「今日 23:10」「翌 02:40」のように、今日からの日数差込みで時刻を表す
   * @param {Date} date
   * @param {Date} [base] 基準日（省略時は現在）
   */
  function clock(date, base = new Date()) {
    const startOfDay = (d) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayDiff = Math.round(
      (startOfDay(date) - startOfDay(base)) / 86400e3
    );

    if (dayDiff === 0) return `今日 ${time(date)}`;
    if (dayDiff === 1) return `翌 ${time(date)}`;
    return `${date.getMonth() + 1}/${date.getDate()} ${time(date)}`;
  }

  /** 履歴カード用の日時表記 */
  const dateTime = (date) =>
    `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${time(
      date
    )}`;

  window.App = window.App || {};
  window.App.dom = { qs, qsa, el, delegate, toHalfWidth, parseNumber };
  window.App.format = { num, duration, time, clock, dateTime };
})();
