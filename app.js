/* =========================================================
   型番商品確認くん / app.js
   型番商品・楽天ランキング・AmazonランキングのURL置き場
   データ: data/products.json（GitHub Contents API で読み書き）
   ========================================================= */

const VERSION   = "0.43.0";
const DATA_PATH = "data/products.json";
const LS_CFG    = "kata_cfg_v1";
const LS_DATA   = "kata_data_v2";
const LS_COLS   = "kata_cols_v1";
const LS_SORT   = "kata_sort_v1";

/* ---------- URL列（タブごとに本数と並びが変わる） ---------- */
const URL_COLS = {
  urlAmazon:  { key: "amzurl", label: "Amazon URL", w: 230, cls: "c-url", field: "urlAmazon"  },
  urlRakuten: { key: "rakurl", label: "楽天 URL",   w: 230, cls: "c-url", field: "urlRakuten" },
  url:        { key: "url",    label: "URL",        w: 240, cls: "c-url", field: "url"        },
};
/* ---------- 「追加した商品」ビューの列 ---------- */
const ADDED_COLS = [
  { key: "a_src",   label: "出所",            w: 190, cls: "td-src"   },
  { key: "p_aimg",  label: "amazon画像",      w: 74,  cls: "td-img"   },
  { key: "p_rimg",  label: "楽天画像",        w: 74,  cls: "td-img"   },
  { key: "a_title", label: "商品名",          w: 230, cls: "td-title" },
  { key: "p_aurl",  label: "amazonURL",       w: 0,   cls: "td-url"   },
  { key: "p_rurl",  label: "楽天URL",         w: 0,   cls: "td-url"   },
  { key: "a_sales", label: "30日販売数",      w: 106, cls: "td-sales" },
  { key: "a_rival", label: "楽天ライバル状況", w: 130, cls: "td-rival" },
  { key: "a_check", label: "確認",            w: 92,  cls: "td-st"    },
  { key: "a_buy",   label: "買付",            w: 92,  cls: "td-st"    },
  { key: "a_edit",  label: "編集",            w: 70,  cls: "td-edit"  },
  { key: "a_act",   label: "操作",            w: 68,  cls: "td-acts"  },
];
const isAdded = (key) => SEC(key)?.kind === "added";

/* ---------- 一覧表の列（そのタブのURL列を挟み込む） ---------- */
function colsOf(key) {
  if (isAdded(key)) return ADDED_COLS;
  const urls = urlFieldsOf(key).map((f) => URL_COLS[f]);
  const sided = Boolean(SEC(key)?.side);
  return [
    { key: "ord", label: "並び", w: 68, cls: "c-ord" },
    ...(sided ? [{ key: "side", label: "区分", w: 118, cls: "c-side" }] : []),
    { key: "img",   label: "画像",       w: 66,  cls: "c-img"   },
    { key: "cat",   label: "大カテゴリ", w: 116, cls: "c-cat",   sort: "category"  },
    { key: "name",  label: "ジャンル名", w: 240, cls: "c-name",  sort: "name"      },
    ...urls,
    { key: "note",  label: "確認内容",   w: 0,   cls: "c-note"  },   // 0 = 自動（残り幅を吸収）
    { key: "check", label: "確認日",     w: 212, cls: "c-check", sort: "checkedAt" },
    { key: "cnt",   label: "商品",       w: 86,  cls: "c-cnt",   sort: "picks"     },
    { key: "addp",  label: "商品追加",   w: 96,  cls: "c-addp"  },
    { key: "act",   label: "操作",       w: 76,  cls: "c-act"   },
  ];
}
/* そのタブで使うURL項目と並び順 */
const urlFieldsOf = (key) => SEC(key)?.urlFields || ["url"];
/* 行の代表URL（名称のリンク先） */
const mainUrl = (it, key) => urlFieldsOf(key).map((f) => it[f]).find(Boolean) || "";

/* ---------- チェックした商品の表の列 ---------- */
/* 商品の Amazon側 / 楽天側 */
const PICK_SIDES = [
  { k: "amazon",  url: "urlAmazon",  img: "imageAmazon",  label: "amazon", imgCol: "p_aimg", urlCol: "p_aurl" },
  { k: "rakuten", url: "urlRakuten", img: "imageRakuten", label: "楽天",   imgCol: "p_rimg", urlCol: "p_rurl" },
];
const PSIDE = (k) => PICK_SIDES.find((x) => x.k === k) || PICK_SIDES[0];
/* そのタブが扱うモール。型番商品など基準が無いタブは Amazon 側を使う */
const sideKeyOf = (sectionKey) => (SEC(sectionKey)?.side === "defense" ? "rakuten" : "amazon");

/* チェックした商品の列。開いているタブのモールだけを出す */
function pickColsOf(sectionKey) {
  const sd = PSIDE(sideKeyOf(sectionKey));
  return [
    { key: "p_date",  label: "追加日",              w: 104, cls: "td-date"  },
    { key: "p_title", label: "商品名",              w: 260, cls: "td-title" },
    { key: sd.imgCol, label: `${sd.label}画像`,     w: 76,  cls: "td-img"   },
    { key: sd.urlCol, label: `${sd.label}URL`,      w: 0,   cls: "td-url"   },   // 0 = 自動
    { key: "p_edit",  label: "編集",                w: 74,  cls: "td-edit"  },
    { key: "p_check", label: "確認",                w: 96,  cls: "td-st"    },
    { key: "p_buy",   label: "買付",                w: 96,  cls: "td-st"    },
    { key: "p_act",   label: "操作",                w: 72,  cls: "td-acts"  },
  ];
}

let colW = {};
const ROW_H_KEY  = "_rowH";
const ROW_H_DEF  = 96;
const PROW_H_KEY = "_pickRowH";
const PROW_H_DEF = 66;
const rowH  = () => colW[ROW_H_KEY]  || ROW_H_DEF;
const pRowH = () => colW[PROW_H_KEY] || PROW_H_DEF;

/* ---------- セクション定義 ---------- */
const SECTIONS = [
  { key: "amazon",   icon: "📊", label: "amazon基準（オフェンス）", nameLabel: "ジャンル名",
    defSort: "checkedAt", urlFields: ["urlAmazon", "urlRakuten"], side: "offense",
    search: "ジャンル名・URLで検索…", add: "＋ 追加",
    emptyTtl: "まだ登録がありません",
    emptySub: "Amazon基準で見るジャンルを登録しておくと、AmazonとURLの対になる楽天ページを一発で開けます。" },
  { key: "rakuten",  icon: "🏆", label: "楽天基準（ディフェンス）",   nameLabel: "ジャンル名",
    defSort: "checkedAt", urlFields: ["urlRakuten", "urlAmazon"], side: "defense",
    search: "ジャンル名・URLで検索…", add: "＋ 追加",
    emptyTtl: "まだ登録がありません",
    emptySub: "楽天基準で見るジャンルを登録しておくと、楽天とURLの対になるAmazonページを一発で開けます。" },
  { key: "products", icon: "📦", label: "追加した商品", nameLabel: "商品名",
    kind: "added", defSort: "addedAt", urlFields: ["url"],
    search: "商品名・URL・出所で検索…", add: "＋ 商品を追加",
    emptyTtl: "まだ1件もありません",
    emptySub: "オフェンス／ディフェンスの各行にある「＋ 商品」から追加すると、ここに追加日ごとに並びます。" },
];
const SEC = (k) => SECTIONS.find((s) => s.key === k);

/* 区分（オフェンス / ディフェンス）。どちらを選ぶかでタブそのものが決まる */
const SIDES = [
  { v: "offense", label: "オフェンス",   cls: "sd-off", sec: "amazon"  },
  { v: "defense", label: "ディフェンス", cls: "sd-def", sec: "rakuten" },
];
const SIDE = (v) => SIDES.find((o) => o.v === v) || SIDES[0];
const sideSecOf = (v) => SIDE(v).sec;
const sideOptions = (v) =>
  SIDES.map((o) => `<option value="${o.v}"${o.v === v ? " selected" : ""}>${o.label}</option>`).join("");

/* ---------- 商品行のドロップダウン ----------
   値（v）は保存済みのデータが参照するので変えない。表示名と色だけ設定で変えられる。 */
const SWATCHES = [
  { c: "gray",   label: "グレー" },
  { c: "blue",   label: "青"     },
  { c: "green",  label: "緑"     },
  { c: "amber",  label: "黄"     },
  { c: "red",    label: "赤"     },
  { c: "purple", label: "紫"     },
  { c: "teal",   label: "青緑"   },
  { c: "pink",   label: "ピンク" },
];
const SWATCH_OK = (c) => SWATCHES.some((x) => x.c === c);

const ST_FIELDS = [
  { key: "check", title: "確認",           opts: [
    { v: "before", label: "確認前",   color: "gray"   },
    { v: "after",  label: "確認後",   color: "green"  },
    { v: "skip",   label: "スキップ", color: "purple" },
  ] },
  { key: "buy", title: "買付", opts: [
    { v: "before", label: "買付前", color: "gray"   },
    { v: "done",   label: "買付済", color: "green"  },
    { v: "skip",   label: "スキップ", color: "purple" },
  ] },
  { key: "rival", title: "楽天ライバル状況", opts: [
    { v: "",      label: "未調査",       color: "gray"  },
    { v: "few",   label: "少数",         color: "blue"  },
    { v: "some",  label: "そこそこいる", color: "amber" },
    { v: "heavy", label: "激戦",         color: "red"   },
  ] },
];
const ST_DEF = (key) => ST_FIELDS.find((f) => f.key === key);

/* 設定（data.labels）を反映した選択肢を返す */
function stList(key) {
  const def = ST_DEF(key);
  const saved = data?.labels?.[key] || [];
  return def.opts.map((o) => {
    const s = saved.find((x) => x && x.v === o.v) || {};
    const color = SWATCH_OK(s.color) ? s.color : o.color;
    return { v: o.v, label: (s.label || o.label), cls: "sw-" + color, color };
  });
}
const stCls = (list, v) => (list.find((o) => o.v === v) || list[0]).cls;
const stOptions = (list, v) =>
  list.map((o) => `<option value="${o.v}"${o.v === v ? " selected" : ""}>${o.label}</option>`).join("");
/* 保存用に整える */
function normLabels(raw) {
  const out = {};
  for (const f of ST_FIELDS) {
    const saved = (raw && raw[f.key]) || [];
    out[f.key] = f.opts.map((o) => {
      const s = saved.find((x) => x && x.v === o.v) || {};
      return {
        v: o.v,
        label: String(s.label || o.label).slice(0, 24),
        color: SWATCH_OK(s.color) ? s.color : o.color,
      };
    });
  }
  return out;
}

const STALE_DAYS = 14;   // 最終確認からこの日数を超えたら色を付ける

/* ---------- 状態 ---------- */
let cfg   = { owner: "", repo: "", branch: "main", pat: "",
              rakutenAppId: "", rakutenAccessKey: "", imgProxy: "", amazonTag: "", autoSave: true };
let data  = emptyData();
let sha   = null;
let dirty = false;
let entry = null;
let isNew = false;

let view = SECTIONS[0].key;
let tableEdit = false;   // 表からの直接編集モード
const editPicks = new Set();   // インライン編集中の商品行 "itemId|pickId"
const openRows  = new Set();   // 商品欄を開いている行
const addRows   = new Set();   // 入力行（新規追加）を出している行
const imgBusy   = new Set();   // 画像を裏で取得中の商品行 "itemId|pickId"
const pinned    = new Map();   // このセッションで新しく登録した行 id → 連番（大きいほど新しい）
let   pinSeq    = 0;
const filters = Object.fromEntries(SECTIONS.map((s) =>
  [s.key, { q: "", cat: "*", sort: s.defSort || "checkedAt", dir: "desc" }]));
const F = () => filters[view];

/* ---------- 小物 ---------- */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => "itm_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const nowIso = () => new Date().toISOString();
const ymd = (iso) => (iso || "").slice(0, 10);
const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
function daysSince(ymdStr) {
  if (!ymdStr) return null;
  const diff = (new Date(today()) - new Date(ymdStr)) / 86400000;
  return Number.isFinite(diff) ? Math.round(diff) : null;
}
function toast(msg, isErr) {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast" + (isErr ? " err" : "");
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 2600);
}
function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}
/* 表示用にURLを読みやすく：%エンコードを戻し、http(s)://www. を落とし、長すぎれば中略 */
function prettyUrl(url, max = 80) {
  let s = String(url || "");
  try { s = decodeURIComponent(s); } catch { /* 壊れたエンコードはそのまま */ }
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  if (s.length > max) s = s.slice(0, max - 26) + " … " + s.slice(-22);
  return s;
}

/* =========================================================
   商品URLからメイン画像を推測（Amazonのみ）
   Amazonの商品ページ本体はCORSで読めないが、URL内のASINから
   画像配信の固定パターンを組み立てられる。候補を順に読み込んで
   実際に絵が返ってきたものを採用する。
   ========================================================= */
function asinOf(url) {
  const m = String(url || "").match(/\/(?:dp|gp\/product|gp\/aw\/d|product)\/([A-Z0-9]{10})/i);
  return m ? m[1].toUpperCase() : "";
}
const isAmazonUrl = (url) => /(^|\.)amazon\.(co\.jp|com)/i.test((() => {
  try { return new URL(url).hostname; } catch { return ""; }
})());

/* AmazonのURLは長い。ASINだけの短い形に直しておくと中継サービスが通りやすい */
function canonicalUrl(url) {
  const asin = asinOf(url);
  if (!asin) return url;
  let host = "www.amazon.co.jp";
  try { host = new URL(url).hostname; } catch { /* noop */ }
  return `https://${host}/dp/${asin}`;
}

const isRakutenUrl = (url) => {
  try { return /(^|\.)rakuten\.co\.jp$/i.test(new URL(url).hostname); } catch { return false; }
};
/* URLがどちら側のものか。判別できなければタブの基準側に寄せる */
function urlSideOf(url, sectionKey) {
  if (isAmazonUrl(url)) return "amazon";
  if (isRakutenUrl(url)) return "rakuten";
  return SEC(sectionKey)?.side === "defense" ? "rakuten" : "amazon";
}
/* その行から見た代表のURL・画像（基準側を先に見る） */
const pickUrl = (p, sec) => SEC(sec)?.side === "defense"
  ? (p.urlRakuten || p.urlAmazon) : (p.urlAmazon || p.urlRakuten);
