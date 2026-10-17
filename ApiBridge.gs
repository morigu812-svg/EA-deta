/**
 * EAデータ GitHub Pages 接続ブリッジ
 * このファイルを既存のEAデータ Apps Scriptプロジェクトに新しい .gs ファイルとして追加してください。
 * 既存の Code.gs やスプレッドシートは置き換えません。
 *
 * GitHub Pages からのPOSTは非表示フォームで送信し、HTML iframeからpostMessageで結果を返します。
 * 管理者パスワードはこのファイルにも保存せず、既存の adminLogin() を呼び出します。
 */

function doPost(e) {
  var requestId = "";
  var result;
  var ok = false;
  var errorMessage = "";

  try {
    var raw = e && e.parameter ? e.parameter.payload : "";
    if (!raw) throw new Error("リクエストデータがありません。");
    var request = JSON.parse(raw);
    requestId = String(request.requestId || "");
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(requestId)) {
      throw new Error("リクエストIDが不正です。");
    }

    var args = request.args || {};
    switch (String(request.action || "")) {
      case "getInitialData":
        result = getInitialData();
        break;
      case "getCommentsForTitle":
        result = getCommentsForTitle(args.title);
        break;
      case "addComment":
        result = addComment(args.title, args.comment);
        break;
      case "adminLogin":
        result = adminLogin(args.password);
        break;
      case "getAdminData":
        result = getAdminData(args.token);
        break;
      case "setCommentResolved":
        result = setCommentResolved(args.token, args.commentId, args.resolved);
        break;
      case "addLink":
        result = addLink(args.token, args.title, args.description, args.url, args.category);
        break;
      case "submitSurvey":
        result = submitSurvey(args.answer, args.feedback);
        break;
      case "getSurveyResults":
        result = getSurveyResults(args.token);
        break;
      case "clearAllComments":
        result = clearAllComments(args.token);
        break;
      default:
        throw new Error("未対応の操作です。");
    }
    ok = true;
  } catch (error) {
    errorMessage = error && error.message ? error.message : String(error);
  }

  // </script> 等がコメント内容に含まれてもスクリプトを抜けられないよう < をエスケープ。
  var response = {
    type: "EA_DATA_RESULT",
    requestId: requestId,
    ok: ok,
    data: ok ? result : null,
    error: errorMessage
  };
  var safeResponse = JSON.stringify(response)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  var html = '<!doctype html><html><head><meta charset="utf-8"></head><body>' +
    '<script>window.top.postMessage(' + safeResponse + ',"*");</scr' + 'ipt>' +
    '</body></html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle("EAデータ API")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * 管理者専用：コメント本文を消去する。見出し行とリンク一覧は残す。
 */
function clearAllComments(token) {
  requireAdmin_(token);

  var sheet = getDatabase_().getSheetByName(SHEET_NAMES.comments);
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();

  if (lastRow > 1 && lastColumn > 0) {
    sheet.getRange(2, 1, lastRow - 1, lastColumn).clearContent();
  }
  clearDataCaches_();

  return {
    ok: true,
    message: "過去のコメントをクリアしました。"
  };
}


function getOrCreateSurveySheet_() {
  var ss = getDatabase_();
  var sheetName = "SurveyResponses";
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(["送信日時", "回答", "改善要望"]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function submitSurvey(answer, feedback) {
  var allowed = ["とても活用できている", "ある程度活用できている", "あまり活用できていない", "活用できていない"];
  answer = String(answer || "").trim();
  feedback = String(feedback || "").trim().slice(0, 500);
  if (allowed.indexOf(answer) === -1) throw new Error("回答を選び直してください。");
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getOrCreateSurveySheet_();
    sheet.appendRow([new Date(), answer, feedback]);
  } finally {
    lock.releaseLock();
  }
  return {ok: true, message: "アンケートを送信しました。ご協力ありがとうございます。"};
}

function getSurveyResults(token) {
  requireAdmin_(token);
  var sheet = getOrCreateSurveySheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return {responses: []};
  var values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  return {responses: values.map(function(row) {
    return {
      timestamp: row[0] instanceof Date
        ? Utilities.formatDate(row[0], Session.getScriptTimeZone() || "Asia/Tokyo", "yyyy/MM/dd HH:mm")
        : String(row[0] || ""),
      answer: String(row[1] || ""),
      feedback: String(row[2] || "")
    };
  })};
}
