/**
 * BAC(血中アルコール濃度) = r×W÷A​×100
 * A: 純アルコール量（g）
 * W: 体重（g）
 * r: 分配係数（男:0.68、女:0.55）
 *
 * https://www.gov-online.go.jp/article/201804/entry-8385.html
 */
/* ==========================================================
 *  DOM定義
 * ========================================================== */
// 1.ドリンクのカードコンテナ
const DrinkContainer = document.getElementById("DrinkContainer");
// 2.ユーザー情報表示コンテナ
const UserInfo = document.getElementById("UserInfo");
// 3.ユーザー情報使用チェックボックス
const UseUserInfoCheck = document.getElementById("UseUserInfoCheck");
// 4.判定結果表示コンテナ
const JudgeResult = document.getElementById("JudgeResult");

/* ==========================================================
 *  グローバル定義
 * ========================================================== */
// 1.ダイアログインスタンス
const Dialog = new DialogInfo();

/* ==========================================================
 *  タブ押下時イベント定義
 * ========================================================== */
// 1.[判定画面]ボタン押下時イベント
document
  .getElementById("JudgeDispButton")
  .addEventListener("click", () => ShowDisplayEvent("start"));
// 2.[ユーザー情報]ボタン押下時イベント
document
  .getElementById("UserInfoDispButton")
  .addEventListener("click", () => ShowDisplayEvent("user"));
// 3.[履歴]ボタン押下時イベント
document
  .getElementById("HistoryDispButton")
  .addEventListener("click", () => ShowDisplayEvent("history"));

/* ==========================================================
 *  各入力フォーム要素取得
 * ========================================================== */
// 1.性別セレクトボックス
const GenderElement = document.getElementById("GenderElement");
// 2.年齢入力フォーム
const AgeElement = document.getElementById("AgeElement");
// 3.血液型セレクトボックス
const BloodType = document.getElementById("BloodType");
// 4.体重入力フォーム
const WeightElement = document.getElementById("WeightElement");
// 5.週の飲酒日数入力フォーム
const WeeklyElement = document.getElementById("WeeklyElement");

/* ==========================================================
 *  初期表示時に配置するドリンク
 * ========================================================== */
const DefaultDrinks = [
  {
    // 1.品名
    type: "ビール(缶)",
    // 2.アルコール度数
    abv: 5,
    // 3.本数
    count: 1,
    // 4.量
    vol: 350,
    // 5.チェック
    checked: false,
    // 6.デフォルトの項目であるかを判別するFLG
    default: true,
  },
  {
    type: "焼酎(グラス)",
    abv: 25,
    count: 1,
    vol: 90,
    checked: false,
    default: true,
  },
  {
    type: "ワイン(グラス)",
    abv: 12,
    count: 1,
    vol: 150,
    checked: false,
    default: true,
  },
  {
    type: "ハイボール(ジョッキ)",
    abv: 9,
    count: 1,
    vol: 350,
    checked: false,
    default: true,
  },
];

/* ==========================================================
 *  ボタンクリック時イベント定義
 * ========================================================== */
// 1.[保存]ボタン押下時イベント定義
document
  .getElementById("SaveUserInfoButton")
  .addEventListener("click", SaveUserInfoButton);
// 2.[クリア]ボタン押下時イベント定義
document
  .getElementById("ClearUserInfoButton")
  .addEventListener("click", ClearUserInfoButton);
// 3.[エクスポート]ボタン押下時イベント
document.getElementById("ExportButton").addEventListener("click", ExportButton);
// 4.[履歴クリア]ボタン押下時イベント
document
  .getElementById("ClearHistoryButton")
  .addEventListener("click", ClearHistoryButton);
// 5.[種類追加]ボタン押下時イベント
document
  .getElementById("AddDrinkButton")
  .addEventListener("click", () => AddDrinkButton());
// 6.[リセット]ボタン押下時イベント
document.getElementById("ResetDrinkButton").addEventListener("click", () => {
  Dialog.ShowConfirmDialog("全てのドリンクをリセットしますか？").then(
    (result) => {
      /* [はい]が押下された場合は画面を戻る */
      if (result) {
        RenderDrinkUI(DefaultDrinks);
      }
    }
  );
});
// 7.[判定]ボタン押下時イベント
document.getElementById("JudgeButton").addEventListener("click", JudgeEvent);