const pickImg = (p, sec) => SEC(sec)?.side === "defense"
  ? (p.imageRakuten || p.imageAmazon) : (p.imageAmazon || p.imageRakuten);

function imageCandidates(url) {
  const asin = asinOf(url);
  if (!asin) return [];
  /* AsinImageウィジェット。ASINから実際の商品画像へリダイレクトされる。
     アソシエイトのタグが入っているほど確実なので、設定があれば先に試す。 */
  const widget = (host, size, tag) =>
    `https://${host}/widgets/q?_encoding=UTF8&ASIN=${asin}&Format=_SL${size}_` +
    `&ID=AsinImage&MarketPlace=JP&ServiceVersion=20070822&WS=1&tag=${encodeURIComponent(tag)}`;
  const tags = [...new Set([cfg.amazonTag || "", ""])];   // タグ設定済みなら、それ→無しの順
  const widgets = tags.flatMap((t) => [
    widget("ws-fe.amazon-adsystem.com", 500, t),
    widget("ws-na.amazon-adsystem.com", 500, t),
  ]);
  return [
    ...widgets,
    /* 旧来のパターン。書籍・メディアはこちらで取れる */
    `https://m.media-amazon.com/images/P/${asin}.09._SCLZZZZZZZ_.jpg`,
    `https://m.media-amazon.com/images/P/${asin}.01._SCLZZZZZZZ_.jpg`,
    `https://images-na.ssl-images-amazon.com/images/P/${asin}.09.LZZZZZZZ.jpg`,
    `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.LZZZZZZZ.jpg`,
  ];
}

/* 実際に読み込めて、かつプレースホルダ（1x1などの極小画像）でないものだけ採用 */
function probeImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    const done = (ok) => { img.onload = img.onerror = null; resolve(ok ? src : ""); };
    img.onload  = () => done(img.naturalWidth >= 60 && img.naturalHeight >= 60);
    img.onerror = () => done(false);
    setTimeout(() => done(false), 6000);
    img.src = src;
  });
}

/* 楽天ウェブサービス（JSONPなのでGitHub Pagesから直接呼べる） */
const RAKUTEN_EPS = [
  "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701",   // 現行
  "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601",       // 旧（アプリIDのみで通る場合がある）
];
/* 楽天・Amazon以外はページのHTMLを中継サービス越しに読む */
const DEFAULT_PROXIES = [
  "https://r.jina.ai/{url}",
  "https://api.allorigins.win/raw?url={url}",
  "https://api.codetabs.com/v1/proxy/?quest={url}",
  "https://corsproxy.io/?url={url}",
  "https://api.cors.lol/?url={url}",
  "https://thingproxy.freeboard.io/fetch/{url}",
];
const proxyList = () => {
  if (cfg.imgProxy === "-") return [];
  const own = (cfg.imgProxy || "").split(/[\s,]+/).filter((x) => x.includes("{url}"));
  return own.length ? own : DEFAULT_PROXIES;
};

/* item.rakuten.co.jp/{店舗}/{商品番号}/ → itemCode「店舗:商品番号」 */
function rakutenItemCode(url) {
  try {
    const u = new URL(url);
    if (!/(^|\.)item\.rakuten\.co\.jp$/i.test(u.hostname)) return "";
    const seg = u.pathname.split("/").filter(Boolean);
    return seg.length >= 2 ? `${seg[0]}:${seg[1]}` : "";
  } catch { return ""; }
}

/* レスポンスの形（Items/items, Item/item, formatVersion違い）に依存せず値を探す */
function deepFind(obj, keys, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 6) return null;
  for (const k of keys) if (obj[k] != null) return obj[k];
  for (const v of Array.isArray(obj) ? obj : Object.values(obj)) {
    const hit = deepFind(v, keys, depth + 1);
    if (hit) return hit;
  }
  return null;
}

/* <script>タグでJSONPを1回呼ぶ。失敗・タイムアウトは null */
function jsonp(url, ms = 8000) {
  return new Promise((resolve) => {
    const cb = "kata_cb_" + Math.random().toString(36).slice(2, 9);
    const tag = document.createElement("script");
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      delete window[cb];
      tag.remove();
      resolve(v);
    };
    const timer = setTimeout(() => finish(null), ms);
    window[cb] = finish;
    tag.onerror = () => finish(null);
    tag.src = url + (url.includes("?") ? "&" : "?") + "callback=" + cb;
    document.head.appendChild(tag);
  });
}

/* 楽天のサムネURLは ?_ex=128x128 が付くので、大きい順に候補を作る */
function rakutenVariants(raw) {
  const u = String(raw || "");
  if (!u) return [];
  return [...new Set([
    u.replace(/\?_ex=\d+x\d+/, "?_ex=600x600"),
    u.replace(/\?_ex=\d+x\d+/, ""),
    u,
  ])];
}

async function rakutenImages(url, log = () => {}) {
  const code = rakutenItemCode(url);
  if (!code) { log("楽天", "対象外のURL"); return []; }
  if (!cfg.rakutenAppId) { log("楽天", "アプリID未設定のためスキップ"); return []; }
  log("楽天", `itemCode = ${code}`);

  for (const ep of RAKUTEN_EPS) {
    const q = new URLSearchParams({
      applicationId: cfg.rakutenAppId,
      itemCode: code,
      format: "json",
      hits: "1",
    });
    if (cfg.rakutenAccessKey) q.set("accessKey", cfg.rakutenAccessKey);
    const res = await jsonp(`${ep}?${q}`);
    const host = new URL(ep).hostname;
    if (!res) { log("楽天", `${host} → 応答なし`); continue; }

    const err = deepFind(res, ["error_description", "error"]);
    const arr = deepFind(res, ["mediumImageUrls", "smallImageUrls"]);
    const raw = Array.isArray(arr) ? (arr[0]?.imageUrl || arr[0] || "") : "";
    if (raw) { log("楽天", `${host} → 画像URLあり`); return rakutenVariants(raw); }
    log("楽天", `${host} → ${err ? "エラー: " + err : "画像URLが見つからない"}`);
  }
  return [];
}

/* 商品画像ではないもの（サービス側の既定ロゴ、no image、アイコン類）を弾く。
   メタ情報サービスはページが読めないと汎用ロゴを返してくることがあるため。 */
const JUNK_IMG = new RegExp([
  "d3frv9g52qce38\\.cloudfront\\.net",   // microlink の既定ロゴ置き場
  "/amazondefault/",
  "no[-_]?image", "noimage", "placeholder", "dummy",
  "default[-_]?(image|thumb|logo)",
  "[-_./]logo[-_.]", "_logo\\.", "/logo\\.",
  "sprite", "/favicon",
].join("|"), "i");
function isJunkImage(u) {
  const s = String(u || "");
  if (!s) return true;
  if (/\.svg(\?|$)/i.test(s)) return true;             // 商品写真がSVGで来ることはない
  return JUNK_IMG.test(s);
}

/* AmazonのHTMLやテキストから、商品画像の候補を大きい順に集める。
   中継サービスによってはmarkdown化されて返るので、画像IDだけ拾って自前で大きいURLを組み立てる。 */
function amazonImagesFromHtml(html) {
  const unesc = (v) => String(v || "").replace(/\\u002F/gi, "/").replace(/\\\//g, "/").replace(/\\/g, "");
  const out = [];
  const push = (u, score) => { if (u) out.push({ u: unesc(u), score }); };

  /* 商品ページ本体が持っているメイン画像 */
  for (const re of [/"hiRes"\s*:\s*"(https:[^"]+?)"/gi,
                    /data-old-hires\s*=\s*["'](https:[^"']+?)["']/gi,
                    /"large"\s*:\s*"(https:[^"]+?)"/gi]) {
    for (const m of html.matchAll(re)) push(m[1], 100000);
  }
  /* テキスト中の images/I/ を全部拾う。URLに入っているサイズ指定を目安に順位を付ける */
  for (const m of html.matchAll(/https:(?:\\?\/){2}m\.media-amazon\.com(?:\\?\/)images(?:\\?\/)I(?:\\?\/)([A-Za-z0-9%+-]+)((?:\._[A-Za-z0-9,_-]+)*)\.(jpg|jpeg|png|webp)/gi)) {
    const id = m[1], mod = m[2] || "";
    const size = Math.max(0, ...[...mod.matchAll(/_(?:S[LXY]|U[LXY])(\d{2,4})_/gi)].map((x) => +x[1]));
    push(`https://m.media-amazon.com/images/I/${id}._AC_SL1500_.${m[3]}`, size || 1);
    push(`https://m.media-amazon.com/images/I/${id}.${m[3]}`, (size || 1) - 1);
  }

  const seen = new Set();
  return out.sort((a, b) => b.score - a.score)
    .map((x) => x.u)
    .filter((u) => !seen.has(u) && seen.add(u))
    .slice(0, 10);
}

