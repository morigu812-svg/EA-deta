/**
 * My Link Hub - GitHub Pages ↔ GAS ApiBridge
 *
 * GitHub Pages からフォームPOSTし、HtmlServiceのiframe内から
 * EA_DATA_RESULT を postMessage で返す方式です。
 * API_URLはGitHub Pagesのindex.html側に設定します。
 */

function doGet() {
  return HtmlService.createHtmlOutput(
    '<!doctype html><html><head><meta charset="utf-8"></head><body>' +
    '<p>My Link Hub API is ready.</p></body></html>'
  ).setTitle("My Link Hub API");
}

function doPost(e) {
  var requestId = "";
  var result = null;
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
      case "getLinks":
        result = linkHubGetLinks();
        break;
      case "saveLink":
        linkHubCheckAdmin_(args.adminPassword);
        result = linkHubSaveLink(args.link || {});
        break;
      case "deleteLink":
        linkHubCheckAdmin_(args.adminPassword);
        result = linkHubDeleteLink(args.id);
        break;
      default:
        throw new Error("未対応の操作です。");
    }
    ok = true;
  } catch (error) {
    errorMessage = error && error.message ? error.message : String(error);
  }

  var response = {
    type: "EA_DATA_RESULT",
    requestId: requestId,
    ok: ok,
    data: ok ? result : null,
    error: errorMessage
  };

  // 入力値に </script> 等が含まれてもHTML内のscriptを抜けられないようにする
  var safeResponse = JSON.stringify(response)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  var html = '<!doctype html><html><head><meta charset="utf-8"></head><body>' +
    '<script>window.top.postMessage(' + safeResponse + ',"*");</scr' + 'ipt>' +
    '</body></html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle("My Link Hub API")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