/* ==========================================================
 *  飲んだドリンクを保持する配列
 * ========================================================== */
let CreateDrink = [];

/**
 * 初期化処理
 */
function InitEvent() {
  // 1.ユーザー情報をストレージから取得し、各フォームへセット
  LoadUserToForm();
  // 2.ユーザー情報をユーザー情報表示コンテナに表示
  RenderUserSummary();
  // initial CreateDrink
  RenderDrinkUI(DefaultDrinks.slice(0));
  // 4.初期表示タブを表示
  ShowDisplayEvent("start");
  // load history preview
  RenderHistory();
}

/**
 * タブの表示を切り替える処理
 * @param screen 表示タブの要素ID([screen-]よりも下)
 */
function ShowDisplayEvent(screen) {
  // 1.表示タブを一旦すべて閉じる処理
  document
    .querySelectorAll(".screen")
    .forEach((item) => item.classList.remove("active"));
  // 2.引数に指定されたタブを表示
  document.getElementById("screen-" + screen).classList.add("active");
}

/**
 * ユーザー情報保存処理
 * @returns
 */
function SaveUserInfoButton() {
  const obj = {
    gender: GenderElement.value,
    age: parseInt(AgeElement.value || 0, 10),
    btype: BloodType.value,
    weight: parseFloat(WeightElement.value || 0),
    weekly: parseFloat(WeeklyElement.value || 0),
  };
  if (!obj.weight || obj.age <= 0) {
    Dialog.ShowDialog("年齢と体重は必須です。");
    return;
  }
  localStorage.setItem("UserInfo", JSON.stringify(obj));
  RenderUserSummary();
  Dialog.ShowDialog("保存が完了しました。").then(() => {
    ShowDisplayEvent("start");
  });
}

/**
 * ユーザー情報削除処理
 */
function ClearUserInfoButton() {
  Dialog.ShowConfirmDialog("ユーザー情報を削除しますか？").then((result) => {
    /* [はい]が押下された場合は画面を戻る */
    if (result) {
      /* ユーザー情報をストレージから削除 */
      localStorage.removeItem("UserInfo");

      /* 各入力フォームを初期化 */
      // 1.性別初期化
      GenderElement.selectedIndex = 0;
      // 2.年齢初期化
      AgeElement.value = "";
      // 3.血液型初期化
      BloodType.selectedIndex = 0;
      // 4.体重初期化
      WeightElement.value = "";
      // 5.週の飲酒日数
      WeeklyElement.value = "";

      /* ユーザー情報表示領域を再設定 */
      RenderUserSummary();

      /* ダイアログ表示 */
      Dialog.ShowDialog("削除が完了しました。").then(() => {
        // 1.タブを判定画面へ遷移
        ShowDisplayEvent("start");
      });
    }
  });
}

/**
 * ユーザー情報をストレージから取得し、各フォームへセットする処理
 * @returns
 */
function LoadUserToForm() {
  /* 定義 */
  // 1.ストレージからユーザー情報取得
  const UserInfoJson = localStorage.getItem("UserInfo");

  /* 取得できていない場合は処理終了 */
  if (!UserInfoJson) return;

  /* 処理開始 */
  try {
    // 1.JSONをパース
    const ParseUserInfo = JSON.parse(UserInfoJson);
    // 2.性別をセット
    GenderElement.value = ParseUserInfo.gender || "male";
    // 3.年齢をセット
    AgeElement.value = ParseUserInfo.age || "";
    // 4.血液型をセット
    BloodType.value = ParseUserInfo.btype || "A";
    // 5.体重をセット
    WeightElement.value = ParseUserInfo.weight || "";
    // 6.週の飲酒日数をセット
    WeeklyElement.value = ParseUserInfo.weekly || 0;
  } catch (e) {
    /* 例外時 */
    // 1.デバッグコンソール出力
    console.error(e);
    // 2.処理終了
    return;
  }
}

/**
 * ユーザー情報表示コンテナへの表示処理
 * @returns
 */