/* メタ情報サービス（JSONで画像URLを返す）。ページを自前で取れないときの本命 */
const UNFURL_APIS = [
  "https://api.microlink.io/?url={url}&meta=true",
];
async function unfurlImages(url, log = () => {}) {
  for (const tpl of UNFURL_APIS) {
    const via = (() => { try { return new URL(tpl.replace("{url}", "")).hostname; } catch { return tpl; } })();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(tpl.replace("{url}", encodeURIComponent(url)), { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) { log("メタ情報", `${via} → HTTP ${res.status}`); continue; }
      const j = await res.json();
      const raw = [j?.data?.image?.url]
        .filter((x) => typeof x === "string" && /^https?:\/\//i.test(x));
      const cand = raw.filter((x) => !isJunkImage(x));
      if (!cand.length) {
        log("メタ情報", raw.length ? `${via} → 返ってきたのは商品画像ではない（ロゴなど）` : `${via} → 画像なし`);
        continue;
      }
      log("メタ情報", `${via} → 画像URLあり`);
      return cand;
    } catch (e) {
      log("メタ情報", `${via} → ${e.name === "AbortError" ? "タイムアウト" : "つながらない"}`);
    }
  }
  return [];
}

/* 中継サービス経由でページのHTMLを取り、商品画像 / og:image を拾う */
async function ogImages(url, log = () => {}) {
  const list = proxyList();
  if (!list.length) { log("ページ", "中継なしの設定のためスキップ"); return []; }

  for (const tpl of list) {
    const via = (() => { try { return new URL(tpl.replace("{url}", "")).hostname; } catch { return tpl; } })();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 9000);
      const res = await fetch(tpl.replace("{url}", encodeURIComponent(url)), { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) { log("ページ", `${via} → HTTP ${res.status}`); continue; }

      const html = (await res.text()).slice(0, 900000);
      const tags = html.match(/<meta[^>]+>/gi) || [];
      const pick = (key) => {
        const t = tags.find((x) => new RegExp(`(?:property|name)\\s*=\\s*["']${key}["']`, "i").test(x));
        return t ? (t.match(/content\s*=\s*["']([^"']+)["']/i)?.[1] || "") : "";
      };
      const found = [
        ...(isAmazonUrl(url) ? amazonImagesFromHtml(html) : []),   // Amazonはページ内の商品画像を直接探す
        pick("og:image:secure_url"), pick("og:image"),
        pick("twitter:image"), pick("twitter:image:src"),
      ].filter(Boolean).map((src) => {
        src = src.replace(/&amp;/g, "&").trim();
        if (src.startsWith("//")) return "https:" + src;
        if (src.startsWith("/")) { try { return new URL(src, url).href; } catch { return ""; } }
        return src;
      }).filter((x) => /^https?:\/\//i.test(x) && !isJunkImage(x));

      if (!found.length) { log("ページ", `${via} → 取れたが商品画像が見つからない`); continue; }
      log("ページ", `${via} → 画像候補 ${new Set(found).size} 件`);
      return [...new Set(found)];
    } catch (e) {
      log("ページ", `${via} → ${e.name === "AbortError" ? "タイムアウト" : "つながらない"}`);
    }
  }
  return [];
}

/* 商品URLからメイン画像を1つ決める。
   Amazonウィジェット → 楽天API → メタ情報サービス → 中継してページを読む、の順に試す。 */
async function guessImage(url, log = () => {}) {
  if (!url) return "";
  const target = canonicalUrl(url);
  if (target !== url) log("URL", `ASINだけの形に直して照会: ${target}`);

  const amazon = imageCandidates(url);                 // 1) Amazon（URLのASINだけで完結）
  if (amazon.length) {
    const label = (c) => {
      const m = c.match(/[?&]tag=([^&]*)/);
      if (m) return `ウィジェット ${new URL(c).hostname.split(".")[0]} tag=${m[1] || "なし"}`;
      return "旧パターン " + (c.match(/\.(\d\d)\./) || [, "?"])[1];
    };
    for (const c of amazon) {
      const hit = await probeImage(c);
      log("Amazon", `${label(c)} → ${hit ? "画像あり" : "だめ"}`);
      if (hit) { log("結果", "Amazonの候補を採用"); return hit; }
    }
    log("Amazon", cfg.amazonTag
      ? "ASINからの候補では画像が読めない"
      : "ASINからの候補では画像が読めない（設定にアソシエイトタグを入れると通りやすくなります）");
  }

  for (const c of await rakutenImages(url, log)) {     // 2) 楽天ウェブサービス
    if (await probeImage(c)) { log("結果", "楽天APIの画像を採用"); return c; }
  }

  /* Amazonは中継でページを読むほうが当たるので先に。それ以外はメタ情報サービスを先に。 */
  const fromPage = async () => {
    const cand = await ogImages(target, log);
    for (const c of cand) {
      if (await probeImage(c)) { log("結果", "ページから拾った画像を採用"); return c; }
    }
    if (cand.length) log("ページ", `候補 ${cand.length} 件すべて画像として読めず`);
    return "";
  };
  const fromMeta = async () => {
    for (const c of await unfurlImages(target, log)) {
      if (await probeImage(c)) { log("結果", "メタ情報サービスの画像を採用"); return c; }
    }
    return "";
  };
  const steps = isAmazonUrl(url) ? [fromPage, fromMeta] : [fromMeta, fromPage];
  for (const step of steps) {
    const hit = await step();
    if (hit) return hit;
  }
  log("結果", "画像が見つかりませんでした");
  return "";
}

/* =========================================================
   データ
   ========================================================= */
function emptyData() {
  return {
    version: 3,
    updatedAt: "",
    labels: normLabels(null),
    sections: Object.fromEntries(SECTIONS.map((s) => [s.key, { items: [] }])),
  };
}
const itemsOf = (key) => (data.sections[key] ||= { items: [] }).items;

function normRank(it) {
  return {
    id:        it.id || uid(),
    name:      it.name || "",
    category:  it.category || "未分類",
    image:     it.image || "",              // アイキャッチ画像URL
    url:       it.url || "",
    urlAmazon: it.urlAmazon || "",        // Amazon側のURL
    urlRakuten: it.urlRakuten || "",      // 楽天側のURL
    checkNote: it.checkNote || "",          // 確認内容
    checkedAt: ymd(it.checkedAt) || "",     // 最終確認日 (YYYY-MM-DD)
    picks: (Array.isArray(it.picks) ? it.picks : [])
      .map((p) => ({
        id:      p.id || uid(),
        addedAt: ymd(p.addedAt) || today(),        // 追加日
        urlAmazon:    p.urlAmazon || "",
        urlRakuten:   p.urlRakuten || "",
        imageAmazon:  p.imageAmazon || "",
        imageRakuten: p.imageRakuten || "",
        image:   p.image || "",                    // 旧形式（移行に使う）
        url:     p.url || "",                      // 同上
        title:   p.title || p.note || p.name || "", // 商品名（旧 note / name から移行）
        check:   ST_DEF("check").opts.some((o) => o.v === p.check) ? p.check : "before",
        buy:     ST_DEF("buy").opts.some((o) => o.v === p.buy)     ? p.buy   : "before",
        sales30: p.sales30 == null ? "" : String(p.sales30),      // 30日販売数（自由入力）
        rival:   ST_DEF("rival").opts.some((o) => o.v === p.rival) ? p.rival : "",
      })),
    createdAt: it.createdAt || nowIso(),
    updatedAt: it.updatedAt || it.createdAt || nowIso(),
  };
}

/* v1/v2 の型番商品（model + links[]）を共通形式へ */
function fromLegacyProduct(it) {
  const links = Array.isArray(it.links) ? it.links : [];
  const day = ymd(it.createdAt) || today();
  return normRank({
    id: it.id,
    name: [it.model, it.name].filter(Boolean).join("  "),
    category: it.category,
    url: links[0]?.url || "",
    picks: links.slice(1).map((l) => ({ addedAt: day, url: l.url, note: l.label || "" })),
    createdAt: it.createdAt,
    updatedAt: it.updatedAt,
  });
}
const isLegacyProduct = (it) => it && (it.model !== undefined || Array.isArray(it.links));

/* 旧形式の単一 url を、そのタブの1本目のURL項目へ移す */
/* 旧形式の商品（url / image が1本）を Amazon側・楽天側へ振り分ける */
function migratePicks(item, sectionKey) {
  item.picks = item.picks.map((p) => {
    if (p.url) {
      const s = PSIDE(urlSideOf(p.url, sectionKey));
      if (!p[s.url]) p[s.url] = p.url;
      if (p.image && !p[s.img]) p[s.img] = p.image;
    }
    delete p.url; delete p.image;
    return p;
  }).filter((p) => p.urlAmazon || p.urlRakuten);
  return item;
}

function migrateUrl(x, fields) {
  if (x.url && !fields.includes("url") && !fields.some((f) => x[f])) {
    x[fields[0]] = x.url;
    x.url = "";
  }
  return x;
}

function normalize(d) {
  const out = emptyData();
  out.updatedAt = d?.updatedAt || "";
  out.labels = normLabels(d?.labels);
  const s = d?.sections || {};
  // v1（items が直下）からの移行
  const legacy = Array.isArray(d?.items) ? d.items : null;
  for (const sec of SECTIONS) {
    const raw = sec.key === "products"
      ? (legacy || s.products?.items || [])
      : (s[sec.key]?.items || []);
    const fields = sec.urlFields || ["url"];
    out.sections[sec.key].items = raw
      .map((it) => (isLegacyProduct(it) ? fromLegacyProduct(it) : normRank(it)))
      .map((x) => migrateUrl(x, fields))
      .map((x) => migratePicks(x, sec.key))
      .filter((x) => fields.some((f) => x[f]) || (sec.key === "products" && x.name));
  }
  return out;
}

function loadCfg() {
  try {
    const raw = localStorage.getItem(LS_CFG);
    if (raw) cfg = Object.assign(cfg, JSON.parse(raw));
  } catch { /* noop */ }
  if (!cfg.branch) cfg.branch = "main";
  if (cfg.autoSave === undefined) cfg.autoSave = true;
}
function saveCfg() { localStorage.setItem(LS_CFG, JSON.stringify(cfg)); }

function loadCols() {
  try { colW = JSON.parse(localStorage.getItem(LS_COLS)) || {}; } catch { colW = {}; }
}
function saveCols() { localStorage.setItem(LS_COLS, JSON.stringify(colW)); }

/* 並べ替えの指定（手動並びを含む）はブラウザに残す */
function loadSort() {
  try {
    const o = JSON.parse(localStorage.getItem(LS_SORT)) || {};
    for (const k of Object.keys(filters)) if (o[k]) Object.assign(filters[k], o[k]);
  } catch { /* noop */ }
}
function saveSort() {
  localStorage.setItem(LS_SORT, JSON.stringify(
    Object.fromEntries(Object.entries(filters).map(([k, v]) => [k, { sort: v.sort, dir: v.dir }]))));
}
const colWidth = (c) => colW[c.key] || c.w;
/* 表編集中は画像URL欄が入るので画像列を広げる */
const effWidth = (c) => (tableEdit && c.key === "img" ? Math.max(colWidth(c), 170) : colWidth(c));

/* stamp=false のときは updatedAt を触らない（GitHubから読んだ内容をそのまま控える用） */
function persistLocal(stamp = true) {
  if (stamp) data.updatedAt = nowIso();
  localStorage.setItem(LS_DATA, JSON.stringify(data));
}
/* 中身の総数。うっかり全消しを検知するための目安 */
const totalCount = () =>
  SECTIONS.reduce((t, s) => t + itemsOf(s.key).length, 0) + pickTotal();
function loadLocal() {
  for (const key of [LS_DATA, "kata_data_v1"]) {          // 旧キーからも拾う
    try {
      const raw = localStorage.getItem(key);
      if (raw) return normalize(JSON.parse(raw));
    } catch { /* noop */ }
  }
  return null;
}

/* =========================================================
   自動保存
   手が止まって AUTO_IDLE ms、または触り続けていても AUTO_MAX ms で保存する。
   タブを閉じる/裏に回すときにも保存を試みる。
   ========================================================= */
const AUTO_IDLE = 4000;
const AUTO_MAX  = 60000;
let autoTimer = null;   // 予約中のタイマー
let dirtySince = 0;     // 最初に汚れた時刻
let saving = false;     // 保存中
let saveAgain = false;  // 保存中にさらに変更された
let savedAt = "";       // 最後に保存できた時刻 HH:MM
let saveErr = "";       // 直近の保存エラー
let saveFails = 0;      // 連続失敗回数（一時的な不調に備えて数回だけ再試行する）
let booting = true;     // 起動中（GitHubと突き合わせるまで保存させない）
let remoteCount = null; // 最後にGitHubから読んだときの件数（消し飛ばし防止の目安）
const RETRY_WAIT = 30000;
const RETRY_MAX  = 5;

const canSave = () => cfgReady() && Boolean(cfg.pat);

function markDirty(v) {
  dirty = v;
  if (v) {
    saveErr = ""; saveFails = 0;
    if (!dirtySince) dirtySince = Date.now();
    scheduleAutoSave();
  } else {
    dirtySince = 0;
    clearTimeout(autoTimer); autoTimer = null;
  }
  renderSaveState();
}

function scheduleAutoSave() {
  if (booting || !cfg.autoSave || !canSave() || saving) return;
  clearTimeout(autoTimer);
  const capLeft = dirtySince + AUTO_MAX - Date.now();
  autoTimer = setTimeout(() => saveToGitHub(true), Math.max(0, Math.min(AUTO_IDLE, capLeft)));
}

function renderSaveState() {
  const el = $("saveState");
  let cls = "dirty-badge", txt = "";
  if (saving)        { cls += " is-saving"; txt = "⟳ 保存中…"; }
  else if (saveErr)  {
    cls += " is-err";
    txt = saveErr.startsWith("件数が") ? "⚠ 保存を止めました（クリックで確認）" : "⚠ 保存できず（クリックで再試行）";
  }
  else if (dirty)    { txt = cfg.autoSave && canSave() ? "● 未保存（まもなく保存）" : "● 未保存"; }
  else if (savedAt)  { cls += " is-saved";  txt = `✓ ${savedAt} 保存済み`; }
  el.className = cls;
  el.textContent = txt;
  el.hidden = !txt;
  el.title = saveErr || "";
}

/* =========================================================
   ヘッダー
   ========================================================= */
function renderNav() {
  $("gnav").innerHTML = SECTIONS.map((s) => `
    <button class="gnav-item${view === s.key ? " on" : ""}" data-k="${s.key}">
      <span class="gnav-ico">${s.icon}</span>${esc(s.label)}
      <span class="gnav-cnt">${isAdded(s.key) ? pickTotal() : itemsOf(s.key).length}</span>
    </button>`).join("");
  $("gnav").querySelectorAll(".gnav-item").forEach((b) => {
    b.onclick = () => { view = b.dataset.k; renderAll(); };
  });
}

function renderHeadBits() {
  $("repoBadge").textContent = cfg.owner && cfg.repo ? `${cfg.owner}/${cfg.repo}` : "未設定";
  $("repoBadge").classList.toggle("unset", !(cfg.owner && cfg.repo));
  $("verLabel").textContent = "v" + VERSION;
}

function categories(key) {
  return Array.from(new Set(itemsOf(key).map((i) => i.category || "未分類")))
    .sort((a, b) => a.localeCompare(b, "ja"));
}

function renderToolbar() {
  const s = SEC(view);
  $("q").placeholder = s.search;
  $("q").value = F().q;
  $("btnNew").textContent = s.add;
  $("btnNew").hidden      = Boolean(s.kind === "added");     // 商品は各行の「＋ 商品」から追加する
  $("btnEditMode").hidden = Boolean(s.kind === "added");

  const seg = (k, label, cnt, on) =>
    `<button class="seg-btn${on ? " on" : ""}" data-k="${esc(k)}">${esc(label)}<span class="seg-cnt">${cnt}</span></button>`;

  if (s.kind === "added") {                                  // 出所（どのタブから追加したか）で絞る
    const rows = allPicks();
    const srcs = SECTIONS.filter((x) => !isAdded(x.key));
    $("catSeg").innerHTML =
      seg("*", "すべて", rows.length, F().cat === "*") +
      srcs.map((x) => seg(x.key, x.label, rows.filter((r) => r.sec === x.key).length, F().cat === x.key)).join("");
    $("catSeg").querySelectorAll(".seg-btn").forEach((b) => {
      b.onclick = () => { F().cat = b.dataset.k; renderToolbar(); renderBody(); };
    });
    return;
  }

  const cats = categories(view);
  $("catSeg").innerHTML = cats.length < 2 ? "" :
    seg("*", "すべて", itemsOf(view).length, F().cat === "*") +
    cats.map((c) => seg(c, c, itemsOf(view).filter((i) => (i.category || "未分類") === c).length, F().cat === c)).join("");
  $("catSeg").querySelectorAll(".seg-btn").forEach((b) => {
    b.onclick = () => { F().cat = b.dataset.k; renderToolbar(); renderBody(); };
  });

  $("rankCatList").innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join("");
}

/* 画像は裏で取りにいく。取れたらその行だけ差し替える */
async function fetchPickImage(sectionKey, itemId, pickId, side) {
  const sd = PSIDE(side);
  const key = `${itemId}|${pickId}|${sd.k}`;
  if (imgBusy.has(key)) return;
  const at0 = locatePick(`${itemId}|${pickId}`);
  const url = at0?.p[sd.url];
  if (!url) return;

  imgBusy.add(key);
  paintPickThumb(key);

  let found = "";
  try { found = await guessImage(url); } catch { /* noop */ }
  imgBusy.delete(key);

  const at = locatePick(`${itemId}|${pickId}`);
  if (!at) return;                      // 取得中に消された
  if (found && !at.p[sd.img]) {
    at.p[sd.img] = found;
    at.it.updatedAt = nowIso();
    persistLocal(); markDirty(true);
  }
  paintPickThumb(key);
}

/* 画像セルだけを描き直す（入力中のフォーカスを飛ばさないため） */
function paintPickThumb(key) {
  const cell = $("list").querySelector(`[data-pickimg="${CSS.escape(key)}"]`);
  if (!cell) return;
  const [itemId, pickId, side] = key.split("|");
  const at = locatePick(`${itemId}|${pickId}`);
  if (at) cell.innerHTML = pickThumb(at.it.id, at.p, side);
}

/* =========================================================
   一覧
   ========================================================= */
function visibleItems() {
  const q = F().q.trim().toLowerCase();
  const list = itemsOf(view)
    .filter((it) => {
      if (F().cat !== "*" && (it.category || "未分類") !== F().cat) return false;
      if (!q) return true;
      const hay = [it.name, it.category, it.url, it.urlAmazon, it.urlRakuten, it.checkNote,
                   it.picks.map((p) => [p.title, p.urlAmazon, p.urlRakuten].join(" ")).join(" ")].join(" ");
      return hay.toLowerCase().includes(q);
    });
  const sorted = F().sort === "manual" ? list : list.sort(comparator());
  if (!pinned.size) return sorted;
  const pin = [], rest = [];                      // 新しく登録した行はどの並びでも一番上
  for (const x of sorted) (pinned.has(x.id) ? pin : rest).push(x);
  pin.sort((a, b) => pinned.get(b.id) - pinned.get(a.id));
  return [...pin, ...rest];
}

/* 「追加した商品」ビュー：絞り込み後、追加日の新しい順 */
function visiblePicks() {
  const q = F().q.trim().toLowerCase();
  return allPicks()
    .filter((r) => {
      if (F().cat !== "*" && r.sec !== F().cat) return false;
      if (!q) return true;
      const hay = [r.p.title, r.p.urlAmazon, r.p.urlRakuten, r.p.sales30,
                   r.item.name, r.item.category, SEC(r.sec).label].join(" ");
      return hay.toLowerCase().includes(q);
    })
    .sort((a, b) => (b.p.addedAt || "").localeCompare(a.p.addedAt || ""));
}

/* 並べ替え。列見出しクリックで key/dir が切り替わる */
function comparator() {
  const { sort, dir } = F();
  const sgn = dir === "asc" ? 1 : -1;
  const val = (it) => {
    switch (sort) {
      case "name":      return it.name || it.model || "";
      case "model":     return it.model || "";
      case "category":  return it.category || "";
      case "checkedAt": return it.checkedAt || "";
      case "picks":     return String((it.picks || []).length).padStart(6, "0");
      case "links":     return String((it.links || []).length).padStart(6, "0");
      default:          return it.updatedAt || "";
    }
  };
  return (a, b) => sgn * String(val(a)).localeCompare(String(val(b)), "ja", { numeric: true });
}

function setSort(key) {
  pinned.clear();                                 // 自分で並べ替えたら新着の固定は解除
  const f = F();
  if (key === "manual") {
    if (f.sort === "manual") { f.sort = SEC(view).defSort || "checkedAt"; f.dir = "desc"; }
    else { data.sections[view].items = itemsOf(view).slice().sort(comparator()); f.sort = "manual"; persistLocal(); }
    saveSort(); renderBody();
    return;
  }
  if (f.sort === key) f.dir = f.dir === "asc" ? "desc" : "asc";
  else { f.sort = key; f.dir = key === "checkedAt" || key === "updatedAt" ? "desc" : "asc"; }
  saveSort(); renderBody();
}

/* ↑↓ で行を1つ動かす。自動並べ替え中なら、今見えている順を確定してから手動並びに切り替える */
function moveRow(id, delta) {
  pinned.clear();                                 // 手で動かし始めたら新着の固定は解除
  const vis = visibleItems();
  const i = vis.findIndex((x) => x.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= vis.length) return;

  if (F().sort !== "manual") {
    data.sections[view].items = itemsOf(view).slice().sort(comparator());
    F().sort = "manual";
    saveSort();
    toast("手動の並びに切り替えました（列見出しを押すと自動に戻ります）");
  }
  const arr = itemsOf(view);
  const a = arr.findIndex((x) => x.id === vis[i].id);
  const b = arr.findIndex((x) => x.id === vis[j].id);
  [arr[a], arr[b]] = [arr[b], arr[a]];
  persistLocal(); markDirty(true); renderBody();
}
function sortMark(key) {
  const f = F();
  return f.sort === key ? `<span class="sort-mark">${f.dir === "asc" ? "▲" : "▼"}</span>` : "";
}
function th(key, label, cls) {
  return `<th class="${cls} sortable${F().sort === key ? " on" : ""}" data-sort="${key}">${esc(label)}${sortMark(key)}</th>`;
}

function renderBody() {
  const s = SEC(view);
  const added = s.kind === "added";
  const list  = added ? visiblePicks() : visibleItems();
  const total = added ? pickTotal() : itemsOf(view).length;

  $("countLabel").textContent = total ? `${list.length} / ${total} 件` : "";
  $("emptyState").hidden = list.length > 0;
  $("emptyTtl").textContent = total ? "条件に合うものがありません" : s.emptyTtl;
  $("emptySub").textContent = total
    ? (added ? "検索語や出所の絞り込みを外してみてください。" : "検索語やカテゴリの絞り込みを外してみてください。")
    : s.emptySub;

  $("list").innerHTML = added ? addedTable(list) : rankTable(list);

  const root = $("list");
  root.querySelectorAll("th.sortable").forEach((h) => {
    h.onclick = () => setSort(h.dataset.sort);
  });
  bindResizers(root);
  fitColumns();
  root.querySelectorAll("[data-f]").forEach((inp) => {
    const commit = () => {
      const it = itemsOf(view).find((i) => i.id === inp.dataset.id);
      if (!it) return;
      const f = inp.dataset.f;
      const v = inp.value.trim();
      const urlFs = urlFieldsOf(view);
      if (urlFs.includes(f) && !v && !urlFs.some((x) => x !== f && it[x])) {
        inp.value = it[f]; toast("URLをすべて空にはできません", true); return;
      }
      it[f] = f === "category" ? (v || "未分類") : v;
      it.updatedAt = nowIso();
      persistLocal(); markDirty(true);
      if (f === "category") renderToolbar();
    };
    inp.onchange = commit;
    if (inp.dataset.f === "image") {
      inp.oninput = () => {
        const cell = inp.closest("td");
        const old = cell.querySelector(".thumb");
        const html = thumbTag(inp.value.trim(), "eyecatch", inp.dataset.id);
        old.outerHTML = html;
      };
    }
  });
  // 画像なしのサムネ：押すともう一度取りにいく
  root.querySelectorAll("[data-pickretry]").forEach((b) => {
    b.onclick = () => {
      const [itemId, pickId, side] = b.dataset.pickretry.split("|");
      const at = locatePick(`${itemId}|${pickId}`);
      if (at) fetchPickImage(at.sec, at.it.id, at.p.id, side);
    };
  });
  // 並び：↑↓ で1つずつ動かす
  root.querySelectorAll("[data-move]").forEach((b) => {
    b.onclick = () => {
      const [id, dir] = b.dataset.move.split("|");
      moveRow(id, dir === "up" ? -1 : 1);
    };
  });
  // 区分：選び直すとその区分のタブへ行が移る
  root.querySelectorAll("[data-side]").forEach((sel) => {
    sel.onchange = () => {
      const from = view;
      const to   = sideSecOf(sel.value);
      const it   = itemsOf(from).find((i) => i.id === sel.dataset.side);
      if (!it || to === from) return;
      moveItem(it, from, to);
    };
  });
  root.querySelectorAll("[data-del]").forEach((b) => {
    b.onclick = () => {
      const it = itemsOf(view).find((i) => i.id === b.dataset.del);
      if (!confirm(`「${it.name}」を削除します。よろしいですか？`)) return;
      removeById(view, it.id);
      toast("削除しました");
    };
  });
  root.querySelectorAll("[data-addpick]").forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.addpick;
      openRows.add(id);
      addRows.add(id);
      renderBody();
      setTimeout(() => {
        const row = $("list").querySelector(`tr.pick-new[data-for="${id}"]`);
        if (row) {
          row.querySelector(".pick-url").focus();
          row.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      }, 30);
    };
  });
  root.querySelectorAll("[data-expand]").forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.expand;
      if (openRows.has(id)) { openRows.delete(id); addRows.delete(id); }
      else openRows.add(id);
      renderBody();
    };
  });
  root.querySelectorAll("[data-edit]").forEach((b) => {
    b.onclick = () => openRank(itemsOf(view).find((i) => i.id === b.dataset.edit));
  });
  // 確認日：直接入力
  root.querySelectorAll("[data-checkdate]").forEach((inp) => {
    inp.onchange = () => {
      const it = itemsOf(view).find((i) => i.id === inp.dataset.checkdate);
      it.checkedAt = inp.value || "";
      it.updatedAt = nowIso();
      upsert(view, it);
    };
  });
  // 確認日：本日反映
  root.querySelectorAll("[data-today]").forEach((b) => {
    b.onclick = () => {
      const it = itemsOf(view).find((i) => i.id === b.dataset.today);
      it.checkedAt = today();
      it.updatedAt = nowIso();
      upsert(view, it);
      toast("確認日を今日にしました");
    };
  });

  // 商品欄を閉じる
  root.querySelectorAll("[data-rowclose]").forEach((b) => {
    b.onclick = () => { const id = b.dataset.rowclose; openRows.delete(id); addRows.delete(id); renderBody(); };
  });

  /* 常設の入力行（表の1行目）から追加 */
  root.querySelectorAll("tr.pick-new").forEach((row) => {
    const id  = row.dataset.for;
    const add = async () => {
      const url = row.querySelector(".pick-url").value.trim();
      if (!url) { toast("商品URLを入力してください", true); row.querySelector(".pick-url").focus(); return; }
      const it = itemsOf(view).find((i) => i.id === id);
      const sd = PSIDE(sideKeyOf(view));                 // このタブのモール側に入れる
      const image = row.querySelector(".pick-image").value.trim();
      const pickId = uid();
      it.picks.unshift({
        id:      pickId,
        addedAt: row.querySelector(".pick-added").value || today(),
        title:   row.querySelector(".pick-title").value.trim(),
        urlAmazon: "", urlRakuten: "", imageAmazon: "", imageRakuten: "",
        [sd.url]: url,
        [sd.img]: image,
        sales30: "", rival: "",
        check:   "before",
        buy:     "before",
      });
      it.updatedAt = nowIso();
      const sec = view;
      upsert(sec, it);                                   // 追加はここで完了。待たせない
      toast(image ? "商品を追加しました" : "商品を追加しました（画像は裏で取得します）");
      if (!image) fetchPickImage(sec, id, pickId, sd.k); // 画像は裏で取りにいく
      setTimeout(() => {
        const next = $("list").querySelector(`tr.pick-new[data-for="${id}"] .pick-url`);
        if (next) next.focus();
      }, 30);
    };
    row.querySelector(".pick-add").onclick = add;
    row.querySelectorAll("input").forEach((inp) => {
      inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } };
    });
  });

  root.querySelectorAll("[data-pickdel]").forEach((b) => {
    b.onclick = () => {
      const at = locatePick(b.dataset.pickdel);
      if (!at) return;
      at.it.picks = at.it.picks.filter((x) => x.id !== at.p.id);
      at.it.updatedAt = nowIso();
      editPicks.delete(b.dataset.pickdel);
      upsert(at.sec, at.it);
    };
  });

  root.querySelectorAll("[data-picksales]").forEach((inp) => {
    inp.onchange = () => {
      const at = locatePick(inp.dataset.picksales);
      if (!at) return;
      at.p.sales30 = inp.value.trim();
      at.it.updatedAt = nowIso();
      persistLocal(); markDirty(true);
    };
  });
  root.querySelectorAll("[data-pickstatus]").forEach((sel) => {
    const [id, pid, field] = sel.dataset.pickstatus.split("|");
    sel.onchange = () => {
      const at = locatePick(`${id}|${pid}`);
      if (!at) return;
      const { it, p } = at;
      p[field] = sel.value;
      it.updatedAt = nowIso();
      persistLocal(); markDirty(true);
      sel.className = "st-sel " + stCls(stList(field), sel.value);
    };
  });
  root.querySelectorAll("[data-pickedit]").forEach((b) => {
    b.onclick = () => { editPicks.add(b.dataset.pickedit); renderBody(); };
  });
  root.querySelectorAll("[data-pickcancel]").forEach((b) => {
    b.onclick = () => { editPicks.delete(b.dataset.pickcancel); renderBody(); };
  });
  root.querySelectorAll("[data-picksave]").forEach((b) => {
    const key = b.dataset.picksave;
    const row = root.querySelector(`.pick-editing[data-row="${key}"]`);
    const save = async () => {
      const at = locatePick(key);
      if (!at) return;
      const { it, p, sec } = at;
      const val = (sel) => { const el = row.querySelector(sel); return el ? el.value.trim() : null; };
      const both = Boolean(row.querySelector(".pe-url2"));       // 追加した商品ビューは両モール
      const sd = PSIDE(sideKeyOf(sec));

      const next = both
        ? { urlAmazon: val(".pe-url"), urlRakuten: val(".pe-url2"),
            imageAmazon: val(".pe-image"), imageRakuten: val(".pe-image2") }
        : { [sd.url]: val(".pe-url"), [sd.img]: val(".pe-image") };

      const after = { ...p, ...next };
      if (!after.urlAmazon && !after.urlRakuten) { toast("URLを空にはできません", true); return; }

      Object.assign(p, next);
      p.addedAt = val(".pe-date") || p.addedAt;
      const t = val(".pe-title"); if (t !== null) p.title = t;
      const sIn = val(".pe-sales"); if (sIn !== null) p.sales30 = sIn;
      it.updatedAt = nowIso();
      editPicks.delete(key);

      /* URLがあって画像が空のモールは、裏で取りにいく */
      const need = PICK_SIDES.filter((x) => p[x.url] && !p[x.img]);
      upsert(sec, it);
      toast(need.length ? "商品を更新しました（画像は裏で取得します）" : "商品を更新しました");
      need.forEach((x) => fetchPickImage(sec, it.id, p.id, x.k));
    };
    b.onclick = save;
    row.querySelectorAll("input").forEach((inp) => {
      inp.onkeydown = (e) => {
        if (e.key === "Enter")  { e.preventDefault(); save(); }
        if (e.key === "Escape") { e.preventDefault(); editPicks.delete(key); renderBody(); }
      };
    });
  });
}

