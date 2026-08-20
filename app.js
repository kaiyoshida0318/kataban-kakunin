/* =========================================================
   型番商品確認くん / app.js
   型番商品・楽天ランキング・AmazonランキングのURL置き場
   データ: data/products.json（GitHub Contents API で読み書き）
   ========================================================= */

const VERSION   = "0.28.0";
const DATA_PATH = "data/products.json";
const LS_CFG    = "kata_cfg_v1";
const LS_DATA   = "kata_data_v2";
const LS_COLS   = "kata_cols_v1";

/* ---------- URL列（タブごとに本数と並びが変わる） ---------- */
const URL_COLS = {
  urlAmazon:  { key: "amzurl", label: "Amazon URL", w: 230, cls: "c-url", field: "urlAmazon"  },
  urlRakuten: { key: "rakurl", label: "楽天 URL",   w: 230, cls: "c-url", field: "urlRakuten" },
  url:        { key: "url",    label: "URL",        w: 240, cls: "c-url", field: "url"        },
};
/* ---------- 一覧表の列（そのタブのURL列を挟み込む） ---------- */
function colsOf(key) {
  const urls = urlFieldsOf(key).map((f) => URL_COLS[f]);
  const sided = Boolean(SEC(key)?.side);
  return [
    ...(sided ? [{ key: "side", label: "区分", w: 118, cls: "c-side" }] : []),
    { key: "img",   label: "画像",       w: 66,  cls: "c-img"   },
    { key: "name",  label: "ジャンル名", w: 240, cls: "c-name",  sort: "name"      },
    ...(sided ? [] : [{ key: "cat", label: "カテゴリ", w: 100, cls: "c-cat", sort: "category" }]),
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
const PICK_COLS = [
  { key: "p_date",  label: "追加日",  w: 104, cls: "td-date"  },
  { key: "p_img",   label: "画像",    w: 64,  cls: "td-img"   },
  { key: "p_title", label: "商品名",  w: 280, cls: "td-title" },
  { key: "p_url",   label: "商品URL", w: 0,   cls: "td-url"   },   // 0 = 自動
  { key: "p_edit",  label: "編集",    w: 78,  cls: "td-edit"  },
  { key: "p_check", label: "確認",    w: 98,  cls: "td-st"    },
  { key: "p_buy",   label: "買付",    w: 98,  cls: "td-st"    },
  { key: "p_act",   label: "操作",    w: 76,  cls: "td-acts"  },
];

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
  { key: "products", icon: "📦", label: "型番商品",        nameLabel: "商品名",
    defSort: "updatedAt", urlFields: ["url"],
    search: "商品名・型番・URLで検索…", add: "＋ 商品を追加",
    emptyTtl: "まだ登録がありません",
    emptySub: "「＋ 商品を追加」から、監視したい商品のURLを登録してください。" },
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

/* 商品行のステータス（2つのドロップダウン） */
const PICK_CHECK = [
  { v: "before", label: "確認前",   cls: "st-todo" },
  { v: "after",  label: "確認後",   cls: "st-done" },
  { v: "skip",   label: "スキップ", cls: "st-skip" },
];
const PICK_BUY = [
  { v: "before", label: "買付前",   cls: "st-todo" },
  { v: "done",   label: "買付済",   cls: "st-done" },
  { v: "skip",   label: "スキップ", cls: "st-skip" },
];
const stCls = (list, v) => (list.find((o) => o.v === v) || list[0]).cls;
const stOptions = (list, v) =>
  list.map((o) => `<option value="${o.v}"${o.v === v ? " selected" : ""}>${o.label}</option>`).join("");

const STALE_DAYS = 14;   // 最終確認からこの日数を超えたら色を付ける

/* ---------- 状態 ---------- */
let cfg   = { owner: "", repo: "", branch: "main", pat: "",
              rakutenAppId: "", rakutenAccessKey: "", imgProxy: "", autoSave: true };
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

function imageCandidates(url) {
  const asin = asinOf(url);
  if (!asin) return [];
  return [
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
  "https://api.allorigins.win/raw?url={url}",
  "https://api.codetabs.com/v1/proxy/?quest={url}",
  "https://corsproxy.io/?url={url}",
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

/* 中継サービス経由でページのHTMLを取り、og:image を拾う */
async function ogImages(url, log = () => {}) {
  const list = proxyList();
  if (!list.length) { log("og:image", "中継なしの設定のためスキップ"); return []; }

  for (const tpl of list) {
    const via = (() => { try { return new URL(tpl.replace("{url}", "")).hostname; } catch { return tpl; } })();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 9000);
      const res = await fetch(tpl.replace("{url}", encodeURIComponent(url)), { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) { log("og:image", `${via} → HTTP ${res.status}`); continue; }

      const html = (await res.text()).slice(0, 600000);
      const tags = html.match(/<meta[^>]+>/gi) || [];
      const pick = (key) => {
        const t = tags.find((x) => new RegExp(`(?:property|name)\\s*=\\s*["']${key}["']`, "i").test(x));
        return t ? (t.match(/content\s*=\s*["']([^"']+)["']/i)?.[1] || "") : "";
      };
      let src = pick("og:image:secure_url") || pick("og:image") || pick("twitter:image") || pick("twitter:image:src");
      if (!src) { log("og:image", `${via} → ページは取れたが og:image なし`); continue; }
      src = src.replace(/&amp;/g, "&").trim();
      if (src.startsWith("//")) src = "https:" + src;
      else if (src.startsWith("/")) src = new URL(src, url).href;
      if (!/^https?:\/\//i.test(src)) { log("og:image", `${via} → URLの形が不正`); continue; }
      log("og:image", `${via} → 取得`);
      return [src];
    } catch (e) {
      log("og:image", `${via} → ${e.name === "AbortError" ? "タイムアウト" : "つながらない"}`);
    }
  }
  return [];
}

/* 商品URLからメイン画像を1つ決める。Amazon → 楽天API → og:image の順 */
async function guessImage(url, log = () => {}) {
  if (!url) return "";

  const amazon = imageCandidates(url);                 // 1) Amazon（URLのASINだけで完結）
  if (amazon.length) {
    for (const c of amazon) {
      const hit = await probeImage(c);
      if (hit) { log("Amazon", "画像を確認"); return hit; }
    }
    log("Amazon", "候補は作れたが画像が読めない");
  }

  for (const c of await rakutenImages(url, log)) {     // 2) 楽天ウェブサービス
    if (await probeImage(c)) { log("結果", "楽天APIの画像を採用"); return c; }
  }

  for (const c of await ogImages(url, log)) {          // 3) 中継サービスで og:image
    if (await probeImage(c)) { log("結果", "og:imageを採用"); return c; }
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
        image:   p.image || "",                    // メイン画像URL
        url:     p.url || "",
        title:   p.title || p.note || p.name || "", // 商品名（旧 note / name から移行）
        check:   PICK_CHECK.some((o) => o.v === p.check) ? p.check : "before",
        buy:     PICK_BUY.some((o) => o.v === p.buy)     ? p.buy   : "before",
      }))
      .filter((p) => p.url),
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
const colWidth = (c) => colW[c.key] || c.w;
/* 表編集中は画像URL欄が入るので画像列を広げる */
const effWidth = (c) => (tableEdit && c.key === "img" ? Math.max(colWidth(c), 170) : colWidth(c));

function persistLocal() {
  data.updatedAt = nowIso();
  localStorage.setItem(LS_DATA, JSON.stringify(data));
}
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
  if (!cfg.autoSave || !canSave() || saving) return;
  clearTimeout(autoTimer);
  const capLeft = dirtySince + AUTO_MAX - Date.now();
  autoTimer = setTimeout(() => saveToGitHub(true), Math.max(0, Math.min(AUTO_IDLE, capLeft)));
}

function renderSaveState() {
  const el = $("saveState");
  let cls = "dirty-badge", txt = "";
  if (saving)        { cls += " is-saving"; txt = "⟳ 保存中…"; }
  else if (saveErr)  { cls += " is-err";    txt = "⚠ 保存できず（クリックで再試行）"; }
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
      <span class="gnav-cnt">${itemsOf(s.key).length}</span>
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

  if (SEC(view).side) F().cat = "*";
  const cats = SEC(view).side ? [] : categories(view);
  const seg = (k, label, cnt, on) =>
    `<button class="seg-btn${on ? " on" : ""}" data-k="${esc(k)}">${esc(label)}<span class="seg-cnt">${cnt}</span></button>`;
  $("catSeg").innerHTML = cats.length < 2 ? "" :
    seg("*", "すべて", itemsOf(view).length, F().cat === "*") +
    cats.map((c) => seg(c, c, itemsOf(view).filter((i) => (i.category || "未分類") === c).length, F().cat === c)).join("");
  $("catSeg").querySelectorAll(".seg-btn").forEach((b) => {
    b.onclick = () => { F().cat = b.dataset.k; renderToolbar(); renderBody(); };
  });

  $("rankCatList").innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join("");
}

/* 画像は裏で取りにいく。取れたらその行だけ差し替える */
async function fetchPickImage(sectionKey, itemId, pickId, url) {
  const key = `${itemId}|${pickId}`;
  if (imgBusy.has(key)) return;
  imgBusy.add(key);
  paintPickThumb(sectionKey, key);

  let found = "";
  try { found = await guessImage(url); } catch { /* noop */ }
  imgBusy.delete(key);

  const it = itemsOf(sectionKey).find((i) => i.id === itemId);
  const p  = it?.picks.find((x) => x.id === pickId);
  if (!p) return;                       // 取得中に消された
  if (found && !p.image) {
    p.image = found;
    it.updatedAt = nowIso();
    persistLocal(); markDirty(true);
  }
  paintPickThumb(sectionKey, key);
}

/* 画像セルだけを描き直す（入力中のフォーカスを飛ばさないため） */
function paintPickThumb(sectionKey, key) {
  const cell = $("list").querySelector(`[data-pickimg="${CSS.escape(key)}"]`);
  if (!cell) return;
  const [itemId, pickId] = key.split("|");
  const p = itemsOf(sectionKey).find((i) => i.id === itemId)?.picks.find((x) => x.id === pickId);
  if (p) cell.innerHTML = pickThumb(itemId, p);
}

/* =========================================================
   一覧
   ========================================================= */
function visibleItems() {
  const q = F().q.trim().toLowerCase();
  return itemsOf(view)
    .filter((it) => {
      if (F().cat !== "*" && (it.category || "未分類") !== F().cat) return false;
      if (!q) return true;
      const hay = [it.name, it.category, it.url, it.urlAmazon, it.urlRakuten, it.checkNote,
                   it.picks.map((p) => p.title + " " + p.url).join(" ")].join(" ");
      return hay.toLowerCase().includes(q);
    })
    .sort(comparator());
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
  const f = F();
  if (f.sort === key) f.dir = f.dir === "asc" ? "desc" : "asc";
  else { f.sort = key; f.dir = key === "checkedAt" || key === "updatedAt" ? "desc" : "asc"; }
  renderBody();
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
  const list = visibleItems();
  const total = itemsOf(view).length;

  $("countLabel").textContent = total ? `${list.length} / ${total} 件` : "";
  $("emptyState").hidden = list.length > 0;
  $("emptyTtl").textContent = total ? "条件に合うものがありません" : s.emptyTtl;
  $("emptySub").textContent = total ? "検索語やカテゴリの絞り込みを外してみてください。" : s.emptySub;

  $("list").innerHTML = rankTable(list);

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
      const image = row.querySelector(".pick-image").value.trim();
      const pickId = uid();
      it.picks.push({
        id:      pickId,
        addedAt: row.querySelector(".pick-added").value || today(),
        image,
        title:   row.querySelector(".pick-title").value.trim(),
        url,
        check:   "before",
        buy:     "before",
      });
      it.updatedAt = nowIso();
      const sec = view;
      upsert(sec, it);                                   // 追加はここで完了。待たせない
      toast(image ? "商品を追加しました" : "商品を追加しました（画像は裏で取得します）");
      if (!image) fetchPickImage(sec, id, pickId, url);  // 画像は裏で取りにいく
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
      const [id, pid] = b.dataset.pickdel.split("|");
      const it = itemsOf(view).find((i) => i.id === id);
      it.picks = it.picks.filter((x) => x.id !== pid);
      it.updatedAt = nowIso();
      editPicks.delete(b.dataset.pickdel);
      upsert(view, it);
    };
  });

  root.querySelectorAll("[data-pickstatus]").forEach((sel) => {
    sel.onchange = () => {
      const [id, pid, field] = sel.dataset.pickstatus.split("|");
      const it = itemsOf(view).find((i) => i.id === id);
      const p  = it?.picks.find((x) => x.id === pid);
      if (!p) return;
      p[field] = sel.value;
      it.updatedAt = nowIso();
      persistLocal(); markDirty(true);
      const list = field === "check" ? PICK_CHECK : PICK_BUY;
      sel.className = "st-sel " + stCls(list, sel.value);
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
      const [id, pid] = key.split("|");
      const url = row.querySelector(".pe-url").value.trim();
      if (!url) { toast("URLを空にはできません", true); return; }
      const it = itemsOf(view).find((i) => i.id === id);
      const p  = it.picks.find((x) => x.id === pid);
      p.addedAt = row.querySelector(".pe-date").value || p.addedAt;
      p.image   = row.querySelector(".pe-image").value.trim();
      p.url     = url;
      p.title   = row.querySelector(".pe-title").value.trim();
      it.updatedAt = nowIso();
      editPicks.delete(key);
      const sec = view;
      const needImg = !p.image;
      upsert(sec, it);
      toast(needImg ? "商品を更新しました（画像は裏で取得します）" : "商品を更新しました");
      if (needImg) fetchPickImage(sec, id, pid, url);
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
    const on = c.sort && F().sort === c.sort;
    const label = c.key === "name" ? SEC(view).nameLabel : c.label;
    return `<th class="${c.cls}${c.sort ? " sortable" : ""}${on ? " on" : ""}"${c.sort ? ` data-sort="${c.sort}"` : ""}>` +
      `${esc(label)}${c.sort ? sortMark(c.sort) : ""}` +
      `<span class="col-resizer" data-col="${c.key}"></span></th>`;
  }).join("");

  return `<div class="tbl-wrap"><table class="grid-tbl rank-tbl${tableEdit ? " editing" : ""}" style="--row-h:${rowH()}px">
    <colgroup>${cols}</colgroup>
    <thead><tr>${heads}</tr></thead>
    <tbody>${list.map(rankRow).join("")}</tbody>
  </table></div>`;
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

function rankRow(it) {
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

  return `<tr class="r-main${open ? " open" : ""}">${cols.map(cell).join("")}</tr>
  ${open ? `<tr class="r-sub"><td colspan="${cols.length}">${pickPanel(it)}</td></tr>` : ""}`;
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
  return `<td class="td-st">${sel("check", PICK_CHECK, p.check)}</td>` +
         `<td class="td-st">${sel("buy", PICK_BUY, p.buy)}</td>`;
}

function pickThumb(itemId, p) {
  if (imgBusy.has(`${itemId}|${p.id}`))
    return `<span class="pick-thumb busy" title="画像を取得しています">取得中</span>`;
  return p.image
    ? `<img class="pick-thumb" src="${esc(p.image)}" alt="" loading="lazy" referrerpolicy="no-referrer"
           title="${esc(p.image)}"
           onerror="this.onerror=null;this.classList.add('broken');this.src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'">`
    : `<span class="pick-thumb none"></span>`;
}

function pickPanel(it) {
  const thumb = (p) => pickThumb(it.id, p);

  const picks = it.picks
    .slice()
    .sort((a, b) => (b.addedAt || "").localeCompare(a.addedAt || ""))
    .map((p) => {
      const key = `${it.id}|${p.id}`;
      if (editPicks.has(key)) return `
      <tr class="pick-editing" data-row="${esc(key)}">
        <td class="td-date"><input class="input-sm pe-date" type="date" value="${esc(p.addedAt)}"></td>
        <td class="td-img"><input class="input-sm pe-image" type="url" value="${esc(p.image)}" placeholder="画像URL"></td>
        <td class="td-title"><input class="input-sm pe-title" type="text" value="${esc(p.title)}" placeholder="商品名"></td>
        <td class="td-url"><input class="input-sm pe-url" type="url" value="${esc(p.url)}" placeholder="https://…"></td>
        <td class="td-edit"><button class="btn btn-add btn-xs" data-picksave="${esc(key)}">保存</button></td>
        ${statusCells(it.id, p)}
        <td class="td-acts">
          <button class="icon-btn" data-pickcancel="${esc(key)}" title="やめる">↩</button>
        </td>
      </tr>`;
      return `
      <tr>
        <td class="td-date">${esc(p.addedAt || "—")}</td>
        <td class="td-img" data-pickimg="${esc(key)}">${thumb(p)}</td>
        <td class="td-title${p.title ? "" : " none"}">${esc(p.title || "—")}</td>
        <td class="td-url"><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" title="${esc(p.url)}">${esc(prettyUrl(p.url, 62))}</a></td>
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
      <button class="btn btn-cancel btn-xs pick-close" data-rowclose="${esc(it.id)}">キャンセル</button>
    </div>

    <div class="pick-tbl-wrap"><table class="pick-tbl" style="--pick-row-h:${pRowH()}px">
      <colgroup>${PICK_COLS.map((c) => {
        const w = colW[c.key] || c.w;
        return `<col${w ? ` style="width:${w}px"` : ""}>`;
      }).join("")}</colgroup>
      <thead><tr>${PICK_COLS.map((c) => `<th class="${c.cls}">${esc(c.label)}</th>`).join("")}</tr></thead>
      <tbody>
        ${addRows.has(it.id) ? `<tr class="pick-new" data-for="${esc(it.id)}">
          <td class="td-date"><input class="input-sm pick-added" type="date" value="${esc(today())}"></td>
          <td class="td-img"><input class="input-sm pick-image" type="url" placeholder="画像URL"></td>
          <td class="td-title"><input class="input-sm pick-title" type="text" placeholder="商品名"></td>
          <td class="td-url"><input class="input-sm pick-url" type="url" placeholder="商品URL  https://…"></td>
          <td class="td-edit"><button class="btn btn-add btn-xs pick-add">追加</button></td>
          <td class="td-st"></td><td class="td-st"></td><td class="td-acts"></td>
        </tr>` : ""}
        ${picks}
        ${!it.picks.length && !addRows.has(it.id) ? `<tr><td class="pick-empty" colspan="8">まだありません。右の「＋ 商品」から追加できます。</td></tr>` : ""}
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
  $("fCat").hidden  = Boolean(side);
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
  $("rPickList").innerHTML = `<div class="pick-tbl-wrap"><table class="pick-tbl pick-tbl-view">
    <colgroup><col style="width:104px"><col style="width:64px"><col style="width:280px"><col></colgroup>
    <thead><tr>
      <th class="td-date">追加日</th><th class="td-img">画像</th>
      <th class="td-title">商品名</th><th class="td-url">商品URL</th>
    </tr></thead>
    <tbody>${picks.map((p) => `
      <tr>
        <td class="td-date">${esc(p.addedAt || "—")}</td>
        <td class="td-img">${p.image
          ? `<img class="pick-thumb" src="${esc(p.image)}" alt="" loading="lazy" referrerpolicy="no-referrer"
                 onerror="this.onerror=null;this.classList.add('broken');this.src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'">`
          : `<span class="pick-thumb none"></span>`}</td>
        <td class="td-title${p.title ? "" : " none"}">${esc(p.title || "—")}</td>
        <td class="td-url"><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" title="${esc(p.url)}">${esc(prettyUrl(p.url, 56))}</a></td>
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
  entry.category  = SEC(view).side ? (entry.category || "未分類") : ($("rCat").value.trim() || "未分類");
  entry.image     = $("rImage").value.trim();
  entry.checkNote = $("rNote").value.trim();
  entry.checkedAt = $("rChecked").value || "";
  entry.updatedAt = nowIso();

  /* 区分タブなら、選んだ区分のタブへ入れる（違うタブを選んだら移動） */
  const target = SEC(view).side ? sideSecOf($("rSide").value) : view;
  const moved  = target !== view;
  if (moved && !isNew) removeById(view, entry.id);
  upsert(target, entry);
  if (moved) { view = target; renderAll(); }
  closeRank();
  toast(moved ? `${SEC(target).label} に${isNew ? "追加" : "移動"}しました`
              : (isNew ? "追加しました" : "保存しました"));
}

function deleteRank() {
  if (!confirm(`「${entry.name}」を削除します。よろしいですか？`)) return;
  removeById(view, entry.id);
  closeRank();
  toast("削除しました");
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
  if (i >= 0) arr[i] = item; else arr.push(item);
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
    persistLocal(); markDirty(false); renderAll();
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
  if (saving) { saveAgain = true; return; }          // 保存中の変更は終わってからもう一度
  if (auto && !dirty) return;

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
  if (dirty && cfg.autoSave && canSave() && !saving) saveToGitHub(true);
}

/* =========================================================
   設定
   ========================================================= */
function openCfg() {
  $("cOwner").value  = cfg.owner;
  $("cRepo").value   = cfg.repo;
  $("cBranch").value = cfg.branch;
  $("cPat").value    = cfg.pat;
  $("cRkAppId").value = cfg.rakutenAppId || "";
  $("cRkKey").value   = cfg.rakutenAccessKey || "";
  $("cProxy").value   = cfg.imgProxy || "";
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
    if (e.key === "Escape") ["rankModal", "cfgModal"].forEach((id) => ($(id).hidden = true));
    if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); saveToGitHub(false); }
  });
  let fitTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(fitColumns, 120);
  });
  window.addEventListener("beforeunload", (e) => {
    if (dirty) { e.preventDefault(); e.returnValue = ""; }
  });
}

async function boot() {
  loadCfg();
  loadCols();
  bind();
  renderHeadBits();

  const local = loadLocal();
  if (local) { data = local; markDirty(true); }
  else {
    try {
      const res = await fetch(DATA_PATH + "?t=" + Date.now(), { cache: "no-store" });
      if (res.ok) data = normalize(await res.json());
    } catch { /* noop */ }
    markDirty(false);
  }

  renderAll();
  if (cfgReady() && !dirty) pullFromGitHub(true);
}

document.addEventListener("DOMContentLoaded", boot);