function RenderUserSummary() {
  /* 定義 */
  // 1.ストレージからユーザー情報取得
  const UserInfoJson = localStorage.getItem("UserInfo");

  /* ユーザー情報が存在しない場合 */
  if (!UserInfoJson) {
    // 1.未登録のテキスト設定
    UserInfo.textContent = "未登録";
    // 2.処理終了
    return;
  }

  /* 表示処理 */
  try {
    // 1.JSONをパース
    const ParseUserInfo = JSON.parse(UserInfoJson);
    // 2.ユーザー情報表示コンテナに各情報を設定
    UserInfo.innerHTML = `${
      ParseUserInfo.gender === "male" ? "男性" : "女性"
    } / ${ParseUserInfo.age}歳 / ${ParseUserInfo.weight}kg / 週${
      ParseUserInfo.weekly
    }日の飲酒 / ${ParseUserInfo.btype || "未設定"}型`;
  } catch (e) {
    /* 例外時 */
    // 1.未登録のテキスト設定
    UserInfo.textContent = "未登録";
    // 2.処理終了
    return;
  }
}

/**
 * 飲み物一覧の作成を行う処理
 * @param DefaultDrinkList デフォルトのドリンクが格納されているオブジェクト配列
 */
function RenderDrinkUI(DefaultDrinkList) {
  /* ------------------------------
   *  1. 事前処理
   * ------------------------------*/
  // 1.デフォルトのドリンク情報を飲んだドリンクを保持する配列に展開
  CreateDrink = DefaultDrinkList.map((drink) => ({ ...drink }));
  // 2.コンテナを初期化
  DrinkContainer.innerHTML = "";

  /* ------------------------------
   *  2. 画面構築処理
   * ------------------------------*/
  CreateDrink.forEach((drink, index) => {
    /* コンテナを作成 */
    // 1.DIV要素を作成
    const DivElement = document.createElement("div");
    // 2.クラスを設定
    DivElement.className = "DrinkInfo";

    /* ドリンクカード上段（品名＋チェックボックス）を作成 */
    // 1.DIV要素を作成
    const Row1 = document.createElement("div");
    // 2.クラスを設定
    Row1.classList.add("row", "space");

    /* 品名を作成 */
    // 1.h3要素を作成
    const DrinkType = document.createElement("h3");
    // 2.内容設定
    DrinkType.textContent = `${escapeHtml(drink.type || "自由入力")}`;
    // 3.上段に追加
    Row1.appendChild(DrinkType);

    /* チェックボックスラベルを作成 */
    // 1.label要素を作成
    const CheckLabel = document.createElement("label");
    // 2.input要素を作成
    const CheckBoxElement = document.createElement("input");
    // 3.タイプを設定
    CheckBoxElement.type = "checkbox";
    // 4.data属性を設定
    CheckBoxElement.dataset.i = index;
    // 5.チェック状態を設定
    if (drink.checked) {
      CheckBoxElement.checked = true;
    }
    // 6.ラベルに追加
    CheckLabel.appendChild(CheckBoxElement);
    // 7.上段に追加
    Row1.appendChild(CheckLabel);

    /* 種類を作成 */
    // 1.DIV要素を作成
    const Row2 = document.createElement("div");
    // 2.スタイル設定
    Row2.style.marginTop = "6px";
    // 3.label要素を作成
    const TypeLabel = document.createElement("label");
    // 4.ラベル内容を設定
    TypeLabel.textContent = "種類";
    // 5.input要素を作成
    const TypeInput = document.createElement("input");
    // 6.タイプを設定
    TypeInput.type = "text";
    // 7.値を設定
    TypeInput.value = escapeHtml(drink.type || "");
    // 8.data属性を設定
    TypeInput.dataset.field = "type";
    // 9.インデックスを設定
    TypeInput.dataset.i = index;
    TypeInput.style.width = "100%";
    // 10.labelに追加
    TypeLabel.appendChild(TypeInput);
    // 11.Row2に追加
    Row2.appendChild(TypeLabel);

    /* 度数・本数入力行を作成 */
    // 1.DIV要素を作成
    const Row3 = document.createElement("div");
    // 2.クラスを設定
    Row3.classList.add("row");
    // 3.スタイル設定
    Row3.style.marginTop = "6px";

    /* 度数(%)入力 */
    // 1.label要素を作成
    const AbvLabel = document.createElement("label");
    // 2.スタイル設定
    AbvLabel.style.flex = "1";
    // 3.ラベル内容を設定
    AbvLabel.textContent = "度数(%)";
    // 4.input要素を作成
    const AbvInput = document.createElement("input");
    // 5.タイプ設定
    AbvInput.type = "number";
    // 6.最小値を設定
    AbvInput.min = "0";
    // 7.最大値を設定
    AbvInput.max = "96";
    // 8.値を設定
    AbvInput.value = drink.abv || 0;
    // 9.data属性を設定
    AbvInput.dataset.field = "abv";
    // 10.インデックスを設定
    AbvInput.dataset.i = index;
    // 11.labelに追加
    AbvLabel.appendChild(AbvInput);
    // 12.Row3に追加
    Row3.appendChild(AbvLabel);

    /* 本数入力 */
    // 1.label要素を作成
    const CountLabel = document.createElement("label");
    // 2.スタイル設定
    CountLabel.style.width = "86px";
    // 3.ラベル内容を設定
    CountLabel.textContent = "本数";
    // 4.input要素を作成
    const CountInput = document.createElement("input");
    // 5.タイプ設定
    CountInput.type = "number";
    // 6.最小値を設定
    CountInput.min = "0";
    // 7.値を設定
    CountInput.value = drink.count || 0;
    // 8.data属性を設定
    CountInput.dataset.field = "count";
    // 9.インデックスを設定
    CountInput.dataset.i = index;
    // 10.labelに追加
    CountLabel.appendChild(CountInput);
    // 11.Row3に追加
    Row3.appendChild(CountLabel);

    /* 容量・複製・削除行を作成 */
    // 1.DIV要素を作成
    const Row4 = document.createElement("div");
    // 2.クラスを設定
    Row4.classList.add("row");
    // 3.スタイル設定
    Row4.style.marginTop = "6px";

    /* 容量(ml)入力 */
    // 1.label要素を作成
    const VolLabel = document.createElement("label");
    // 2.スタイル設定
    VolLabel.style.flex = "1";
    // 3.ラベル内容を設定
    VolLabel.textContent = "容量(ml)";
    // 4.input要素を作成
    const VolInput = document.createElement("input");
    // 5.タイプ設定
    VolInput.type = "number";
    // 6.最小値を設定
    VolInput.min = "1";
    // 7.値を設定
    VolInput.value = drink.vol || 100;
    // 8.data属性を設定
    VolInput.dataset.field = "vol";
    // 9.インデックスを設定
    VolInput.dataset.i = index;
    // 10.labelに追加
    VolLabel.appendChild(VolInput);
    // 11.Row4に追加
    Row4.appendChild(VolLabel);

    /* 複製・削除ボタンコンテナ */
    // 1.DIV要素を作成
    const BtnBox = document.createElement("div");
    // 2.スタイル設定
    BtnBox.style.width = "86px";
    BtnBox.style.textAlign = "right";

    /* 複製ボタン */
    // 1.button要素を作成
    const DupBtn = document.createElement("button");
    // 2.クラスを設定
    DupBtn.className = "smallBtn";
    // 3.data属性を設定
    DupBtn.dataset.action = "dup";
    // 4.インデックスを設定
    DupBtn.dataset.i = index;
    // 5.ボタン内容を設定
    DupBtn.textContent = "複製";
    // 6.ボックスに追加
    BtnBox.appendChild(DupBtn);

    /* デフォルト以外の場合のみ削除ボタンを追加 */
    if (!drink.default) {
      // 1.button要素を作成
      const DelBtn = document.createElement("button");
      // 2.クラスを設定
      DelBtn.className = "smallBtn";
      // 3.data属性を設定
      DelBtn.dataset.action = "remove";
      // 4.インデックスを設定
      DelBtn.dataset.i = index;
      // 5.ボタン内容を設定
      DelBtn.textContent = "削除";
      // 6.ボックスに追加
      BtnBox.appendChild(DelBtn);
    }

    // 7.Row4に追加
    Row4.appendChild(BtnBox);

    /* 要素をまとめてコンテナに追加 */
    // 1.Row1を追加
    DivElement.appendChild(Row1);
    // 2.Row2を追加
    DivElement.appendChild(Row2);
    // 3.Row3を追加
    DivElement.appendChild(Row3);
    // 4.Row4を追加
    DivElement.appendChild(Row4);

    /* コンテナに格納 */
    DrinkContainer.appendChild(DivElement);
  });

  // attach events
  DrinkContainer.querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("change", onDrinkInputChange);
    inp.addEventListener("input", onDrinkInputChange);
  });
  DrinkContainer.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", onDrinkBtn)
  );
  // small button styles
  document.querySelectorAll(".smallBtn").forEach((b) => {
    b.style.border = "none";
    b.style.background = "transparent";
    b.style.color = "var(--accent)";
    b.style.cursor = "pointer";
  });
}