/* ===== ランキング一覧（表） ===== */
function rankTable(list) {
  if (!list.length) return "";
  const COLS = colsOf(view);
  const cols = COLS.map((c) => {
    const w = effWidth(c);
    return `<col data-col="${c.key}"${w ? ` style="width:${w}px"` : ""}>`;
  }).join("");
  const heads = COLS.map((c) => {
    if (c.key === "ord") {
      const on = F().sort === "manual";
      return `<th class="c-ord sortable${on ? " on" : ""}" data-sort="manual" ` +
        `title="↑↓ で手動並べ替え。押すと手動⇔自動を切り替えます">${esc(c.label)}` +
        `${on ? '<span class="sort-mark">手動</span>' : ""}<span class="col-resizer" data-col="ord"></span></th>`;
    }
    const on = c.sort && F().sort === c.sort;
    const label = c.key === "name" ? SEC(view).nameLabel : c.label;
    return `<th class="${c.cls}${c.sort ? " sortable" : ""}${on ? " on" : ""}"${c.sort ? ` data-sort="${c.sort}"` : ""}>` +
      `${esc(label)}${c.sort ? sortMark(c.sort) : ""}` +
      `<span class="col-resizer" data-col="${c.key}"></span></th>`;
  }).join("");

  /* 行の高さに収まる行数だけ、ジャンル名を折り返して見せる */
  const nameLines = Math.max(1, Math.floor((rowH() - 16) / 19));
  return `<div class="tbl-wrap"><table class="grid-tbl rank-tbl${tableEdit ? " editing" : ""}" style="--row-h:${rowH()}px;--name-lines:${nameLines}">
    <colgroup>${cols}</colgroup>
    <thead><tr>${heads}</tr></thead>
    <tbody>${list.map(rankRow).join("")}</tbody>
  </table></div>`;
}

