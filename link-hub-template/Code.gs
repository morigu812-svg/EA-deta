/**
 * My Link Hub - データ保存処理
 * Googleスプレッドシートは使用しません。
 * 保存先: Script Properties
 *
 * Apps Script のプロジェクト設定 > スクリプト プロパティに
 * ADMIN_PASSWORD を設定してください。
 */

const LINK_HUB_PREFIX = "LINK_HUB_ITEM_";
const LINK_HUB_MAX_ITEMS = 300;

function linkHubGetLinks() {
  const all = PropertiesService.getScriptProperties().getProperties();
  return Object.keys(all)
    .filter(key => key.indexOf(LINK_HUB_PREFIX) === 0)
    .map(key => {
      try { return JSON.parse(all[key]); } catch (e) { return null; }
    })
    .filter(item => item && item.id && item.name && item.url)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function linkHubSaveLink(input) {
  if (!input || typeof input !== "object") throw new Error("入力内容が不正です。");

  const name = linkHubText_(input.name, 100);
  const url = linkHubUrl_(input.url);
  const category = linkHubText_(input.category, 40) || "その他";
  const description = linkHubText_(input.description, 500);
  const githubUrl = input.githubUrl ? linkHubUrl_(input.githubUrl) : "";

  if (!name) throw new Error("サイト名を入力してください。");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const props = PropertiesService.getScriptProperties();
    const all = props.getProperties();
    const id = linkHubText_(input.id, 80);
    const key = id ? LINK_HUB_PREFIX + id : "";
    let existing = null;

    if (id) {
      if (!all[key]) throw new Error("編集対象が見つかりません。再読み込みしてください。");
      existing = JSON.parse(all[key]);
    } else {
      const count = Object.keys(all).filter(k => k.indexOf(LINK_HUB_PREFIX) === 0).length;
      if (count >= LINK_HUB_MAX_ITEMS) throw new Error("登録上限に達しました。不要なリンクを削除してください。");
    }

    const now = Date.now();
    const item = {
      id: existing ? existing.id : Utilities.getUuid(),
      name: name,
      url: url,
      category: category,
      description: description,
      githubUrl: githubUrl,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    };
    const serialized = JSON.stringify(item);
    if (Utilities.newBlob(serialized).getBytes().length > 8500) {
      throw new Error("保存データが大きすぎます。説明文を短くしてください。");
    }
    props.setProperty(LINK_HUB_PREFIX + item.id, serialized);
    return item;
  } finally {
    lock.releaseLock();
  }
}

function linkHubDeleteLink(id) {
  id = linkHubText_(id, 80);
  if (!id) throw new Error("削除対象のIDがありません。");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const props = PropertiesService.getScriptProperties();
    const key = LINK_HUB_PREFIX + id;
    if (!props.getProperty(key)) throw new Error("リンクが見つかりません。");
    props.deleteProperty(key);
    return { id: id, deleted: true };
  } finally {
    lock.releaseLock();
  }
}

function linkHubCheckAdmin_(password) {
  const expected = PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD");
  if (!expected) throw new Error("GASのスクリプト プロパティに ADMIN_PASSWORD を設定してください。");
  if (typeof password !== "string" || password !== expected) {
    throw new Error("管理者パスワードが違います。");
  }
  return true;
}

function linkHubText_(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function linkHubUrl_(value) {
  const url = linkHubText_(value, 2000);
  if (!/^https?:\/\/\S+$/i.test(url)) {
    throw new Error("URLは http:// または https:// から入力してください。");
  }
  const match = url.match(/^https?:\/\/([^/?#]+)/i);
  if (!match || !match[1] || /[\s<>]/.test(match[1])) {
    throw new Error("有効なURLを入力してください。");
  }
  return url;
}