function onDrinkBtn(e) {
  const i = parseInt(e.currentTarget.dataset.i, 10);
  const act = e.currentTarget.dataset.action;
  if (act === "remove") {
    CreateDrink.splice(i, 1);
    RenderDrinkUI(CreateDrink);
  }
  if (act === "dup") {
    CreateDrink.splice(i + 1, 0, JSON.parse(JSON.stringify(CreateDrink[i])));
    RenderDrinkUI(CreateDrink);
  }
}
function onDrinkInputChange(e) {
  const i = parseInt(e.target.dataset.i, 10);
  const f = e.target.dataset.field;
  if (e.target.type === "checkbox") {
    CreateDrink[i].checked = e.target.checked;
  } else if (f) {
    if (f === "abv") {
      CreateDrink[i].abv = parseFloat(e.target.value || 0);
    } else if (f === "count") {
      CreateDrink[i].count = parseInt(e.target.value || 0, 10);
    } else if (f === "type") {
      CreateDrink[i].type = e.target.value;
    } else if (f === "vol") {
      CreateDrink[i].vol = parseFloat(e.target.value || 0);
    }
  }
}

function AddDrinkButton() {
  CreateDrink.push({
    type: "",
    abv: 0,
    count: 1,
    vol: 100,
    checked: true,
    default: false,
  });
  RenderDrinkUI(CreateDrink);
  setTimeout(() => {
    const all = DrinkContainer.querySelectorAll('input[data-field="type"]');
    if (all.length) all[all.length - 1].focus();
  }, 50);
}