/* ===== 追加した商品（全タブ横断・追加日ごと） ===== */
function addedTable(rows) {
  if (!rows.length) return "";

  const cols = ADDED_COLS.map((c) => {
    const w = colW[c.key] || c.w;
    return `<col data-col="${c.key}"${w ? ` style="width:${w}px"` : ""}>`;
  }).join("");
  const heads = ADDED_COLS.map((c) =>
    `<th class="${c.cls}">${esc(c.label)}<span class="col-resizer" data-col="${c.key}"></span></th>`).join("");

  /* 追加日ごとにまとめる */
  const groups = [];
  for (const r of rows) {
    const day = r.p.addedAt || "日付なし";
    if (!groups.length || groups.at(-1).day !== day) groups.push({ day, list: [] });
    groups.at(-1).list.push(r);
  }

  const body = groups.map((g) => {
    const d = daysSince(g.day);
    const rel = d === 0 ? "今日" : d === 1 ? "昨日" : d > 1 ? `${d}日前` : "";
    return `<tr class="day-row"><td class="day-cell" colspan="${ADDED_COLS.length}">
        <span class="day-date">${esc(g.day)}</span>
        ${rel ? `<span class="day-rel">${esc(rel)}</span>` : ""}
        <span class="day-cnt">${g.list.length} 件</span>
      </td></tr>` + g.list.map(addedRow).join("");
  }).join("");

  return `<div class="tbl-wrap"><table class="grid-tbl pick-tbl added-tbl" style="--pick-row-h:${pRowH()}px">
    <colgroup>${cols}</colgroup>
    <thead><tr>${heads}</tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}

function addedRow(r) {
  const { sec, item: it, p } = r;
  const key = `${it.id}|${p.id}`;
  const side = SEC(sec).side;

  const srcCell = `<td class="td-src">
      ${side ? `<span class="src-side ${SIDE(side).cls}">${esc(SIDE(side).label)}</span>` : ""}
      <a class="src-name" href="${esc(mainUrl(it, sec))}" target="_blank" rel="noopener noreferrer"
         title="${esc(it.name)}">${esc(it.name)}</a>
    </td>`;

  const imgCell = (sd) =>
    `<td class="td-img" data-pickimg="${esc(key)}|${sd.k}">${pickThumb(it.id, p, sd.k)}</td>`;
  const urlCell = (sd) => {
    const v = p[sd.url];
    return `<td class="td-url">${v
      ? `<a href="${esc(v)}" target="_blank" rel="noopener noreferrer" title="${esc(v)}">${esc(prettyUrl(v, 52))}</a>`
      : '<span class="dash">—</span>'}</td>`;
  };

  const salesCell = `<td class="td-sales">
      <input class="sales-in" type="text" inputmode="numeric" value="${esc(p.sales30)}"
             data-picksales="${esc(key)}" placeholder="—" title="30日販売数">
    </td>`;
  const rivalCell = `<td class="td-rival">
      <select class="st-sel ${stCls(stList("rival"), p.rival)}" data-pickstatus="${esc(it.id)}|${esc(p.id)}|rival">
        ${stOptions(stList("rival"), p.rival)}
      </select>
    </td>`;

  const [AMZ, RAK] = PICK_SIDES;

  if (editPicks.has(key)) return `
    <tr class="pick-editing" data-row="${esc(key)}">
      <td class="td-src"><input class="input-sm pe-date" type="date" value="${esc(p.addedAt)}" title="追加日"></td>
      <td class="td-img"><input class="input-sm pe-image" type="url" value="${esc(p.imageAmazon)}" placeholder="amazon画像"></td>
      <td class="td-img"><input class="input-sm pe-image2" type="url" value="${esc(p.imageRakuten)}" placeholder="楽天画像"></td>
      <td class="td-title"><input class="input-sm pe-title" type="text" value="${esc(p.title)}" placeholder="商品名"></td>
      <td class="td-url"><input class="input-sm pe-url" type="url" value="${esc(p.urlAmazon)}" placeholder="amazonURL"></td>
      <td class="td-url"><input class="input-sm pe-url2" type="url" value="${esc(p.urlRakuten)}" placeholder="楽天URL"></td>
      <td class="td-sales"><input class="input-sm pe-sales" type="text" inputmode="numeric" value="${esc(p.sales30)}" placeholder="30日販売数"></td>
      ${rivalCell}
      ${statusCells(it.id, p)}
      <td class="td-edit"><button class="btn btn-add btn-xs" data-picksave="${esc(key)}">保存</button></td>
      <td class="td-acts"><button class="icon-btn" data-pickcancel="${esc(key)}" title="やめる">↩</button></td>
    </tr>`;

  return `
    <tr>
      ${srcCell}
      ${imgCell(AMZ)}
      ${imgCell(RAK)}
      <td class="td-title${p.title ? "" : " none"}">${esc(p.title || "—")}</td>
      ${urlCell(AMZ)}
      ${urlCell(RAK)}
      ${salesCell}
      ${rivalCell}
      ${statusCells(it.id, p)}
      <td class="td-edit"><button class="btn btn-edit btn-xs" data-pickedit="${esc(key)}">編集</button></td>
      <td class="td-acts"><button class="icon-btn" data-pickdel="${esc(key)}" title="削除">✕</button></td>
    </tr>`;
}

/* 画面が狭いときは、はみ出さないよう全列を比率のまま縮める（横スクロールを出さない） */
function fitColumns() {
  const wrap = $("list").querySelector(".tbl-wrap");
  if (!wrap) return;
  const table = wrap.querySelector("table.rank-tbl");
  if (!table) return;

  const setW = (key, px) => {
    const col = table.querySelector(`col[data-col="${key}"]`);
    if (col) col.style.width = px ? px + "px" : "";
  };
  const COLS = colsOf(view);
  COLS.forEach((c) => setW(c.key, effWidth(c)));       // いったん素の幅に戻す

  const AUTO_MIN = 90;
  const fixed = COLS.filter((c) => effWidth(c));
  const autos = COLS.length - fixed.length;
  const sum   = fixed.reduce((t, c) => t + effWidth(c), 0);
  const avail = wrap.clientWidth - 2;
  if (sum + autos * AUTO_MIN <= avail) return;          // そのまま収まる

  const factor = Math.max(0.3, (avail - autos * AUTO_MIN) / sum);
  fixed.forEach((c) => setW(c.key, Math.max(40, Math.floor(effWidth(c) * factor))));
}

/* 列幅パネル（上部の「⇔ 幅調整」） */
function renderColPanel() {
  const item = (key, label, val, ph, cls) => `
    <label class="col-item${cls ? " " + cls : ""}">
      <span class="col-item-name">${esc(label)}</span>
      <input type="number" min="40" max="1200" step="4" data-colw="${key}" value="${val || ""}" placeholder="${ph || "自動"}">
      <span class="col-item-unit">px</span>
    </label>`;

  $("colPanelBody").innerHTML = `
    <div class="col-grp">
      <span class="col-grp-ttl">一覧表</span>
      <div class="col-grp-items">
        ${item(ROW_H_KEY, "行の高さ", rowH(), ROW_H_DEF, "row-h")}
        ${colsOf(view).map((c) => item(c.key, c.key === "name" ? SEC(view).nameLabel : c.label, colW[c.key] || c.w)).join("")}
      </div>
    </div>
    <div class="col-grp">
      <span class="col-grp-ttl">チェックした商品</span>
      <div class="col-grp-items">
        ${item(PROW_H_KEY, "行の高さ", pRowH(), PROW_H_DEF, "row-h")}
        ${PICK_COLS.map((c) => item(c.key, c.label, colW[c.key] || c.w)).join("")}
      </div>
    </div>`;

  $("colPanelBody").querySelectorAll("[data-colw]").forEach((inp) => {
    inp.oninput = () => {
      const key = inp.dataset.colw;
      const v = parseInt(inp.value, 10);
      if (Number.isFinite(v) && v >= 40) colW[key] = v; else delete colW[key];
      saveCols();
      renderBody();
    };
  });
}

function toggleColPanel(force) {
  const el = $("colPanel");
  const show = force !== undefined ? force : el.hidden;
  el.hidden = !show;
  $("btnCols").classList.toggle("on", show);
  if (show) renderColPanel();
}

/* 列幅ドラッグ */
function bindResizers(root) {
  root.querySelectorAll(".col-resizer").forEach((rz) => {
    rz.onclick = (e) => e.stopPropagation();
    rz.onmousedown = (e) => {
      e.preventDefault(); e.stopPropagation();
      const table = rz.closest("table");
      const col   = table.querySelector(`col[data-col="${rz.dataset.col}"]`);
      const startX = e.clientX;
      const startW = col.getBoundingClientRect().width;
      document.body.classList.add("resizing");
      rz.classList.add("dragging");

      const move = (ev) => {
        col.style.width = Math.max(44, Math.round(startW + ev.clientX - startX)) + "px";
      };
      const up = () => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        document.body.classList.remove("resizing");
        rz.classList.remove("dragging");
        colW[rz.dataset.col] = parseInt(col.style.width, 10);
        saveCols();
        const inp = document.querySelector(`[data-colw="${rz.dataset.col}"]`);
        if (inp) inp.value = colW[rz.dataset.col];
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    };
    // ダブルクリックで既定値に戻す
    rz.ondblclick = (e) => {
      e.stopPropagation();
      delete colW[rz.dataset.col];
      saveCols(); renderBody(); if (!$("colPanel").hidden) renderColPanel();
    };
  });
}

function rankRow(it, idx = 0, all = []) {
  const d = daysSince(it.checkedAt);
  const stale = d == null || d > STALE_DAYS;
  const open = openRows.has(it.id);
  const cols = colsOf(view);
  const head = mainUrl(it, view);

  const urlCell = (c) => {
    const v = it[c.field] || "";
    return tableEdit
      ? `<td class="c-url"><input class="cell-input mono" type="url" data-f="${c.field}" data-id="${esc(it.id)}" value="${esc(v)}" placeholder="${esc(c.label)}"></td>`
      : `<td class="c-url">${v
          ? `<a href="${esc(v)}" target="_blank" rel="noopener noreferrer" title="${esc(v)}">${esc(prettyUrl(v, 42))}</a>`
          : '<span class="dash">—</span>'}</td>`;
  };

  const cell = (c) => {
    switch (c.key) {
      case "ord": {
        const btn = (dir, mark, label, off) =>
          `<button class="ord-btn" data-move="${esc(it.id)}|${dir}" title="${label}"${off ? " disabled" : ""}>${mark}</button>`;
        return `<td class="c-ord">
            <span class="ord-cell">
              ${btn("up", "↑", "1つ上へ", idx === 0)}
              ${btn("down", "↓", "1つ下へ", idx >= all.length - 1)}
            </span>
          </td>`;
      }
      case "side": {
        const v = SEC(view).side;
        return `<td class="c-side">
            <select class="side-sel ${SIDE(v).cls}" data-side="${esc(it.id)}" title="選び直すとその区分のタブへ移ります">${sideOptions(v)}</select>
          </td>`;
      }
      case "img":
        return tableEdit
          ? `<td class="c-img">
               ${thumbTag(it.image, "eyecatch", it.id)}
               <input class="cell-input img-in" type="url" data-f="image" data-id="${esc(it.id)}" value="${esc(it.image)}" placeholder="画像URL">
             </td>`
          : `<td class="c-img">${thumbTag(it.image, "eyecatch")}</td>`;
      case "name":
        return tableEdit
          ? `<td class="c-name"><input class="cell-input" type="text" data-f="name" data-id="${esc(it.id)}" value="${esc(it.name)}"></td>`
          : `<td class="c-name">${head
              ? `<a class="r-name" href="${esc(head)}" target="_blank" rel="noopener noreferrer">${esc(it.name || hostOf(head))}</a>`
              : `<span class="r-name">${esc(it.name)}</span>`}</td>`;
      case "cat":
        return tableEdit
          ? `<td class="c-cat"><input class="cell-input" type="text" list="rankCatList" data-f="category" data-id="${esc(it.id)}" value="${esc(it.category)}"></td>`
          : `<td class="c-cat">${esc(it.category || "未分類")}</td>`;
      case "note":
        return tableEdit
          ? `<td class="c-note"><textarea class="cell-input cell-area" data-f="checkNote" data-id="${esc(it.id)}" rows="2">${esc(it.checkNote)}</textarea></td>`
          : `<td class="c-note" title="${esc(it.checkNote)}">${it.checkNote ? esc(it.checkNote) : '<span class="dash">—</span>'}</td>`;
      case "check":
        return `<td class="c-check">
            <span class="check-cell${stale ? " stale" : ""}">
              <input type="date" class="check-date" data-checkdate="${esc(it.id)}" value="${esc(it.checkedAt)}">
              <button class="btn btn-ghost btn-xs" data-today="${esc(it.id)}">本日反映</button>
            </span>
          </td>`;
      case "cnt":
        return `<td class="c-cnt">
            <button class="cnt-btn${open ? " on" : ""}" data-expand="${esc(it.id)}">${it.picks.length} 件表示 ${open ? "▲" : "▼"}</button>
          </td>`;
      case "addp":
        return `<td class="c-addp">
            <button class="btn btn-add btn-xs" data-addpick="${esc(it.id)}" title="この行に商品URLを追加">＋ 商品</button>
          </td>`;
      case "act":
        return tableEdit
          ? `<td class="c-act"><button class="btn btn-ghost btn-xs btn-danger" data-del="${esc(it.id)}">削除</button></td>`
          : `<td class="c-act"><button class="btn btn-ghost btn-xs" data-edit="${esc(it.id)}">編集</button></td>`;
      default:
        return urlCell(c);
    }
  };

  return `<tr class="r-main${open ? " open" : ""}${pinned.has(it.id) ? " is-new" : ""}">${cols.map(cell).join("")}</tr>
  ${open ? `<tr class="r-sub"><td colspan="${cols.length}">${pickPanel(it)}</td></tr>` : ""}`;
}

/* サムネのURLから、できるだけ大きい版を組み立てる */
function bigImageUrl(u) {
  let v = String(u || "");
  v = v.replace(/(\/images\/I\/[^./]+)\.[^/]*\.(jpg|jpeg|png|webp)(\?.*)?$/i, "$1._AC_SL1500_.$2");  // Amazon
  v = v.replace(/\?_ex=\d+x\d+/i, "?_ex=1200x1200");                                                   // 楽天
  return v;
}

function openLightbox(src, title, href) {
  if (!src || src.startsWith("data:")) return;
  const big = bigImageUrl(src);
  const img = $("lbImg");
  img.onerror = () => { img.onerror = null; img.src = src; };     // 大きい版が無ければ元に戻す
  img.src = big;
  $("lbTitle").textContent = title || "";
  $("lbLink").href = href || "";
  $("lbLink").hidden = !href;
  $("lightbox").hidden = false;
}
function closeLightbox() {
  $("lightbox").hidden = true;
  $("lbImg").removeAttribute("src");
}

function thumbTag(src, cls, id) {
  const mark = id ? ` data-thumb="${esc(id)}"` : "";
  return src
    ? `<img class="thumb ${cls}"${mark} src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" title="${esc(src)}"
           onerror="this.onerror=null;this.classList.add('broken');this.src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'">`
    : `<span class="thumb ${cls} none"${mark}></span>`;
}

function statusCells(itemId, p) {
  const sel = (field, list, v) =>
    `<select class="st-sel ${stCls(list, v)}" data-pickstatus="${esc(itemId)}|${esc(p.id)}|${field}">${stOptions(list, v)}</select>`;
  return `<td class="td-st">${sel("check", stList("check"), p.check)}</td>` +
         `<td class="td-st">${sel("buy", stList("buy"), p.buy)}</td>`;
}

/* サムネ1枚。side は "amazon" / "rakuten" */
function pickThumb(itemId, p, side) {
  const sd = PSIDE(side);
  const key = `${itemId}|${p.id}|${sd.k}`;
  if (imgBusy.has(key))
    return `<span class="pick-thumb busy" title="画像を取得しています">取得中</span>`;
  const src = p[sd.img];
  if (src)
    return `<img class="pick-thumb" src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer"
           title="${esc(src)}"
           onerror="this.onerror=null;this.classList.add('broken');this.src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'">`;
  if (!p[sd.url])
    return `<span class="pick-thumb none" title="${esc(sd.label)}のURLがありません"></span>`;
  return `<button class="pick-thumb none" data-pickretry="${esc(key)}"
              title="クリックすると${esc(sd.label)}の画像をもう一度取りにいきます"></button>`;
}

function pickPanel(it) {
  const cols = pickColsOf(view);
  const sd = PSIDE(sideKeyOf(view));

  const picks = it.picks
    .slice()
    .sort((a, b) => (b.addedAt || "").localeCompare(a.addedAt || ""))   // 同じ日なら追加が新しい順
    .map((p) => {
      const key = `${it.id}|${p.id}`;
      if (editPicks.has(key)) return `
      <tr class="pick-editing" data-row="${esc(key)}">
        <td class="td-date"><input class="input-sm pe-date" type="date" value="${esc(p.addedAt)}"></td>
        <td class="td-title"><input class="input-sm pe-title" type="text" value="${esc(p.title)}" placeholder="商品名"></td>
        <td class="td-img"><input class="input-sm pe-image" type="url" value="${esc(p[sd.img])}" placeholder="画像URL"></td>
        <td class="td-url"><input class="input-sm pe-url" type="url" value="${esc(p[sd.url])}" placeholder="https://…"></td>
        <td class="td-edit"><button class="btn btn-add btn-xs" data-picksave="${esc(key)}">保存</button></td>
        ${statusCells(it.id, p)}
        <td class="td-acts">
          <button class="icon-btn" data-pickcancel="${esc(key)}" title="やめる">↩</button>
        </td>
      </tr>`;
      const url = p[sd.url];
      return `
      <tr>
        <td class="td-date">${esc(p.addedAt || "—")}</td>
        <td class="td-title${p.title ? "" : " none"}">${esc(p.title || "—")}</td>
        <td class="td-img" data-pickimg="${esc(key)}|${sd.k}">${pickThumb(it.id, p, sd.k)}</td>
        <td class="td-url">${url
          ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="${esc(url)}">${esc(prettyUrl(url, 62))}</a>`
          : '<span class="dash">—</span>'}</td>
        <td class="td-edit"><button class="btn btn-edit btn-xs" data-pickedit="${esc(key)}">編集</button></td>
        ${statusCells(it.id, p)}
        <td class="td-acts">
          <button class="icon-btn" data-pickdel="${esc(key)}" title="削除">✕</button>
        </td>
      </tr>`;
    }).join("");

  return `<section class="pick-block">
    <div class="pick-hdr">
      <span class="pick-hdr-ttl">チェックした商品</span>
      <span class="pick-hdr-cnt">${it.picks.length} 件</span>
      <button class="btn btn-ghost btn-xs pick-close" data-rowclose="${esc(it.id)}">✕ 閉じる</button>
    </div>

    <div class="pick-tbl-wrap"><table class="pick-tbl" style="--pick-row-h:${pRowH()}px">
      <colgroup>${cols.map((c) => {
        const w = colW[c.key] || c.w;
        return `<col${w ? ` style="width:${w}px"` : ""}>`;
      }).join("")}</colgroup>
      <thead><tr>${cols.map((c) => `<th class="${c.cls}">${esc(c.label)}</th>`).join("")}</tr></thead>
      <tbody>
        ${addRows.has(it.id) ? `<tr class="pick-new" data-for="${esc(it.id)}">
          <td class="td-date"><input class="input-sm pick-added" type="date" value="${esc(today())}"></td>
          <td class="td-title"><input class="input-sm pick-title" type="text" placeholder="商品名"></td>
          <td class="td-img"><input class="input-sm pick-image" type="url" placeholder="画像URL"></td>
          <td class="td-url"><input class="input-sm pick-url" type="url" placeholder="${esc(sd.label)}の商品URL  https://…"></td>
          <td class="td-edit"><button class="btn btn-add btn-xs pick-add">追加</button></td>
          <td class="td-st"></td><td class="td-st"></td><td class="td-acts"></td>
        </tr>` : ""}
        ${picks}
        ${!it.picks.length && !addRows.has(it.id) ? `<tr><td class="pick-empty" colspan="${cols.length}">まだありません。右の「＋ 商品」から追加できます。</td></tr>` : ""}
      </tbody>
    </table></div>
  </section>`;
}

