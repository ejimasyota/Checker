/**
 * ドリンクプリセット定義
 * ------------------------------------------------------------
 * 画面から「タップで1杯追加」できる定番ドリンクのカタログ。
 * abv   : アルコール度数(%)
 * volMl : 1杯（1本）あたりの容量(ml)
 */
(() => {
  "use strict";

  /** @type {{id:string, icon:string, name:string, abv:number, volMl:number}[]} */
  const DRINK_PRESETS = [
    { id: "beer-mug", icon: "🍺", name: "生ビール(中)", abv: 5, volMl: 435 },
    { id: "beer-350", icon: "🍺", name: "ビール(缶350)", abv: 5, volMl: 350 },
    { id: "beer-500", icon: "🍺", name: "ビール(缶500)", abv: 5, volMl: 500 },
    { id: "chuhai-350", icon: "🍋", name: "チューハイ(缶350)", abv: 7, volMl: 350 },
    { id: "strong-500", icon: "⚡", name: "ストロング系(缶500)", abv: 9, volMl: 500 },
    { id: "highball", icon: "🥃", name: "ハイボール(缶350)", abv: 7, volMl: 350 },
    { id: "sake", icon: "🍶", name: "日本酒(一合)", abv: 15, volMl: 180 },
    { id: "wine", icon: "🍷", name: "ワイン(グラス)", abv: 12, volMl: 120 },
    { id: "shochu", icon: "🍠", name: "焼酎(水割り)", abv: 12, volMl: 200 },
    { id: "whisky", icon: "🥃", name: "ウイスキー(シングル)", abv: 40, volMl: 30 },
    { id: "cocktail", icon: "🍸", name: "カクテル(グラス)", abv: 15, volMl: 100 },
    { id: "umeshu", icon: "🍑", name: "梅酒(ロック)", abv: 13, volMl: 60 },
  ];

  window.App = window.App || {};
  window.App.presets = DRINK_PRESETS;
})();