/**
 * 血中アルコール濃度判定処理
 * @returns
 */
function JudgeEvent() {
  const userStrageInfo = UseUserInfoCheck.checked
    ? JSON.parse(localStorage.getItem("UserInfo") || "null")
    : null;

  /* ユーザー情報が存在しない状態でユーザー情報を利用するにチェックがされている場合 */
  if (
    document.getElementById("UseUserInfoCheck").checked &&
    !JSON.parse(localStorage.getItem("UserInfo"))
  ) {
    /* ダイアログ表示 */
    Dialog.ShowDialog("ユーザー情報が存在しません。").then(() => {
      // 1.タブをユーザー情報画面へ遷移
      ShowDisplayEvent("user");
    });
    /* 処理終了 */
    return;
  }
  const chosen = CreateDrink.filter((d) => d.checked);
  if (chosen.length === 0) {
    Dialog.ShowDialog("チェックされた飲み物がありません。");
    return;
  }
  for (const d of chosen) {
    if (!d.type || d.type.trim() === "") {
      Dialog.ShowDialog("自由入力の項目がある場合は種類名を入力してください。");
      return;
    }
    if (!d.abv || d.abv <= 0) {
      Dialog.ShowDialog("度数は0より大きい値を入力してください。");
      return;
    }
    if (!d.count || d.count <= 0) {
      Dialog.ShowDialog("本数は1以上を入力してください。");
      return;
    }
    if (!d.vol || d.vol <= 0) {
      Dialog.ShowDialog("容量(ml)は1以上の値を入力してください。");
      return;
    }
  }

  const weight = userStrageInfo ? Number(userStrageInfo.weight) : 60;
  const gender = userStrageInfo ? userStrageInfo.gender : "male";
  const r = gender === "male" ? 0.68 : 0.55;

  const alcoholDensity = 0.789;
  let totalAlcoholG = 0;

  chosen.forEach((d) => {
    const count = Number(d.count);
    const vol = Number(d.vol);
    const abv = Number(d.abv);
    totalAlcoholG += count * vol * (abv / 100) * alcoholDensity;
  });

  const absorptionRate = 0.7;
  const bac = ((totalAlcoholG * absorptionRate) / (weight * 1000 * r)) * 100;

  const rankInfo = RankBac(bac);

  const rec = {
    ts: new Date().toISOString(),
    bac: round(bac, 4),
    rank: rankInfo.rank,
    message: rankInfo.message,
    CreateDrink: chosen.map((d) => ({
      type: d.type,
      abv: d.abv,
      count: d.count,
      vol: d.vol,
    })),
  };
  pushHistory(rec);
  RenderHistory();
  displayResult(rec);
}