function renderAll() { renderNav(); renderToolbar(); renderBody(); }

/* =========================================================
   編集モーダル
   ========================================================= */
function openRank(item) {
  isNew = !item;
  entry = item
    ? JSON.parse(JSON.stringify(item))
    : { id: uid(), name: "", category: "", image: "", url: "", urlAmazon: "", urlRakuten: "",
        checkNote: "", checkedAt: today(), picks: [],
        createdAt: nowIso(), updatedAt: nowIso() };

  /* URL欄はタブごとに本数と並びが変わる（amazon基準 = Amazon→楽天 / 楽天基準 = 楽天→Amazon） */
  const fields = urlFieldsOf(view);
  const FIELD_BOX = { url: "fUrl", urlAmazon: "fUrlAmz", urlRakuten: "fUrlRak" };
  $("rankModalBox").classList.toggle("modal-xwide", fields.length > 1);

  /* 区分タブ（amazon基準 / 楽天基準）はカテゴリの代わりに区分ドロップダウン */
  const side = SEC(view).side;
  $("fSide").hidden = !side;
  if (side) {
    $("rSide").innerHTML = sideOptions(side);
    $("rSide").value = side;
    $("rSide").className = "side-sel side-sel-lg " + SIDE(side).cls;
  }

  const urlWrap = $("rUrlFields");
  Object.values(FIELD_BOX).forEach((id) => { $(id).hidden = true; });
  fields.forEach((f) => {                                // 並び順もタブに合わせる
    const box = $(FIELD_BOX[f]);
    box.hidden = false;
    urlWrap.appendChild(box);
  });

  $("rankModalTtl").textContent = `${SEC(view).label}を${isNew ? "追加" : "編集"}`;
  $("rNameLabel").textContent = SEC(view).nameLabel;
  $("rName").value    = entry.name;
  $("rCat").value     = isNew ? "" : entry.category;
  $("rUrl").value     = entry.url;
  $("rUrlAmz").value  = entry.urlAmazon || "";
  $("rUrlRak").value  = entry.urlRakuten || "";
  $("rImage").value   = entry.image;
  renderImgPrev();
  renderRankPicks();
  $("rNote").value    = entry.checkNote;
  $("rChecked").value = entry.checkedAt;
  $("btnDelRank").style.visibility = isNew ? "hidden" : "visible";

  $("rankModal").hidden = false;
  setTimeout(() => $("rName").focus(), 30);
}
function closeRank() { $("rankModal").hidden = true; entry = null; }

function renderImgPrev() {
  const url = $("rImage").value.trim();
  $("rImagePrev").innerHTML = url
    ? `<img class="img-big" src="${esc(url)}" alt="" referrerpolicy="no-referrer"
           onerror="this.onerror=null;this.parentNode.classList.add('broken');this.remove()">`
    : "";
  $("rImagePrev").classList.toggle("empty", !url);
  $("rImagePrev").classList.remove("broken");
}

/* モーダル下部：この行に追加済みの商品 */
function renderRankPicks() {
  const picks = (entry.picks || []).slice()
    .sort((a, b) => (b.addedAt || "").localeCompare(a.addedAt || ""));
  $("rPickCnt").textContent = picks.length ? `${picks.length} 件` : "";

  if (!picks.length) {
    $("rPickList").innerHTML = `<p class="pick-none">まだありません。一覧の「商品」列を開くと追加できます。</p>`;
    return;
  }
  const thumb = (src) => src
    ? `<img class="pick-thumb" src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer"
           onerror="this.onerror=null;this.classList.add('broken');this.src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'">`
    : `<span class="pick-thumb none"></span>`;
  const link = (u) => u
    ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer" title="${esc(u)}">${esc(prettyUrl(u, 44))}</a>`
    : '<span class="dash">—</span>';

  $("rPickList").innerHTML = `<div class="pick-tbl-wrap"><table class="pick-tbl pick-tbl-view">
    <colgroup><col style="width:104px"><col style="width:64px"><col style="width:64px"><col style="width:220px"><col><col></colgroup>
    <thead><tr>
      <th class="td-date">追加日</th><th class="td-img">amazon画像</th><th class="td-img">楽天画像</th>
      <th class="td-title">商品名</th><th class="td-url">amazonURL</th><th class="td-url">楽天URL</th>
    </tr></thead>
    <tbody>${picks.map((p) => `
      <tr>
        <td class="td-date">${esc(p.addedAt || "—")}</td>
        <td class="td-img">${thumb(p.imageAmazon)}</td>
        <td class="td-img">${thumb(p.imageRakuten)}</td>
        <td class="td-title${p.title ? "" : " none"}">${esc(p.title || "—")}</td>
        <td class="td-url">${link(p.urlAmazon)}</td>
        <td class="td-url">${link(p.urlRakuten)}</td>
      </tr>`).join("")}</tbody>
  </table></div>`;
}

function saveRank() {
  const fields = urlFieldsOf(view);
  const INPUT = { url: "rUrl", urlAmazon: "rUrlAmz", urlRakuten: "rUrlRak" };
  const name = $("rName").value.trim();
  const vals = Object.fromEntries(fields.map((f) => [f, $(INPUT[f]).value.trim()]));
  if (!name) { toast(`${SEC(view).nameLabel}は必須です`, true); $("rName").focus(); return; }
  if (!fields.some((f) => vals[f])) {
    toast(fields.length > 1 ? "URLをどちらか入れてください" : "URLは必須です", true);
    $(INPUT[fields[0]]).focus();
    return;
  }

  entry.name       = name;
  entry.url        = vals.url || "";
  entry.urlAmazon  = vals.urlAmazon || "";
  entry.urlRakuten = vals.urlRakuten || "";
  entry.category  = $("rCat").value.trim() || "未分類";
  entry.image     = $("rImage").value.trim();
  entry.checkNote = $("rNote").value.trim();
  entry.checkedAt = $("rChecked").value || "";
  entry.updatedAt = nowIso();

  /* 区分タブなら、選んだ区分のタブへ入れる（違うタブを選んだら移動） */
  const target = SEC(view).side ? sideSecOf($("rSide").value) : view;
  const moved  = target !== view;
  if (moved && !isNew) removeById(view, entry.id);
  upsert(target, entry);
  if (isNew) pinned.set(entry.id, ++pinSeq);      // 新規はこのあと一番上に出す
  if (moved) { view = target; renderAll(); }
  closeRank();
  if (isNew) renderBody();
  if (isNew) setTimeout(() => {
    const row = $("list").querySelector("tr.r-main.is-new");
    if (row) row.scrollIntoView({ block: "center", behavior: "smooth" });
  }, 40);
  toast(moved ? `${SEC(target).label} に${isNew ? "追加" : "移動"}しました`
              : (isNew ? "追加しました" : "保存しました"));
}

function deleteRank() {
  if (!confirm(`「${entry.name}」を削除します。よろしいですか？`)) return;
  removeById(view, entry.id);
  closeRank();
  toast("削除しました");
}

/* 全タブの「チェックした商品」を1本のリストにする */
function allPicks() {
  const rows = [];
  for (const sec of SECTIONS) {
    for (const it of itemsOf(sec.key)) {
      for (const p of it.picks) rows.push({ sec: sec.key, item: it, p });
    }
  }
  return rows;
}
const pickTotal = () => allPicks().length;

/* "itemId|pickId" から、どのタブの何かを引き当てる（タブをまたいで使う） */
function locatePick(key) {
  const [itemId, pickId] = String(key).split("|");
  for (const sec of SECTIONS) {
    const it = itemsOf(sec.key).find((i) => i.id === itemId);
    const p  = it?.picks.find((x) => x.id === pickId);
    if (p) return { sec: sec.key, it, p };
  }
  return null;
}

/* 行を別のタブ（区分）へ移す。データ形式は共通なのでそのまま渡すだけ */
function moveItem(item, from, to) {
  data.sections[from].items = itemsOf(from).filter((x) => x.id !== item.id);
  item.updatedAt = nowIso();
  itemsOf(to).push(item);
  persistLocal(); markDirty(true);
  view = to;                       // 移した先のタブを開いて結果を見せる
  renderAll();
  toast(`「${item.name}」を ${SEC(to).label} に移しました`);
}

/* ---------- 共通の更新 ---------- */
function upsert(key, item) {
  const arr = itemsOf(key);
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = item; else arr.unshift(item);     // 新規は先頭に積む
  persistLocal(); markDirty(true); renderAll();
}

function removeById(key, id) {
  data.sections[key].items = itemsOf(key).filter((x) => x.id !== id);
  persistLocal(); markDirty(true); renderAll();
}