function displayResult(rec) {
  JudgeResult.innerHTML = `
        <div class="CardContainer">
          <div class="result-big">ランク: ${rec.rank}</div>
          <div class="result-meta">推定BAC: ${rec.bac}%</div>
          <div style="margin-top:8px">${rec.message}</div>

        </div>
      `;
}

function pushHistory(rec) {
  const js = localStorage.getItem("HistoryInfoStrage");
  const arr = js ? JSON.parse(js) : [];
  arr.unshift(rec);
  localStorage.setItem("HistoryInfoStrage", JSON.stringify(arr.slice(0, 100)));
}

/**
 * 履歴作成表示処理
 * @returns
 */
function RenderHistory() {
  /* ------------------------------
   *  1. 定義
   * ------------------------------*/
  // 1.ストレージから履歴を取得
  const HistoryInfo = localStorage.getItem("HistoryInfoStrage");
  // 2.履歴情報をパース
  const arr = HistoryInfo ? JSON.parse(HistoryInfo) : [];
  const list = document.getElementById("historyList");
  list.innerHTML = "";
  /* 履歴リストを構築 */
  // 1.履歴が存在しない場合の処理
  if (arr.length === 0) {
    list.innerHTML = '<div class="muted-small">履歴はまだありません</div>';
    return;
  }

  // 2.履歴を1件ずつ処理
  arr.forEach((r) => {
    /* 履歴アイテム全体を作成 */
    // 1.DIV要素を作成
    const el = document.createElement("div");
    // 2.クラスを設定
    el.className = "HistoryCardItem";

    /* 上段（ランク・日時・BAC）を作成 */
    // 1.DIV要素を作成
    const TopRow = document.createElement("div");
    // 2.スタイル設定
    TopRow.style.display = "flex";
    TopRow.style.justifyContent = "space-between";
    TopRow.style.alignItems = "center";

    /* 左側（ランクと日時） */
    // 1.DIV要素を作成
    const LeftBox = document.createElement("div");
    LeftBox.style.display = "flex";
    LeftBox.style.alignItems = "center";
    LeftBox.style.gap = "8px";

    // 2.ランク要素を作成
    const StrongRank = document.createElement("strong");
    StrongRank.textContent = `判定結果 : ${r.rank}`;
    LeftBox.appendChild(StrongRank);

    // 3.日時要素を作成
    const DateText = document.createElement("p");
    DateText.className = "muted-small";
    DateText.textContent = " " + new Date(r.ts).toLocaleString();

    // 4.日時を追加
    LeftBox.appendChild(DateText);

    /* 右側（BAC） */
    // 1.DIV要素を作成
    const RightBox = document.createElement("div");
    // 2.クラスを設定
    RightBox.className = "muted-small";
    // 3.内容を設定
    RightBox.textContent = `BAC:${r.bac}%`;

    // 4.TopRowに左右を追加
    TopRow.appendChild(LeftBox);
    TopRow.appendChild(RightBox);

    /* メッセージ行を作成 */
    // 1.DIV要素を作成
    const MsgDiv = document.createElement("div");
    // 2.クラスを設定
    MsgDiv.className = "muted-small";
    // 3.スタイル設定
    MsgDiv.style.marginTop = "2px";
    // 4.内容を設定
    MsgDiv.textContent = r.message;

    /* 詳細要素を作成 */
    // 1.details要素を作成
    const Details = document.createElement("details");
    // 2.スタイル設定
    Details.style.marginTop = "6px";

    /* summary要素を作成 */
    // 1.summary要素を作成
    const Summary = document.createElement("summary");
    // 2.クラスを設定
    Summary.className = "muted-small";
    // 3.内容を設定
    Summary.textContent = "詳細";
    // 4.detailsに追加
    Details.appendChild(Summary);

    /* 飲んだもの情報を作成 */
    // 1.DIV要素を作成
    const DrinkInfo = document.createElement("div");
    // 2.クラスを設定
    DrinkInfo.className = "muted-small";
    // 3.内容を設定
    DrinkInfo.textContent =
      "飲んだもの: " +
      r.CreateDrink.map(
        (d) => `${d.type} x${d.count}(${d.abv}% / ${d.vol}ml)`
      ).join(", ");
    // 4.detailsに追加
    Details.appendChild(DrinkInfo);

    /* 要素をまとめて履歴アイテムに追加 */
    // 1.TopRowを追加
    el.appendChild(TopRow);
    // 2.メッセージ行を追加
    el.appendChild(MsgDiv);
    // 3.詳細を追加
    el.appendChild(Details);

    /* 履歴リストに追加 */
    list.appendChild(el);
  });
}