/* =========================================================
   GitHub（Contents API）
   ========================================================= */
const b64encode = (str) => btoa(String.fromCharCode(...new TextEncoder().encode(str)));
const b64decode = (b64) =>
  new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

function ghHeaders() {
  const h = { Accept: "application/vnd.github+json" };
  if (cfg.pat) h.Authorization = `token ${cfg.pat}`;
  return h;
}
const ghBase   = () => `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${DATA_PATH}`;
const ghGetUrl = () => `${ghBase()}?ref=${encodeURIComponent(cfg.branch)}`;
const cfgReady = () => Boolean(cfg.owner && cfg.repo && cfg.branch);

async function pullFromGitHub(silent) {
  if (!cfgReady()) { if (!silent) toast("オーナー/リポジトリを入力してください", true); return false; }
  try {
    const res = await fetch(ghGetUrl(), { headers: ghHeaders(), cache: "no-store" });
    if (res.status === 404) {
      if (!silent) toast(`404: ${cfg.owner}/${cfg.repo} @ ${cfg.branch} に ${DATA_PATH} が見つかりません（リポジトリ名・ブランチ、またはトークンの対象リポジトリを確認）`, true);
      return false;
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

    const json = await res.json();
    sha = json.sha;
    data = normalize(JSON.parse(b64decode(json.content)));
    remoteCount = totalCount();
    persistLocal(false); markDirty(false); renderAll();
    if (!silent) toast("GitHubから読み込みました");
    return true;
  } catch (e) {
    if (!silent) toast("読み込み失敗: " + e.message, true);
    return false;
  }
}

async function saveToGitHub(auto = false) {
  if (!cfgReady()) {
    if (auto) return;
    toast("設定でオーナー/リポジトリを入力してください", true); openCfg(); return;
  }
  if (!cfg.pat) {
    if (auto) return;
    toast("設定でPersonal Access Tokenを入力してください", true); openCfg(); return;
  }
  if (booting) return;                               // 起動時の突き合わせが終わるまでは保存しない
  if (saving) { saveAgain = true; return; }          // 保存中の変更は終わってからもう一度
  if (auto && !dirty) return;

  /* GitHub側より極端に減っていたら、勝手に上書きしない */
  const now = totalCount();
  if (remoteCount !== null && remoteCount >= 5 && now < remoteCount / 2) {
    if (auto) {
      saveErr = `件数が ${remoteCount} → ${now} に減っています。自動保存は止めました`;
      renderSaveState();
      toast(saveErr + "（意図した削除なら「💾 保存」を押してください）", true);
      return;
    }
    if (!confirm(`GitHub上は ${remoteCount} 件でしたが、いまは ${now} 件です。\nこの内容で上書きしますか？`)) return;
  }

  clearTimeout(autoTimer); autoTimer = null;
  saving = true; renderSaveState();
  const btn = $("btnSaveGh");
  btn.disabled = true; btn.textContent = "保存中…";

  const put = async () => {
    data.updatedAt = nowIso();
    const n = SECTIONS.reduce((t, s) => t + itemsOf(s.key).length, 0);
    const body = {
      message: `Update ${DATA_PATH} (${n} items)`,
      content: b64encode(JSON.stringify(data, null, 2)),
      branch:  cfg.branch,
    };
    if (sha) body.sha = sha;
    const res = await fetch(ghBase(), {
      method: "PUT",
      headers: { ...ghHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { res, out: await res.json() };
  };

  try {
    const head = await fetch(ghGetUrl(), { headers: ghHeaders(), cache: "no-store" });
    if (head.ok) sha = (await head.json()).sha;
    else if (head.status === 404) sha = null;
    else throw new Error(`${head.status} ${head.statusText}`);

    let { res, out } = await put();
    if (res.status === 409) {                        // 別端末が先に保存した → shaを取り直して一度だけ再試行
      const again = await fetch(ghGetUrl(), { headers: ghHeaders(), cache: "no-store" });
      sha = again.ok ? (await again.json()).sha : null;
      ({ res, out } = await put());
    }
    if (!res.ok) throw new Error(`${res.status} ${out.message || res.statusText}`);

    sha = out.content.sha;
    remoteCount = totalCount();
    saveErr = ""; saveFails = 0;
    savedAt = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    dirty = false; dirtySince = 0;
    if (!auto) toast("GitHubに保存しました");
  } catch (e) {
    saveErr = e.message;
    saveFails++;
    if (!auto || saveFails === 1) toast((auto ? "自動保存に失敗: " : "保存失敗: ") + e.message, true);
    if (cfg.autoSave && saveFails <= RETRY_MAX) {          // 一時的な不調なら少し待って再試行
      clearTimeout(autoTimer);
      autoTimer = setTimeout(() => saveToGitHub(true), RETRY_WAIT);
    }
  } finally {
    saving = false;
    btn.disabled = false; btn.textContent = "💾 保存";
    renderSaveState();
    if (saveAgain) { saveAgain = false; markDirty(true); }
    else if (dirty && cfg.autoSave && !saveErr) scheduleAutoSave();
  }
}

/* 画面を離れる/裏に回すときに取りこぼさない */
function flushSave() {
  if (!booting && dirty && cfg.autoSave && canSave() && !saving) saveToGitHub(true);
}

/* =========================================================
   ドロップダウンのラベル編集
   ========================================================= */
function renderLabelEditor() {
  $("labEditor").innerHTML = ST_FIELDS.map((f) => {
    const list = stList(f.key);
    return `<div class="lab-grp">
      <p class="cfg-sec-ttl">${esc(f.title)}</p>
      ${list.map((o) => `
        <div class="lab-row" data-lab="${esc(f.key)}|${esc(o.v)}">
          <span class="lab-sw">${SWATCHES.map((sw) =>
            `<button type="button" class="sw-${sw.c}${sw.c === o.color ? " on" : ""}"
                     data-color="${sw.c}" title="${esc(sw.label)}"></button>`).join("")}</span>
          <input class="lab-in" type="text" maxlength="24" value="${esc(o.label)}" placeholder="表示名">
          <span class="lab-prev sw-${o.color}">${esc(o.label)}</span>
        </div>`).join("")}
    </div>`;
  }).join("");

  const apply = (row, patch) => {
    const [key, v] = row.dataset.lab.split("|");
    data.labels = normLabels(data.labels);
    const o = data.labels[key].find((x) => x.v === v);
    if (patch.label === "") patch.label = ST_DEF(key).opts.find((x) => x.v === v).label;  // 空なら既定へ
    Object.assign(o, patch);
    persistLocal(); markDirty(true); renderBody();

    const prev = row.querySelector(".lab-prev");
    prev.textContent = o.label;
    prev.className = "lab-prev sw-" + o.color;
    row.querySelectorAll(".lab-sw button").forEach((b) =>
      b.classList.toggle("on", b.dataset.color === o.color));
  };

  $("labEditor").querySelectorAll(".lab-row").forEach((row) => {
    row.querySelector(".lab-in").oninput = (e) =>
      apply(row, { label: e.target.value.slice(0, 24) });
    row.querySelectorAll(".lab-sw button").forEach((b) => {
      b.onclick = () => apply(row, { color: b.dataset.color });
    });
  });
}

/* =========================================================
   履歴から復元（コミット履歴を全部読んで統合する）
   ========================================================= */
const ghCommitsUrl = (n) =>
  `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/commits` +
  `?path=${encodeURIComponent(DATA_PATH)}&sha=${encodeURIComponent(cfg.branch)}&per_page=${n}`;
const ghFileAtUrl = (sha) => `${ghBase()}?ref=${encodeURIComponent(sha)}`;

/* 壊れた画像URLを直す。連結してしまったものは最初の1本を取り、ロゴ類は捨てる */
function cleanImage(v) {
  const all = String(v || "").match(/https?:\/\/[^\s"']+?\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s"']*)?/gi) || [];
  for (const u of all) if (!isJunkImage(u)) return u;
  return "";
}

/* 古い版から新しい版へ重ねて、消えたものを拾い直す */
function mergeVersions(versions) {
  const items = new Map();                    // itemId → { sec, item }
  const picksOf = new Map();                  // itemId → Map(URL or id → pick)

  for (const v of versions) {                 // versions は古い順
    for (const sec of SECTIONS) {
      for (const it of v.sections[sec.key].items) {
        const bag = picksOf.get(it.id) || new Map();
        for (const p of it.picks) {
          const key = p.urlAmazon || p.urlRakuten || p.id;
          const old = bag.get(key);
          const fix = (q) => ({
            ...q,
            imageAmazon:  cleanImage(q.imageAmazon),
            imageRakuten: cleanImage(q.imageRakuten),
          });
          const cur = fix(p);
          bag.set(key, old
            ? { ...old, ...cur,
                urlAmazon:    cur.urlAmazon    || old.urlAmazon,
                urlRakuten:   cur.urlRakuten   || old.urlRakuten,
                imageAmazon:  cur.imageAmazon  || old.imageAmazon,
                imageRakuten: cur.imageRakuten || old.imageRakuten,
                sales30: cur.sales30 || old.sales30,
                rival:   cur.rival   || old.rival,
                title:   cur.title   || old.title,
                addedAt: old.addedAt || cur.addedAt }   // 追加日は最初に見た日を残す
            : cur);
        }
        picksOf.set(it.id, bag);
        const prev = items.get(it.id);
        items.set(it.id, { sec: sec.key, item: { ...(prev?.item || {}), ...it, image: cleanImage(it.image) || (prev?.item.image || "") } });
      }
    }
  }

  /* 並びは最新版のものを尊重し、最新版に無いものは後ろに付ける */
  const newest = versions.at(-1);
  const order = new Map();
  let n = 0;
  for (const sec of SECTIONS) for (const it of newest.sections[sec.key].items) order.set(it.id, n++);

  const out = emptyData();
  const list = [...items.values()].sort((a, b) =>
    (order.has(a.item.id) ? order.get(a.item.id) : 1e9) - (order.has(b.item.id) ? order.get(b.item.id) : 1e9));
  for (const { sec, item } of list) {
    const picks = [...(picksOf.get(item.id) || new Map()).values()]
      .filter((p) => p.urlAmazon || p.urlRakuten)
      .sort((a, b) => (b.addedAt || "").localeCompare(a.addedAt || ""));
    out.sections[sec].items.push({ ...item, picks });
  }
  out.labels = normLabels(newest.labels);
  out.updatedAt = nowIso();
  return out;
}

async function restoreFromHistory() {
  if (!cfgReady() || !cfg.pat) { toast("先にオーナー／リポジトリ／トークンを入れてください", true); return; }
  const n = Math.min(100, Math.max(1, parseInt($("cHistN").value, 10) || 30));
  const btn = $("btnRestore"), out = $("restoreOut");
  btn.disabled = true; btn.textContent = "読み込み中…";
  out.hidden = false;
  out.innerHTML = `<p class="hint">コミット一覧を取得しています…</p>`;

  try {
    const res = await fetch(ghCommitsUrl(n), { headers: ghHeaders(), cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const commits = await res.json();
    if (!commits.length) throw new Error("履歴が見つかりません");

    const rows = [];
    const versions = [];
    for (let i = commits.length - 1; i >= 0; i--) {          // 古い順に読む
      const c = commits[i];
      out.innerHTML = `<p class="hint">${commits.length - i} / ${commits.length} 版を読み込み中…</p>`;
      const r = await fetch(ghFileAtUrl(c.sha), { headers: ghHeaders(), cache: "no-store" });
      if (!r.ok) continue;
      let v;
      try { v = normalize(JSON.parse(b64decode((await r.json()).content))); } catch { continue; }
      versions.push(v);
      const it = SECTIONS.reduce((t, s) => t + v.sections[s.key].items.length, 0);
      const pk = SECTIONS.reduce((t, s) => t + v.sections[s.key].items.reduce((m, x) => m + x.picks.length, 0), 0);
      rows.unshift({ sha: c.sha.slice(0, 7), at: (c.commit?.author?.date || "").replace("T", " ").slice(0, 16), it, pk });
    }
    if (!versions.length) throw new Error("読める版がありませんでした");

    const merged = mergeVersions(versions);
    const mi = SECTIONS.reduce((t, s) => t + merged.sections[s.key].items.length, 0);
    const mp = SECTIONS.reduce((t, s) => t + merged.sections[s.key].items.reduce((m, x) => m + x.picks.length, 0), 0);
    const cur = [SECTIONS.reduce((t, s) => t + itemsOf(s.key).length, 0), pickTotal()];

    out.innerHTML = `
      <p class="restore-sum"><b>${versions.length} 版</b>を統合しました →
        ランキング行 <b>${mi}</b>（いま ${cur[0]}） / 商品 <b>${mp}</b>（いま ${cur[1]}）</p>
      <div class="restore-list"><table class="restore-tbl">
        <thead><tr><th>コミット</th><th>日時</th><th>行</th><th>商品</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td class="mono">${esc(r.sha)}</td><td class="mono">${esc(r.at)}</td><td>${r.it}</td><td>${r.pk}</td></tr>`).join("")}</tbody>
      </table></div>
      <button class="btn btn-primary btn-sm" id="btnApplyRestore">この内容を画面に反映する</button>
      <p class="hint">反映しても、この時点ではGitHubに書き込みません。中身を確かめてから「💾 保存」を押してください。</p>`;

    $("btnApplyRestore").onclick = () => {
      data = merged;
      persistLocal(); markDirty(true); renderAll();
      $("cfgModal").hidden = true;
      toast(`復元しました（行 ${mi} / 商品 ${mp}）。確認して「💾 保存」を押してください`);
    };
  } catch (e) {
    out.innerHTML = `<p class="hint err-text">読み込めませんでした: ${esc(e.message)}</p>`;
  } finally {
    btn.disabled = false; btn.textContent = "履歴を読み込んで統合";
  }
}

/* =========================================================
   設定
   ========================================================= */
function showCfgPane(id) {
  if (id === "pLabel") renderLabelEditor();
  $("cfgTabs").querySelectorAll(".cfg-tab").forEach((t) =>
    t.classList.toggle("on", t.dataset.pane === id));
  document.querySelectorAll(".cfg-pane").forEach((p) => { p.hidden = p.id !== id; });
}

function openCfg() {
  showCfgPane("pSave");
  $("cOwner").value  = cfg.owner;
  $("cRepo").value   = cfg.repo;
  $("cBranch").value = cfg.branch;
  $("cPat").value    = cfg.pat;
  $("cRkAppId").value = cfg.rakutenAppId || "";
  $("cRkKey").value   = cfg.rakutenAccessKey || "";
  document.querySelectorAll("[data-pw]").forEach((b) => {   // 開くたびに伏せ字へ戻す
    $(b.dataset.pw).type = "password";
    b.textContent = "表示"; b.title = b.ariaLabel = "表示する";
    b.classList.remove("on");
  });
  $("cProxy").value   = cfg.imgProxy || "";
  $("cAmzTag").value  = cfg.amazonTag || "";
  $("cProxy").placeholder = DEFAULT_PROXIES[0];
  $("cAutoSave").checked = cfg.autoSave !== false;
  $("cfgStatus").textContent = "";
  renderCfgUrl();
  $("cfgModal").hidden = false;
}
/* 画像取得テスト：どの段階で止まっているかを画面に出す */
async function runImgTest() {
  const url = $("cImgTest").value.trim();
  if (!url) { toast("商品URLを入れてください", true); $("cImgTest").focus(); return; }
  readCfgForm();                                   // 入力中の設定をそのまま使う

  const box = $("imgTest"), logEl = $("imgTestLog"), prev = $("imgTestPrev");
  box.hidden = false; logEl.innerHTML = ""; prev.innerHTML = "";
  const add = (stage, msg, cls) => {
    logEl.insertAdjacentHTML("beforeend",
      `<li class="${cls || ""}"><b>${esc(stage)}</b><span>${esc(msg)}</span></li>`);
  };
  add("開始", url);

  const btn = $("btnImgTest");
  btn.disabled = true; btn.textContent = "実行中…";
  const found = await guessImage(url, (stage, msg) => add(stage, msg));
  btn.disabled = false; btn.textContent = "実行";

  if (found) {
    add("画像URL", found, "ok");
    prev.innerHTML = `<img src="${esc(found)}" alt="" referrerpolicy="no-referrer">`;
  } else {
    add("画像URL", "取得できず", "ng");
  }
}

/* 全角英数・記号を半角に。空白と不可視文字も落とす */
function normId(s) {
  const punct = { "－": "-", "ー": "-", "―": "-", "‐": "-", "−": "-", "＿": "_", "．": ".", "／": "/", "：": ":" };
  return String(s ?? "")
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[－ー―‐−＿．／：]/g, (c) => punct[c])
    .replace(/[\s​-‍﻿]/g, "");
}

/* "https://github.com/owner/repo" や "owner/repo" の貼り付けも受け付ける */
function parseRepoInput(ownerRaw, repoRaw) {
  let o = normId(ownerRaw), r = normId(repoRaw);
  const fromUrl = (s) => {
    const m = s.match(/github\.com\/([^/]+)\/([^/?#]+)/i);
    return m ? [m[1], m[2]] : null;
  };
  const u = fromUrl(o) || fromUrl(r);
  if (u) { [o, r] = u; }
  else if (o.includes("/")) {
    const p = o.split("/").filter(Boolean);
    o = p[0];
    if (p[1]) r = p[1];
  }
  o = o.replace(/^\/+|\/+$/g, "");
  r = r.replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "");
  return [o, r];
}

function readCfgForm() {
  const [owner, repo] = parseRepoInput($("cOwner").value, $("cRepo").value);
  cfg = {
    owner, repo,
    branch: normId($("cBranch").value) || "main",
    pat: $("cPat").value.trim(),
    rakutenAppId:     $("cRkAppId").value.trim(),
    rakutenAccessKey: $("cRkKey").value.trim(),
    imgProxy:         $("cProxy").value.trim(),
    amazonTag:        $("cAmzTag").value.trim(),
    autoSave:         $("cAutoSave").checked,
  };

  // 正規化した結果を画面にも反映して、何が送られるか見えるようにする
  $("cOwner").value  = cfg.owner;
  $("cRepo").value   = cfg.repo;
  $("cBranch").value = cfg.branch;

  saveCfg(); renderHeadBits(); renderCfgUrl();
}

/* どこで失敗しているのかを段階的に切り分ける */
async function testConnection() {
  readCfgForm();
  const el = $("cfgStatus");
  const set = (t) => { el.textContent = t; };
  if (!cfgReady()) { set("オーナー/リポジトリを入力してください"); return; }

  const bare = { Accept: "application/vnd.github+json" };
  const ok = [];
  set("テスト中…");
  try {
    // 1) リポジトリの存在（トークンなし）
    let r = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}`, { headers: bare, cache: "no-store" });
    if (r.status === 404) { set(`✕ リポジトリが見つかりません：${cfg.owner}/${cfg.repo}`); return; }
    if (!r.ok) { set(`✕ リポジトリ確認に失敗：${r.status}`); return; }
    const info = await r.json();
    ok.push(`✓ リポジトリ（既定ブランチ ${info.default_branch}）`);

    // 2) ファイルの存在（トークンなし）
    r = await fetch(ghGetUrl(), { headers: bare, cache: "no-store" });
    if (r.status === 404) { set(`${ok.join(" / ")} / ✕ ${cfg.branch} に ${DATA_PATH} がありません`); return; }
    if (!r.ok) { set(`${ok.join(" / ")} / ✕ ファイル確認に失敗：${r.status}`); return; }
    ok.push("✓ ファイル");

    // 3) トークンでの読み取り
    if (!cfg.pat) { set(`${ok.join(" / ")} / △ トークン未入力（読み込みのみ可）`); return; }
    r = await fetch(ghGetUrl(), { headers: ghHeaders(), cache: "no-store" });
    if (r.status === 401) { set(`${ok.join(" / ")} / ✕ トークンが無効です（貼り直してください）`); return; }
    if (r.status === 404) { set(`${ok.join(" / ")} / ✕ トークンがこのリポジトリを見られません（Repository access を確認）`); return; }
    if (!r.ok) { set(`${ok.join(" / ")} / ✕ トークンでの取得に失敗：${r.status}`); return; }
    ok.push("✓ トークン");

    // 4) 書き込み権限
    r = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}`, { headers: ghHeaders(), cache: "no-store" });
    const perm = r.ok ? (await r.json()).permissions : null;
    ok.push(perm?.push ? "✓ 書き込み権限" : "✕ 書き込み権限なし（Contents を Read and write に）");
    set(ok.join(" / "));
  } catch (e) {
    set("✕ 通信エラー：" + e.message);
  }
}

function renderCfgUrl() {
  const el = $("cfgUrl");
  if (!el) return;
  if (!cfgReady()) { el.textContent = ""; el.removeAttribute("href"); return; }
  el.href = ghGetUrl();
  el.textContent = ghGetUrl();
}

/* =========================================================
   起動
   ========================================================= */
function bind() {
  $("btnNew").onclick      = () => openRank(null);
  $("btnEditMode").onclick = () => {
    tableEdit = !tableEdit;
    $("btnEditMode").classList.toggle("on", tableEdit);
    $("btnEditMode").textContent = tableEdit ? "✓ 編集を終える" : "✎ 表編集";
    renderBody();
  };
  $("btnSettings").onclick = openCfg;
  $("btnCols").onclick     = () => toggleColPanel();
  $("btnColsReset").onclick = () => {
    colW = {}; saveCols(); renderBody(); renderColPanel();
    toast("幅と高さを既定に戻しました");
  };
  $("btnSaveGh").onclick   = () => saveToGitHub(false);
  $("saveState").onclick   = () => { if (saveErr || dirty) saveToGitHub(false); };
  document.addEventListener("visibilitychange", () => { if (document.hidden) flushSave(); });
  window.addEventListener("pagehide", flushSave);
  window.addEventListener("beforeunload", (e) => {
    if (!dirty) return;
    flushSave();
    // 自動保存が効かない状況のときだけ、閉じる前に確認する
    if (!cfg.autoSave || !canSave() || saveErr) { e.preventDefault(); e.returnValue = ""; }
  });

  $("q").oninput      = (e) => { F().q = e.target.value; renderBody(); };
  $("qClear").onclick = () => { $("q").value = ""; F().q = ""; renderBody(); };


  $("rankClose").onclick     = closeRank;
  $("btnCancelRank").onclick = closeRank;
  $("btnSaveRank").onclick   = saveRank;
  $("btnDelRank").onclick    = deleteRank;
  $("btnToday").onclick      = () => { $("rChecked").value = today(); };
  $("rImage").oninput        = renderImgPrev;
  $("btnFetchImg").onclick   = async () => {
    const url = [$("rUrlAmz"), $("rUrl"), $("rUrlRak")]
      .map((el) => el.value.trim()).find(Boolean) || "";
    if (!url) { toast("先にURLを入力してください", true); return; }
    const btn = $("btnFetchImg");
    btn.disabled = true; btn.textContent = "取得中…";
    const found = await guessImage(url);
    btn.disabled = false; btn.textContent = "URLから取得";
    if (found) { $("rImage").value = found; renderImgPrev(); toast("画像を取得しました"); }
    else if (!asinOf(url)) toast("自動取得はAmazonの商品URL（/dp/…）のみ対応しています", true);
    else toast("画像が見つかりませんでした。手動でURLを貼ってください", true);
  };
  $("rSide").onchange = () => {
    $("rSide").className = "side-sel side-sel-lg " + SIDE($("rSide").value).cls;
  };
  ["rUrl", "rUrlAmz", "rUrlRak"].forEach((id) => {
    $(id).onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); saveRank(); } };
  });

  $("cfgClose").onclick   = () => { $("cfgModal").hidden = true; };
  $("btnSaveCfg").onclick = () => { readCfgForm(); $("cfgModal").hidden = true; toast("設定を保存しました"); };
  $("btnTestGh").onclick  = testConnection;
  $("btnImgTest").onclick = runImgTest;
  $("btnRestore").onclick = restoreFromHistory;
  $("btnLabReset").onclick = () => {
    if (!confirm("ドロップダウンの文言と色を既定に戻します。よろしいですか？")) return;
    data.labels = normLabels(null);
    persistLocal(); markDirty(true); renderBody(); renderLabelEditor();
    toast("既定に戻しました");
  };

  /* サムネを押したら拡大表示 */
  document.addEventListener("click", (e) => {
    const img = e.target.closest("img.pick-thumb, .rank-tbl img.thumb");
    if (!img || img.classList.contains("broken")) return;
    const row = img.closest("tr");
    const title = row?.querySelector(".td-title, .c-name")?.textContent.trim() || "";
    const link  = row?.querySelector(".td-url a, .c-url a");
    openLightbox(img.currentSrc || img.src, title, link?.href || "");
  });
  $("lbClose").onclick = closeLightbox;
  $("lightbox").onclick = (e) => { if (e.target.closest(".lb-link")) return; closeLightbox(); };
  /* 設定内のタブ切り替え */
  $("cfgTabs").querySelectorAll(".cfg-tab").forEach((t) => {
    t.onclick = () => showCfgPane(t.dataset.pane);
  });
  /* 伏せ字の表示切り替え */
  document.querySelectorAll("[data-pw]").forEach((b) => {
    b.onclick = () => {
      const inp = $(b.dataset.pw);
      const show = inp.type === "password";
      inp.type = show ? "text" : "password";
      b.textContent = show ? "隠す" : "表示";
      b.title = b.ariaLabel = show ? "隠す" : "表示する";
      b.classList.toggle("on", show);
    };
  });
  $("cImgTest").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); runImgTest(); } };
  ["cOwner", "cRepo", "cBranch"].forEach((id) => {
    $(id).onblur = () => {
      const [o, r] = parseRepoInput($("cOwner").value, $("cRepo").value);
      $("cOwner").value = o; $("cRepo").value = r;
      $("cBranch").value = normId($("cBranch").value);
      const tmp = { ...cfg, owner: o, repo: r, branch: $("cBranch").value || "main" };
      const keep = cfg; cfg = tmp; renderCfgUrl(); cfg = keep;
    };
  });
  $("btnPullGh").onclick  = async () => {
    readCfgForm();
    $("cfgStatus").textContent = "読み込み中…";
    const ok = await pullFromGitHub(false);
    $("cfgStatus").textContent = ok ? "読み込み完了" : "読み込めませんでした";
  };

  ["rankModal", "cfgModal"].forEach((id) => {
    $(id).onclick = (e) => { if (e.target.id === id) $(id).hidden = true; };
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!$("lightbox").hidden) { closeLightbox(); return; }
      ["rankModal", "cfgModal"].forEach((id) => ($(id).hidden = true));
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); saveToGitHub(false); }
  });
  let fitTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(fitColumns, 120);
  });
}

/* GitHubの現物を取ってくる（画面には反映しない） */
async function fetchRemote() {
  try {
    const res = await fetch(ghGetUrl(), { headers: ghHeaders(), cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    return { data: normalize(JSON.parse(b64decode(json.content))), sha: json.sha };
  } catch { return null; }
}

async function boot() {
  loadCfg();
  loadCols();
  loadSort();
  bind();
  renderHeadBits();

  const local = loadLocal();
  if (local) data = local;
  else {
    try {
      const res = await fetch(DATA_PATH + "?t=" + Date.now(), { cache: "no-store" });
      if (res.ok) data = normalize(await res.json());
    } catch { /* noop */ }
  }
  markDirty(false);
  renderAll();

  /* ここが肝心。GitHubの最新と突き合わせるまでは保存を解禁しない。
     この端末のlocalStorageが古いまま自動保存されると、他端末の変更を消してしまうため。 */
  if (cfgReady()) {
    const remote = await fetchRemote();
    if (remote) {
      sha = remote.sha;
      const localAt  = local?.updatedAt || "";
      const remoteAt = remote.data.updatedAt || "";
      if (!local || remoteAt >= localAt) {
        data = remote.data;                       // GitHubのほうが新しい（か同じ）
        remoteCount = totalCount();
        persistLocal(false); markDirty(false);
      } else {
        remoteCount = SECTIONS.reduce((t, sec) =>
          t + (remote.data.sections[sec.key]?.items.length || 0), 0) +
          Object.values(remote.data.sections).reduce((t, sc) =>
            t + sc.items.reduce((n, it) => n + it.picks.length, 0), 0);
        markDirty(true);                          // この端末のほうが新しい → あとで保存
        toast("この端末に未保存の変更があります。保存します");
      }
      renderAll();
    } else if (local) {
      markDirty(true);
    }
  } else if (local) {
    markDirty(true);
  }

  booting = false;
  if (dirty) scheduleAutoSave();
}

document.addEventListener("DOMContentLoaded", boot);