/**
 * エクスポートボタン押下時処理
 */
function ExportButton() {
  const js = localStorage.getItem("HistoryInfoStrage") || "[]";
  const blob = new Blob([js], { type: "application/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "HistoryInfoStrage.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  Dialog.ShowDialog("保存が完了しました。");
}
function ClearHistoryButton() {
  // 1.ダイアログを表示
  Dialog.ShowConfirmDialog("履歴を全て削除しますか？").then((result) => {
    /* [はい]が押下された場合は画面を戻る */
    if (result) {
      localStorage.removeItem("HistoryInfoStrage");
      RenderHistory();
    }
  });
}

/**
 * 血中アルコール濃度数値ごとのランク設定処理
 * @param bac 血中アルコール濃度数値
 * @returns
 */
function RankBac(bac) {
  if (bac <= 0.01)
    return {
      rank: "F",
      message: "ほぼシラフです。飲みましょう。",
      nextThreshold: 0.01,
    };
  if (bac <= 0.02)
    return {
      rank: "E",
      message: "少し酔った程度です。飲みましょう。",
      nextThreshold: 0.02,
    };
  if (bac <= 0.04)
    return {
      rank: "D",
      message:
        "軽度の酩酊状態です。気分が高揚し、判断が少し鈍ります。まだ飲みましょう。",
      nextThreshold: 0.04,
    };
  if (bac <= 0.06)
    return {
      rank: "C",
      message:
        "中等度の酩酊状態です。声が大きくなり、抑制が低下します。まだいけます。",
      nextThreshold: 0.06,
    };
  if (bac <= 0.08)
    return {
      rank: "B",
      message:
        "完全に酔っています。バランス感覚の低下や誤判断が見られます。正直まだいけます。",
      nextThreshold: 0.08,
    };
  if (bac <= 0.1)
    return {
      rank: "A",
      message:
        "高度の酩酊状態です。言動が乱れ、千鳥足になります。二次会には顔だけ出しましょう。",
      nextThreshold: 0.1,
    };
  if (bac <= 0.13)
    return {
      rank: "S",
      message: "危険な状態です。記憶の欠落が始まる可能性があります。",
      nextThreshold: 0.13,
    };
  if (bac <= 0.16)
    return {
      rank: "SS",
      message: "昏睡寸前の状態です。すぐ帰宅してください。",
      nextThreshold: 0.16,
    };
  if (bac <= 0.2)
    return {
      rank: "SSS",
      message: "意識障害レベル。救急受診を検討すべきです。",
      nextThreshold: 0.2,
    };
  return {
    rank: "Z",
    message: "死にます。ブラウザを閉じて遺族となる方々に連絡してください。",
    nextThreshold: null,
  };
}

function round(v, d) {
  return Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
}
function escapeHtml(s) {
  if (!s) return "";
  return (s + "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ==========================================================
 *  初期化処理発火
 * ========================================================== */
InitEvent();
