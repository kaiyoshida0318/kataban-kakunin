/* =========================================================
   型番商品確認くん / app.js
   型番商品・楽天ランキング・AmazonランキングのURL置き場
   データ: data/products.json（GitHub Contents API で読み書き）
   ========================================================= */

const VERSION   = "0.89.0";
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
const ADDED_STATIC = [
  { key: "a_src",   label: "出所",            w: 190, cls: "td-src"   },
  { key: "p_aimg",  label: "amazon画像",      w: 74,  cls: "td-img"   },
  { key: "p_rimg",  label: "楽天画像",        w: 74,  cls: "td-img"   },
  { key: "a_title", label: "商品名",          w: 230, cls: "td-title" },
  { key: "p_aurl",  label: "amazonURL",       w: 0,   cls: "td-url"   },
  { key: "p_rurl",  label: "楽天URL",         w: 0,   cls: "td-url"   },
  { key: "a_sales", label: "30日販売数",      w: 106, cls: "td-sales" },
  { key: "@st" },                                   // ここに項目のぶんが入る
  { key: "a_act",   label: "操作",            w: 116, cls: "td-acts"  },
];
const ADDED_COLS_OF = () =>
  ADDED_STATIC.flatMap((c) => (c.key === "@st" ? stCols("added") : [c]));
const isAdded = (key) => SEC(key)?.kind === "added";

/* ---------- 一覧表の列（そのタブのURL列を挟み込む） ---------- */
function rankDefs(key) {
  const urls = urlFieldsOf(key).map((f) => URL_COLS[f]);
  const sided = Boolean(SEC(key)?.side);
  const omit = SEC(key)?.omit || [];
  return [
    { key: "ord", label: "並び", w: 68, cls: "c-ord" },
    ...(sided ? [{ key: "side", label: "区分", w: 118, cls: "c-side" }] : []),
    { key: "img",   label: "画像",       w: 66,  cls: "c-img"   },
    { key: "cat",   label: SEC(key)?.catLabel || "大カテゴリ", w: 116, cls: "c-cat", sort: "category" },
    { key: "name",  label: SEC(key)?.nameLabel || "ジャンル名", w: 240, cls: "c-name", sort: "name" },
    ...(urlFieldsOf(key).includes("urlAmazon")
      ? [{ key: "name2", label: "amazonジャンル名", w: 200, cls: "c-name", sort: "nameAmazon" }] : []),
    ...urls,
    { key: "note",  label: "確認内容",   w: 0,   cls: "c-note"  },   // 0 = 自動（残り幅を吸収）
    { key: "check", label: "確認日",     w: 140, cls: "c-check", sort: "checkedAt" },
    { key: "cnt",   label: "商品",       w: 86,  cls: "c-cnt",   sort: "picks"     },
    { key: "addp",  label: "商品追加",   w: 96,  cls: "c-addp"  },
    { key: "act",   label: "操作",       w: 76,  cls: "c-act"   },
  ].filter((c) => !omit.includes(c.key));
}
/* 大カテゴリを決まった選択肢から選ぶタブ（楽天ライバルの「強さ」）*/
const catList = (key) => (SEC(key)?.cats || []).map((o) => ({
  v: String(o.v ?? ""), label: o.label || "(未設定)",
  cls: "sw-" + (SWATCH_OK(o.color) ? o.color : "gray"),
}));

/* ---------- 列管理（並び順と表示/非表示） ----------
   並び順は data.cols.order[グループ]、非表示は data.cols.hide[グループ] に入る。
   グループは3つ。amazon基準と楽天基準は列キーが同じなので、そのまま共通の設定になる。
     rank  … amazon基準 / 楽天基準の一覧表（共通）
     added … 追加した商品の表
     pick  … 一覧の行を開いた「チェックした商品」の表 */
/* 巡回タブは1つずつ独立。added / pick はそれぞれの表 */
const ROAM_KEYS = ["amazon", "rakuten", "rivals"];                 // 巡回タブ
const COL_GROUPS = [...ROAM_KEYS, "added", ...ROAM_KEYS.map((k) => "pick_" + k)];
const colGroupOf = (key) => (isAdded(key) ? "added" : key);
/* 行を開いた「チェックした商品」も、どのタブの中かで分ける */
const pickGroupOf = (key) => "pick_" + (isAdded(key) ? "amazon" : key);
function arrangeCols(defs, group, secKey) {
  const ord = ensureCols().order?.[group];
  let out = defs.slice();
  if (Array.isArray(ord) && ord.length) {
    const r = new Map(ord.map((k, i) => [k, i]));
    out = out
      .map((c, i) => ({ c, n: r.has(c.key) ? r.get(c.key) : 900 + i }))   // 知らない列は末尾へ
      .sort((a, b) => a.n - b.n)
      .map((x) => x.c);
  }
  /* URL列だけは、そのタブの基準側を必ず先に置く（並びは2タブ共通なので、ここで入れ替える） */
  if (secKey && !isAdded(secKey) && !group.startsWith("pick")) {
    const want = urlFieldsOf(secKey).map((f) => URL_COLS[f]?.key).filter(Boolean);
    const at = out.map((c, i) => (want.includes(c.key) ? i : -1)).filter((i) => i >= 0);
    if (at.length === 2 && out[at[0]].key !== want[0]) {
      const t = out[at[0]]; out[at[0]] = out[at[1]]; out[at[1]] = t;
    }
  }
  return out;
}
/* 非表示はグループごとに持つ。同じ列キーが「追加した商品」と「チェックした商品」の
   両方に出る（p_aimg 等）ので、キーだけで持つと片方を隠すともう片方も消えてしまう。
   項目名と幅はキー単位のまま（どの表でも同じ名前・同じ幅にしたいので）。 */
const hideSet = (grp) => (ensureCols().hide[grp] ||= []);
const colOff = (key, grp) => hideSet(grp).includes(key);
/* 表示する列だけ。全部消すことはできない（最後の1列は残す） */
const shownCols = (list, grp) => { const v = list.filter((c) => !colOff(c.key, grp)); return v.length ? v : list; };
/* 非表示も含む全部（列管理モーダル用） */
const allColsOf = (key) => (isAdded(key)
  ? arrangeCols(ADDED_COLS_OF(), "added")
  : arrangeCols(rankDefs(key), colGroupOf(key), key));
const colsOf    = (key) => shownCols(allColsOf(key), colGroupOf(key));
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
/* そのタブが扱うモール。URL欄の並びで決める（楽天が先なら楽天基準）。決められなければ Amazon 側 */
const sideKeyOf = (sectionKey) => (urlFieldsOf(sectionKey)[0] === "urlRakuten" ? "rakuten" : "amazon");

/* チェックした商品の列。「追加した商品」と同じ項目を一通り持つ（出所だけはその行そのものなので無い）。
   画像とURLは、そのタブの基準側のモールを先に置く。要らない列は ▦列管理 で隠す。 */
function pickDefs(sectionKey) {
  const sd = PSIDE(sideKeyOf(sectionKey));
  const od = PSIDE(sd.k === "amazon" ? "rakuten" : "amazon");
  return [
    { key: "p_date",  label: "追加日",              w: 104, cls: "td-date"  },
    { key: "p_title", label: "商品名",              w: 260, cls: "td-title" },
    { key: sd.imgCol, label: `${sd.label}画像`,     w: 76,  cls: "td-img"   },
    { key: sd.urlCol, label: `${sd.label}URL`,      w: 0,   cls: "td-url"   },   // 0 = 自動
    { key: od.imgCol, label: `${od.label}画像`,     w: 76,  cls: "td-img"   },
    { key: od.urlCol, label: `${od.label}URL`,      w: 0,   cls: "td-url"   },
    { key: "a_sales", label: "30日販売数",          w: 106, cls: "td-sales" },
    ...stCols("pick"),
    { key: "p_act",   label: "操作",                w: 116, cls: "td-acts"  },
  ];
}
/* ドロップダウン項目の列。項目管理で足したぶんもここに出る */
const ST_COL_W = { rival: 130, quality: 104, check: 108, buy: 96 };
const stCols = (where) => stFields().map((f) => ({
  key: fieldCol(f.key, where), label: f.title, w: ST_COL_W[f.key] || 112,
  cls: (ST_COL_W[f.key] || 112) > 110 ? "td-rival" : "td-st", field: f.key,
}));
const allPickColsOf = (key) => arrangeCols(pickDefs(key), pickGroupOf(key), key);
const pickColsOf    = (key) => shownCols(allPickColsOf(key), pickGroupOf(key));

let colW = {};                 // 旧localStorage（移行にだけ使う）
const ROW_H_DEF  = 96;
const PROW_H_DEF = 66;
const ALIGNS = [
  { v: "left",   label: "左",   mark: "⇤" },
  { v: "center", label: "中央", mark: "⇔" },
  { v: "right",  label: "右",   mark: "⇥" },
];
/* 列の設定は data.cols にまとめる（端末をまたいで同じ見た目になる） */
function ensureCols() {
  const c = data.cols;
  if (!c || typeof c !== "object") data.cols = { rowH: ROW_H_DEF, pickRowH: PROW_H_DEF };
  const d = data.cols;
  for (const k of ["labels", "layout", "order", "hide"]) {
    if (!d[k] || typeof d[k] !== "object") d[k] = {};
  }
  return d;
}
const rowH  = () => ensureCols().rowH || ROW_H_DEF;
const pRowH = () => ensureCols().pickRowH || PROW_H_DEF;

/* ---------- 項目名は「意味」で共通、幅と揃えは表ごと ----------
   同じものを指す列は、表が違ってもキーが違うことがある（商品名 = a_title / p_title）。
   lk（label key）が同じ列は1つの項目名を共有する。data.cols.labels[lk] に入る。
   幅・揃えは表ごとに変えたいので data.cols.layout[グループ][列キー] に入る。 */
const LK = {
  a_title: "title",  p_title: "title",
  a_edit:  "edit",   p_edit:  "edit",
  a_act:   "acts",   p_act:   "acts",
  a_check: "st_check", p_check: "st_check",
  a_buy:   "st_buy",   p_buy:   "st_buy",
};
const lkOf = (key) => LK[key] || key;
const colLabelOf = (key) => ensureCols().labels[lkOf(key)] || "";
const colLabel = (c) => colLabelOf(c.key) || (c.key === "name" ? SEC(view).nameLabel : c.label);
const layoutOf = (grp) => (ensureCols().layout[grp] ||= {});
const colBox   = (grp, key) => layoutOf(grp)[key] || {};
const colAlign = (c, grp) => colBox(grp, c.key).align || "";
function normCols(raw) {
  const out = {
    rowH: Number(raw?.rowH) >= 40 ? Math.min(600, Number(raw.rowH)) : ROW_H_DEF,
    pickRowH: Number(raw?.pickRowH) >= 30 ? Math.min(600, Number(raw.pickRowH)) : PROW_H_DEF,
    labels: {}, layout: {}, order: {}, hide: {},
  };
  const name = (v) => String(v).slice(0, 24);
  for (const [k, v] of Object.entries(raw?.labels || {})) if (v) out.labels[k] = name(v);

  for (const g of COL_GROUPS) {
    out.layout[g] = {};
    for (const [k, v] of Object.entries(raw?.layout?.[g] || {})) {
      if (!v || typeof v !== "object") continue;
      const o = {};
      if (Number(v.w) >= 40) o.w = Math.min(1600, Math.round(Number(v.w)));
      if (ALIGNS.some((a) => a.v === v.align)) o.align = v.align;
      if (Object.keys(o).length) out.layout[g][k] = o;
    }
    const arr = raw?.order?.[g];
    if (Array.isArray(arr)) {
      const keys = arr.filter((k) => typeof k === "string" && k).slice(0, 80);
      if (keys.length) out.order[g] = [...new Set(keys)];
    }
    const hid = raw?.hide?.[g];
    out.hide[g] = Array.isArray(hid)
      ? [...new Set(hid.filter((k) => typeof k === "string" && k).slice(0, 80))] : [];
  }

  /* v0.78.0以前は巡回タブが1つの "rank" 設定を共有していた。初回だけ各タブへ写して見た目を保つ */
  /* v0.81.0以前は「チェックした商品」も1つの "pick" 設定を共有していた */
  const oldPick = { order: raw?.order?.pick, hide: raw?.hide?.pick, layout: raw?.layout?.pick };
  for (const g of ROAM_KEYS.map((k) => "pick_" + k)) {
    if (!raw?.order?.[g] && Array.isArray(oldPick.order) && oldPick.order.length) out.order[g] = [...oldPick.order];
    if (!raw?.hide?.[g] && Array.isArray(oldPick.hide) && oldPick.hide.length) out.hide[g] = [...oldPick.hide];
    if (!raw?.layout?.[g] && oldPick.layout && Object.keys(oldPick.layout).length) {
      for (const [k, v] of Object.entries(oldPick.layout)) {
        if (!v || typeof v !== "object") continue;
        const o = {};
        if (Number(v.w) >= 40) o.w = Math.min(1600, Math.round(Number(v.w)));
        if (ALIGNS.some((a) => a.v === v.align)) o.align = v.align;
        if (Object.keys(o).length) out.layout[g][k] = o;
      }
    }
  }

  const oldRank = { order: raw?.order?.rank, hide: raw?.hide?.rank, layout: raw?.layout?.rank };
  for (const g of ROAM_KEYS) {
    if (!raw?.order?.[g] && Array.isArray(oldRank.order) && oldRank.order.length) out.order[g] = [...oldRank.order];
    if (!raw?.hide?.[g] && Array.isArray(oldRank.hide) && oldRank.hide.length) out.hide[g] = [...oldRank.hide];
    if (!raw?.layout?.[g] && oldRank.layout && Object.keys(oldRank.layout).length) {
      for (const [k, v] of Object.entries(oldRank.layout)) {
        if (!v || typeof v !== "object") continue;
        const o = {};
        if (Number(v.w) >= 40) o.w = Math.min(1600, Math.round(Number(v.w)));
        if (ALIGNS.some((a) => a.v === v.align)) o.align = v.align;
        if (Object.keys(o).length) out.layout[g][k] = o;
      }
    }
  }

  /* v0.62.0以前は items[列] に {label,w,align,off} をキー単位で持っていた。
     項目名は lk ごとにまとめ、幅・揃えはその列を持つ表すべてに配る。 */
  for (const [k, v] of Object.entries(raw?.items || {})) {
    if (!v || typeof v !== "object") continue;
    if (v.label && !out.labels[lkOf(k)]) out.labels[lkOf(k)] = name(v.label);
    for (const g of COL_GROUPS) {
      const o = out.layout[g][k] || {};
      if (Number(v.w) >= 40 && o.w == null) o.w = Math.min(1600, Math.round(Number(v.w)));
      if (ALIGNS.some((a) => a.v === v.align) && !o.align) o.align = v.align;
      if (Object.keys(o).length) out.layout[g][k] = o;
      if (v.off && !out.hide[g].includes(k)) out.hide[g].push(k);   // v0.57.0以前の非表示
    }
  }
  return out;
}

/* ---------- セクション定義 ---------- */
const SECTIONS = [
  { key: "amazon",   icon: "📊", label: "amazonランキング", nameLabel: "楽天ジャンル名",
    accent: "#206acf", tint: "#eef4fd", role: "巡回リスト",
    desc: "Amazon側を起点に、決まったランキングを見て回る場所。気になった商品は各行の「＋ 商品」から拾う。",
    defSort: "checkedAt", urlFields: ["urlAmazon", "urlRakuten"], side: "offense",
    omit: ["cat"],                          // カテゴリー名は使わない
    search: "ジャンル名・URLで検索…", add: "＋ 追加",
    emptyTtl: "まだ登録がありません",
    emptySub: "amazonランキングで見るジャンルを登録しておくと、AmazonとURLの対になる楽天ページを一発で開けます。" },
  { key: "rakuten",  icon: "🏆", label: "楽天ランキング",   nameLabel: "楽天ジャンル名",
    accent: "#206acf", tint: "#eef4fd", role: "巡回リスト",
    desc: "楽天側を起点に、決まったランキングを見て回る場所。気になった商品は各行の「＋ 商品」から拾う。",
    defSort: "checkedAt", urlFields: ["urlRakuten", "urlAmazon"], side: "defense",
    omit: ["cat"],                          // カテゴリー名は使わない
    search: "ジャンル名・URLで検索…", add: "＋ 追加",
    emptyTtl: "まだ登録がありません",
    emptySub: "楽天ランキングで見るジャンルを登録しておくと、楽天とURLの対になるAmazonページを一発で開けます。" },
  { key: "rivals",   icon: "🥊", label: "楽天ライバル", nameLabel: "ショップ名",
    accent: "#206acf", tint: "#eef4fd", role: "巡回リスト",
    desc: "楽天のライバル店を見て回る場所。強さで仕分けて、気になった商品は各行の「＋ 商品」から拾う。",
    defSort: "checkedAt", urlFields: ["urlRakuten"], side: "rival",
    catLabel: "強さ",                       // 大カテゴリの代わり
    unit: "ショップ",                        // 帯の数え方
    cats: [                                 // 選択肢。値がそのまま category に入る
      { v: "",     label: "未設定", color: "gray"  },
      { v: "弱小", label: "弱小",   color: "blue"  },
      { v: "中堅", label: "中堅",   color: "amber" },
      { v: "競合", label: "競合",   color: "red"   },
    ],
    omit: ["note"],                         // 確認内容は使わない
    search: "ショップ名・URLで検索…", add: "＋ 追加",
    emptyTtl: "まだ登録がありません",
    emptySub: "見て回るライバル店を登録しておくと、強さごとに並べて巡回できます。" },
  { key: "products", icon: "📦", label: "追加した商品", nameLabel: "商品名",
    accent: "#2b8a63", tint: "#e8f5ee", role: "作業リスト",
    desc: "拾った商品を追加日ごとに並べて、上から順に確認・買付まで処理していく場所。",
    kind: "added", defSort: "addedAt", urlFields: ["url"],
    search: "商品名・URL・出所で検索…", add: "＋ 商品を追加",
    emptyTtl: "まだ1件もありません",
    emptySub: "ランキング／ライバルの各行にある「＋ 商品」から追加すると、ここに追加日ごとに並びます。" },
];
const SEC = (k) => SECTIONS.find((s) => s.key === k);

/* 区分（オフェンス / ディフェンス / ライバル）。どれを選ぶかでタブそのものが決まる */
const SIDES = [
  { v: "offense", label: "amazon\nランキング", cls: "sd-off", sec: "amazon"  },
  { v: "defense", label: "楽天\nランキング",   cls: "sd-def", sec: "rakuten" },
  { v: "rival",   label: "楽天\nライバル",     cls: "sd-riv", sec: "rivals"  },
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

/* 商品行のドロップダウン項目。既定の4つ。ユーザーは列管理の「項目管理」で増減できる */
const ST_DEFAULT_FIELDS = [
  { key: "rival", title: "楽天ライバル状況", cols: ["a_rival"], opts: [
    { v: "",      label: "未調査",       color: "gray"  },
    { v: "few",   label: "少数",         color: "blue"  },
    { v: "some",  label: "そこそこいる", color: "amber" },
    { v: "heavy", label: "激戦",         color: "red"   },
  ] },
  { key: "quality", title: "商品品質", cols: ["a_qual"], opts: [
    { v: "",     label: "未調査",  color: "gray"  },
    { v: "low",  label: "4.0以下", color: "amber" },
    { v: "high", label: "4.0以上", color: "green" },
  ] },
  { key: "check", title: "隙あり/なし", cols: ["a_check", "p_check"], opts: [
    { v: "before", label: "未判定", color: "gray"  },
    { v: "after",  label: "隙あり", color: "green" },
    { v: "skip",   label: "隙なし", color: "red"   },
  ] },
  { key: "buy", title: "買付", cols: ["a_buy", "p_buy"], opts: [
    { v: "before", label: "買付前",   color: "gray"   },
    { v: "done",   label: "買付済",   color: "green"  },
    { v: "skip",   label: "スキップ", color: "purple" },
  ] },
];
const ST_DEFAULT = (key) => ST_DEFAULT_FIELDS.find((f) => f.key === key);

/* ---------- 項目そのものの増減（data.fields） ----------
   既定の4つは列キーが決まっている（既存の設定を壊さないため）。
   増やした項目は added / pick どちらの表でも `st_<key>` を使う。 */
const FIELD_COLS = {
  rival:   { added: "a_rival", pick: "a_rival" },
  quality: { added: "a_qual",  pick: "a_qual"  },
  check:   { added: "a_check", pick: "p_check" },
  buy:     { added: "a_buy",   pick: "p_buy"   },
};
const fieldCol = (key, where) => FIELD_COLS[key]?.[where] || ("st_" + key);
/* 商品に値をどこへ持つか。既定の4つは今まで通り直下、増やしたぶんは st の中 */
const BUILTIN_VAL = { check: "check", buy: "buy", rival: "rival", quality: "quality" };
const pickVal = (p, key) => String((BUILTIN_VAL[key] ? p?.[BUILTIN_VAL[key]] : p?.st?.[key]) ?? "");
function setPickVal(p, key, v) {
  if (BUILTIN_VAL[key]) p[BUILTIN_VAL[key]] = v;
  else (p.st ||= {})[key] = v;
}
function ensureFields() {
  if (!Array.isArray(data.fields) || !data.fields.length) {
    data.fields = ST_DEFAULT_FIELDS.map((f) => ({ key: f.key, title: f.title }));
  }
  return data.fields;
}
const stFields = () => ensureFields();
const ST_DEF = (key) => ensureFields().find((f) => f.key === key) || ST_DEFAULT(key);
const hasField = (key) => ensureFields().some((f) => f.key === key);
const newFieldKey = () => "f_" + Math.random().toString(36).slice(2, 7);

/* 見出しは「列管理」で付けた項目名に合わせる（両方の表で同じ lk なので名前は共通） */
function stTitle(key) {
  const f = ST_DEF(key);
  return colLabelOf(fieldCol(key, "added")) || f?.title || "項目";
}
const newOptVal = () => "o_" + Math.random().toString(36).slice(2, 8);

/* 設定（data.labels）を反映した選択肢を返す */
const NEW_FIELD_OPTS = [
  { v: "", label: "未設定", color: "gray" },
  { v: "ok", label: "○", color: "green" },
  { v: "ng", label: "×", color: "red" },
];
function stList(key) {
  const saved = data?.labels?.[key];
  const src = Array.isArray(saved) && saved.length ? saved : (ST_DEFAULT(key)?.opts || NEW_FIELD_OPTS);
  return src.map((o) => ({
    v: String(o.v ?? ""),
    label: o.label || "(未設定)",
    color: SWATCH_OK(o.color) ? o.color : "gray",
    cls: "sw-" + (SWATCH_OK(o.color) ? o.color : "gray"),
  }));
}
const stCls = (list, v) => (list.find((o) => o.v === v) || list[0]).cls;
const stOptions = (list, v) =>
  list.map((o) => `<option value="${esc(o.v)}"${o.v === v ? " selected" : ""}>${esc(o.label)}</option>`).join("");
const stFirst = (key) => stList(key)[0].v;

/* 旧「確認」のまま保存されている場合だけ、新しい既定（隙あり/なし）へ差し替える */
const LEGACY_CHECK = ["確認前", "確認後", "スキップ"];
function upgradeLabels(labels) {
  const c = labels.check;
  if (Array.isArray(c) && c.length === 3 && c.every((o, i) => o.label === LEGACY_CHECK[i])) {
    labels.check = ST_DEFAULT("check").opts.map((o) => ({ ...o }));
  }
  return labels;
}

/* 既にきちんとした形なら作り直さない（同じ配列を返し続ける） */
function ensureLabels() {
  const ok = data.labels && stFields().every((f) =>
    Array.isArray(data.labels[f.key]) && data.labels[f.key].length);
  if (!ok) data.labels = normLabels(data.labels, stFields());
  return data.labels;
}

/* 保存用に整える。項目の増減・並べ替えができるので中身は自由 */
function normLabels(raw, fields) {
  const out = {};
  for (const f of (fields || ST_DEFAULT_FIELDS)) {
    const def = ST_DEFAULT(f.key)?.opts || NEW_FIELD_OPTS;
    const saved = Array.isArray(raw?.[f.key]) ? raw[f.key] : null;
    const src = saved && saved.length ? saved : def;
    const list = src
      .filter((o) => o && typeof o === "object")
      .map((o) => ({
        v: String(o.v ?? ""),
        label: String(o.label || "").slice(0, 24) || "(未設定)",
        color: SWATCH_OK(o.color) ? o.color : "gray",
      }))
      .filter((o, i, a) => a.findIndex((x) => x.v === o.v) === i);   // 値の重複は落とす
    out[f.key] = list.length ? list : def.map((o) => ({ ...o }));
  }
  return out;
}

/* ---------- 色つきドロップダウン ----------
   <select> は展開したときの各行の色をブラウザに任せるしかないので、自前で描く。 */
function stButton(list, v, attrs, extraCls) {
  const cur = list.find((o) => o.v === v) || list[0];
  return `<button type="button" class="st-sel ${cur.cls}${extraCls ? " " + extraCls : ""}" ${attrs}
    title="${esc(cur.label)}"><span class="st-lb">${esc(cur.label)}</span><span class="st-ar">▾</span></button>`;
}

let stMenuClose = null;
function closeStMenu() {
  if (stMenuClose) { stMenuClose(); stMenuClose = null; }
}
function openStMenu(btn, list, value, onPick) {
  closeStMenu();
  const box = $("stMenu");
  box.innerHTML = list.map((o) =>
    `<button type="button" class="${o.cls}${o.v === value ? " on" : ""}" data-v="${esc(o.v)}">${esc(o.label)}</button>`).join("");
  box.hidden = false;

  const r = btn.getBoundingClientRect();
  const h = box.offsetHeight;
  const w = Math.max(box.offsetWidth, r.width);
  box.style.minWidth = r.width + "px";
  const below = window.innerHeight - r.bottom;
  box.style.top  = (below >= h + 8 || r.top < h + 8 ? r.bottom + 4 : r.top - h - 4) + "px";
  box.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, r.left)) + "px";
  btn.classList.add("st-open");

  box.querySelectorAll("button").forEach((b) => {
    b.onclick = (e) => { e.stopPropagation(); closeStMenu(); onPick(b.dataset.v); };
  });

  const away = (e) => { if (!box.contains(e.target) && e.target !== btn) closeStMenu(); };
  const esc2 = (e) => { if (e.key === "Escape") closeStMenu(); };
  setTimeout(() => document.addEventListener("mousedown", away), 0);
  document.addEventListener("keydown", esc2);
  window.addEventListener("scroll", closeStMenu, true);
  window.addEventListener("resize", closeStMenu);

  stMenuClose = () => {
    box.hidden = true;
    btn.classList.remove("st-open");
    document.removeEventListener("mousedown", away);
    document.removeEventListener("keydown", esc2);
    window.removeEventListener("scroll", closeStMenu, true);
    window.removeEventListener("resize", closeStMenu);
  };
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
/* ---------- URL欄を「URL」で扱うか「文字」で扱うか ----------
   楽天/AmazonのURL欄には、URLではなく覚え書きを書きたいことがある。
   modes[項目] === "text" のときはリンクにせず、そのまま文字として出す。 */
const URL_MODE_FIELDS = ["url", "urlAmazon", "urlRakuten"];
const normModes = (m) => {
  const out = {};
  for (const f of URL_MODE_FIELDS) if (m?.[f] === "text") out[f] = "text";
  return out;
};
const isTextMode = (o, field) => o?.modes?.[field] === "text";
function setUrlMode(o, field, mode) {
  o.modes = o.modes || {};
  if (mode === "text") o.modes[field] = "text"; else delete o.modes[field];
}
/* URL / 文字 の切り替え（右端の小さなボタン） */
const modeToggle = (attr, text) => `<span class="url-mode">
    <button type="button" class="${text ? "on" : ""}" ${attr} data-mode="text" title="文字として扱う">文字</button>
    <button type="button" class="${text ? "" : "on"}" ${attr} data-mode="url" title="URLとして扱う">URL</button>
  </span>`;
/* 編集中のURL欄（入力＋文字/URLの切り替え）。切り替えは入力値を消さずにその場で効く */
function urlEditCell(o, field, label) {
  const t = isTextMode(o, field);
  return `<td class="td-url"><div class="url-cell">
    <input class="input-sm pe-url url-main" type="${t ? "text" : "url"}" data-pf="${field}" data-pfmode="${t ? "text" : "url"}"
           data-ph="${esc(label)}" value="${esc(o[field] || "")}" placeholder="${t ? "文字" : esc(label)}">
    ${modeToggle(`data-editmode="${esc(field)}"`, t)}
  </div></td>`;
}

/* 一覧のセルの中身。切り替えボタンは出さない（編集画面だけに置く） */
function urlCellHtml(o, field, cut) {
  const v = o[field] || "";
  if (!v) return '<span class="dash">—</span>';
  return isTextMode(o, field)
    ? `<span class="url-plain" title="${esc(v)}">${esc(v)}</span>`
    : `<a href="${esc(v)}" target="_blank" rel="noopener noreferrer" title="${esc(v)}">${esc(prettyUrl(v, cut))}</a>${dupTag(v)}`;
}

/* パンくず（A > B > C）は「>」で改行して見せる。1段ずつ縦に並ぶので読みやすい */
function breadcrumbHtml(v) {
  const parts = esc(v).split(/\s*&gt;\s*/);
  if (parts.length < 2) return esc(v);
  return parts.map((x, i) => (i < parts.length - 1 ? `${x} &gt;` : x)).join("<br>");
}

/* ---------- 同じURLが他にも入っていないか ----------
   AmazonはASIN、それ以外はホスト+パスで同じものと見なす（www・末尾スラッシュ・?以降は無視）。 */
function urlKey(u) {
  const t = String(u || "").trim();
  if (!t) return "";
  const asin = asinOf(t);
  if (asin) return "amz:" + asin;
  try {
    const x = new URL(t);
    return (x.hostname.replace(/^www\./, "") + x.pathname.replace(/\/+$/, "")).toLowerCase();
  } catch { return t.toLowerCase(); }
}
let urlCount = new Map();
/* 画面を描くたびに数え直す（行・商品の両方をまとめて1つの帳簿にする） */
function buildUrlIndex() {
  const m = new Map();
  const add = (u) => { const k = urlKey(u); if (k) m.set(k, (m.get(k) || 0) + 1); };
  for (const sec of SECTIONS) {
    if (sec.kind === "added") continue;                 // 追加した商品は他タブの商品の写し
    for (const it of itemsOf(sec.key)) {
      for (const f of URL_MODE_FIELDS) if (!isTextMode(it, f)) add(it[f]);
      for (const p of it.picks) for (const f of URL_MODE_FIELDS) if (!isTextMode(p, f)) add(p[f]);
    }
  }
  urlCount = m;
}
const urlDupes = (u) => Math.max(0, (urlCount.get(urlKey(u)) || 0) - 1);
/* URLの下に出す小さな印（押せない） */
function dupTag(u) {
  if (!String(u || "").trim()) return "";
  const n = urlDupes(u);
  return n
    ? `<span class="url-dup multi" title="同じURLが他に${n}件あります">他あり ${n}</span>`
    : `<span class="url-dup uniq" title="このURLはここだけです">唯一</span>`;
}

/* URLがどちら側のものか。判別できなければタブの基準側に寄せる */
function urlSideOf(url, sectionKey) {
  if (isAmazonUrl(url)) return "amazon";
  if (isRakutenUrl(url)) return "rakuten";
  return sideKeyOf(sectionKey);
}
/* その行から見た代表のURL・画像（基準側を先に見る） */
const pickUrl = (p, sec) => sideKeyOf(sec) === "rakuten"
  ? (p.urlRakuten || p.urlAmazon) : (p.urlAmazon || p.urlRakuten);
const pickImg = (p, sec) => sideKeyOf(sec) === "rakuten"
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

/* ---------- 楽天のページからジャンル名（パンくず）を取る ----------
   ブラウザから楽天は直接読めないので、画像取得と同じ中継サービス越しに読む。
   中継が詰まると取れないことがあるので、取れなかったときは黙って何もしない（手入力はいつでもできる）。 */
const GENRE_DROP = /^(楽天市場トップ|楽天市場|ランキングトップ|ランキング|デイリーランキング|リアルタイムランキング|トップ|ホーム|home|top|rakuten)$/i;
const genreClean = (arr) => arr
  .map((t) => String(t || "").replace(/\s+/g, " ").trim())
  .filter((t) => t && t.length < 40 && !GENRE_DROP.test(t))
  .filter((t, i, a) => a.indexOf(t) === i);
/* 「【楽天市場】家電 | 人気・おすすめランキング…」→「家電」 */
function genreFromTitle(t) {
  let x = String(t || "").replace(/\s+/g, " ").trim();
  if (!x) return "";
  x = x.replace(/^【[^】]*】\s*/, "").split(/[|｜]/)[0].trim();
  x = x.replace(/(の)?(売れ筋|人気)?ランキング$/, "").trim();
  return GENRE_DROP.test(x) ? "" : x.slice(0, 60);
}
/* 取ってきた中身（HTMLでも r.jina.ai の素のテキストでも）からジャンル名を組み立てる */
function genreFromPage(txt) {
  /* 1) 構造化データ */
  for (const m of txt.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const list = [].concat(JSON.parse(m[1].trim()));
      for (const o of list) {
        if (o && o["@type"] === "BreadcrumbList" && Array.isArray(o.itemListElement)) {
          const names = genreClean(o.itemListElement.map((x) => x?.name || x?.item?.name || ""));
          if (names.length) return names.join(" > ");
        }
      }
    } catch { /* noop */ }
  }
  /* 2) HTMLのパンくず */
  if (/<\/(html|body|nav|div)>/i.test(txt)) {
    try {
      const doc = new DOMParser().parseFromString(txt, "text/html");
      const sel = '[class*="readcrumb"],[id*="readcrumb"],[class*="ankuzu"],[class*="pan-kuzu"],nav[aria-label*="パンくず"]';
      for (const el of doc.querySelectorAll(sel)) {
        const names = genreClean([...el.querySelectorAll("a")].map((x) => x.textContent));
        if (names.length) return names.join(" > ");
      }
      const t = genreFromTitle(doc.querySelector("h1")?.textContent) ||
                genreFromTitle(doc.querySelector("title")?.textContent);
      if (t) return t;
    } catch { /* noop */ }
  }
  /* 3) 素のテキスト（r.jina.ai はマークダウンで返ってくる） */
  const line = txt.split(/\n+/).find((l) => l.includes("楽天市場トップ") && /[>›»]/.test(l));
  if (line) {
    const names = genreClean(line.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").split(/[>›»]/));
    if (names.length) return names.join(" > ");
  }
  const tt = (txt.match(/^Title:\s*(.+)$/mi) || txt.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
  return genreFromTitle(tt);
}
/* Amazonのパンくず（#wayfinding-breadcrumbs_feature_div）。無ければタイトルから */
function amazonGenreFromHtml(txt) {
  try {
    const doc = new DOMParser().parseFromString(txt, "text/html");
    const box = doc.querySelector("#wayfinding-breadcrumbs_feature_div, .a-breadcrumb, #nav-subnav");
    if (box) {
      const names = genreClean([...box.querySelectorAll("a")].map((x) => x.textContent));
      if (names.length) return names.join(" > ");
    }
  } catch { /* noop */ }
  /* 「Amazon.co.jp: 靴ケア用品」「Amazon 売れ筋ランキング: シューケア用品 の中で最も人気のある商品です」など */
  const t = (txt.match(/^Title:\s*(.+)$/mi) || txt.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
  let x = String(t).replace(/\s+/g, " ").trim()
    .replace(/^Amazon(\.co\.jp)?[:：]?\s*/i, "")
    .replace(/^売れ筋ランキング[:：]?\s*/, "")
    .replace(/\s*の中で最も人気のある商品です.*$/, "")
    .replace(/\s*\|\s*Amazon.*$/i, "")
    .replace(/【[^】]*】/g, "")
    .trim();
  return GENRE_DROP.test(x) ? "" : x.slice(0, 60);
}

/* ---------- 日本語で取ってくるための細工（v0.89.0） ----------
   中継サービスは日本語ブラウザではないので、Amazonが英語のページを返してくることがある。
   ①URLで日本語を指定する ②Accept-Language を日本語で送る ③英語が返ってきたら採用しない、の3段構え。 */
const looksJa = (s) => /[^\x00-\x7F]/.test(String(s || ""));   // 非ASCII＝日本語が混じっている
const JA_HEADERS = { "Accept-Language": "ja-JP,ja;q=0.9" };     // CORSの安全リスト。preflightは出ない

/* Amazonは `/-/ja/` と `language=ja_JP` で日本語のページになる。楽天はそのまま */
function jaUrl(url) {
  try {
    const u = new URL(url);
    if (!isAmazonUrl(url)) return url;
    u.pathname = u.pathname.replace(/^\/-\/[a-z]{2}(_[A-Za-z]{2})?\//i, "/");   // /-/en/ を外す
    const asin = asinOf(url);
    if (asin) u.pathname = `/-/ja/dp/${asin}`;
    else u.pathname = "/-/ja" + u.pathname;
    u.searchParams.set("language", "ja_JP");
    return u.href;
  } catch { return url; }
}

/* 中継サービスを順に試して、最初に取れた「日本語の」ジャンル名を返す */
async function fetchGenre(url, log = () => {}) {
  const amazon = isAmazonUrl(url);
  if (!amazon && !isRakutenUrl(url)) { log("ジャンル", "楽天/AmazonのURLではない"); return ""; }
  const list = proxyList();
  if (!list.length) { log("ジャンル", "中継なしの設定のためスキップ"); return ""; }
  const target = jaUrl(url);
  if (target !== url) log("ジャンル", `日本語で開く → ${target}`);
  let en = "", enTries = 0;                                     // 英語で返ってきたぶん（保険）
  for (const tpl of list) {
    const via = (() => { try { return new URL(tpl.replace("{url}", "")).hostname; } catch { return tpl; } })();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 9000);
      const res = await fetch(tpl.replace("{url}", encodeURIComponent(target)),
        { signal: ctrl.signal, headers: JA_HEADERS });
      clearTimeout(timer);
      if (!res.ok) { log("ジャンル", `${via} → HTTP ${res.status}`); continue; }
      const body = (await res.text()).slice(0, 900000);
      const name = amazon ? amazonGenreFromHtml(body) : genreFromPage(body);
      if (name && looksJa(name)) { log("ジャンル", `${via} → ${name}`); return name; }
      if (name) {
        en = en || name; enTries++;
        log("ジャンル", `${via} → 英語で返ってきた（${name}）。次の中継を試す`);
        /* 3本続けて英語なら、そのページは中継相手には英語でしか出てこない。粘らず切り上げる */
        if (enTries >= 3) { log("ジャンル", "3本続けて英語だったので打ち切る"); break; }
        continue;
      }
      log("ジャンル", `${via} → 取れたがパンくずが見つからない`);
    } catch (e) {
      log("ジャンル", `${via} → ${e.name === "AbortError" ? "タイムアウト" : "つながらない"}`);
    }
  }
  if (en) log("ジャンル", `日本語では取れなかった（英語では「${en}」）。英語は入れずにおく`);
  return "";
}
/* ジャンル名を自動で入れるタブか（ランキングの2つだけ。ライバルは店名なので対象外） */
const autoGenreTab = (key) => key === "amazon" || key === "rakuten";

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
    fields: normFields(null),
    labels: normLabels(null, null),
    cols: normCols(null),
    sections: Object.fromEntries(SECTIONS.map((s) => [s.key, { items: [] }])),
  };
}
const itemsOf = (key) => (data.sections[key] ||= { items: [] }).items;

const normSt = (o) => {
  const out = {};
  for (const [k, v] of Object.entries(o || {})) if (v != null) out[String(k).slice(0, 24)] = String(v).slice(0, 40);
  return out;
};
function normRank(it) {
  return {
    id:        it.id || uid(),
    name:      it.name || "",
    category:  it.category || "未分類",
    image:     it.image || "",              // アイキャッチ画像URL
    url:       it.url || "",
    urlAmazon: it.urlAmazon || "",        // Amazon側のURL
    urlRakuten: it.urlRakuten || "",      // 楽天側のURL
    nameAmazon: it.nameAmazon || "",        // amazon側のジャンル名
    modes:     normModes(it.modes),         // URL欄を文字として扱うか
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
        modes:   normModes(p.modes),               // URL欄を文字として扱うか
        image:   p.image || "",                    // 旧形式（移行に使う）
        url:     p.url || "",                      // 同上
        title:   p.title || p.note || p.name || "", // 商品名（旧 note / name から移行）
        check:   String(p.check ?? "before"),
        buy:     String(p.buy ?? "before"),
        sales30: p.sales30 == null ? "" : String(p.sales30),      // 30日販売数（自由入力）
        rival:   String(p.rival ?? ""),
        quality: String(p.quality ?? ""),
        st:      normSt(p.st),                     // 増やした項目の値
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
  out.fields = normFields(d?.fields);
  out.labels = upgradeLabels(normLabels(d?.labels, out.fields));
  out.cols   = normCols(d?.cols);
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
  reconcileLabels(out);
  return out;
}

/* 選択肢が消された場合、その値を使っている商品を先頭の選択肢に寄せる */
/* 項目そのもの（並び・名前）の保存用 */
function normFields(raw) {
  const list = (Array.isArray(raw) ? raw : ST_DEFAULT_FIELDS)
    .filter((f) => f && typeof f === "object" && f.key)
    .map((f) => ({ key: String(f.key).slice(0, 24), title: String(f.title || "").slice(0, 24) || "項目" }))
    .filter((f, i, a) => a.findIndex((x) => x.key === f.key) === i)
    .slice(0, 20);
  return list;
}

function reconcileLabels(d) {
  for (const f of (d.fields || ST_DEFAULT_FIELDS)) {
    const ok = new Set((d.labels[f.key] || []).map((o) => o.v));
    const first = (d.labels[f.key] || [{ v: "" }])[0].v;
    for (const sec of Object.values(d.sections)) {
      for (const it of sec.items) {
        for (const p of it.picks) if (!ok.has(pickVal(p, f.key))) setPickVal(p, f.key, first);
      }
    }
  }
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
/* 旧版の localStorage に入っていた列幅を、一度だけ data.cols へ移す */
function migrateColsFromLocal() {
  const c = ensureCols();
  if (!colW || !Object.keys(colW).length) return;
  /* すでに設定済みなら触らない */
  if (COL_GROUPS.some((g) => Object.keys(c.layout[g] || {}).length)) return;
  for (const [k, v] of Object.entries(colW)) {
    if (k === "_rowH") c.rowH = Number(v) || ROW_H_DEF;
    else if (k === "_pickRowH") c.pickRowH = Number(v) || PROW_H_DEF;
    else if (Number(v) >= 40) for (const g of COL_GROUPS) (c.layout[g] ||= {})[k] = { w: Number(v) };
  }
  data.cols = normCols(c);
}
function saveCols() { persistLocal(); markDirty(true); }

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
const colWidth = (c, grp) => (colBox(grp, c.key).w ?? c.w);
/* 表編集中は画像URL欄が入るので画像列を広げる（一覧表だけ） */
const effWidth = (c, grp = colGroupOf(view)) =>
  (tableEdit && c.key === "img" ? Math.max(colWidth(c, grp), 170) : colWidth(c, grp));

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

/* タブごとに色を差し替えて、役割の違いを見た目でも分ける */
function applySecTheme() {
  const s = SEC(view);
  const r = document.documentElement.style;
  r.setProperty("--sec", s.accent || "var(--accent)");
  r.setProperty("--sec-soft", s.tint || "var(--row-alt)");
  document.body.dataset.view = view;
  document.body.dataset.kind = s.kind || "list";
}

/* タブの下の帯。巡回リストは役割の説明、作業リストは進み具合を出す */
function renderSecBand() {
  const s = SEC(view);
  const band = $("secBand");
  const pill = `<span class="sec-role">${s.icon} ${esc(s.role || "")}</span>`;

  if (s.kind === "added") {
    const rows = allPicks();
    const chip = (field, o) => {
      const n = rows.filter((r) => pickVal(r.p, field) === o.v).length;
      return n ? `<span class="sec-chip ${o.cls}">${esc(o.label)} <b>${n}</b></span>` : "";
    };
    const today0 = rows.filter((r) => r.p.addedAt === today()).length;
    band.innerHTML = pill +
      `<span class="sec-stat">今日 <b>${today0}</b> 件 / 全 <b>${rows.length}</b> 件</span>` +
      (hasField("check") ? `<span class="sec-chips">${stList("check").map((o) => chip("check", o)).join("")}</span>` : "") +
      (hasField("buy") ? `<span class="sec-chips">${stList("buy").map((o) => chip("buy", o)).join("")}</span>` : "");
    return;
  }
  const n = itemsOf(view).length;
  const picks = itemsOf(view).reduce((t, it) => t + it.picks.length, 0);
  const stale = itemsOf(view).filter((it) => { const d = daysSince(it.checkedAt); return d == null || d > STALE_DAYS; }).length;
  band.innerHTML = pill +
    `<span class="sec-stat">${esc(s.unit || "ジャンル")} <b>${n}</b> / 拾った商品 <b>${picks}</b>` +
    (stale ? ` / <span class="sec-stale">${STALE_DAYS}日以上みてない <b>${stale}</b></span>` : "") + `</span>` +
    `<span class="sec-desc">${esc(s.desc || "")}</span>`;
}

function renderHeadBits() {
  $("repoBadge").textContent = cfg.owner && cfg.repo ? `${cfg.owner}/${cfg.repo}` : "未設定";
  $("repoBadge").classList.toggle("unset", !(cfg.owner && cfg.repo));
  $("verLabel").textContent = "v" + VERSION;
}

function categories(key) {
  const fixed = catList(key);
  if (fixed.length) {                       // 決まった選択肢のタブ（強さ など）
    const used = new Set(itemsOf(key).map((i) => i.category || "未分類"));
    const out = fixed.filter((o) => o.v).map((o) => o.v);
    if (used.has("未分類")) out.unshift("未分類");
    return out;
  }
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
  /* ジャンル名を自動で入れられるタブ（ランキング2つ）だけに出す */
  $("btnGenreAll").hidden = !autoGenreTab(view);
  if (!genreAllBusy) paintGenreAllBtn();

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

  if ((SEC(view).omit || []).includes("cat")) { $("catSeg").innerHTML = ""; return; }
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
      const hay = [it.name, it.nameAmazon, it.category, it.url, it.urlAmazon, it.urlRakuten, it.checkNote,
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
      case "name":       return it.name || it.model || "";
      case "nameAmazon": return it.nameAmazon || "";
      case "model":     return it.model || "";
      case "category": {
        /* 決まった選択肢のタブ（強さ）は、選択肢の並び順で揃える */
        const list = catList(view);
        if (list.length) {
          const i = list.findIndex((o) => o.v === (it.category || ""));
          return String(i < 0 ? 99 : i).padStart(3, "0");
        }
        return it.category || "";
      }
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
  closeStMenu();
  buildUrlIndex();
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

  renderSecBand();
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
      /* URLを入れて、そのモールのジャンル名が空なら、パンくずから入れてみる */
      const GF = { urlRakuten: "name", urlAmazon: "nameAmazon" };
      if (GF[f] && v && !it[GF[f]] && autoGenreTab(view) && !isTextMode(it, f)) {
        const sec = view, id = it.id, target = GF[f];
        fetchGenre(v).then((name) => {
          const cur = itemsOf(sec).find((x) => x.id === id);
          if (!name || !cur || cur[target]) return;
          cur[target] = name; cur.updatedAt = nowIso();
          upsert(sec, cur);
          toast(`ジャンル名を取り込みました：${name}`);
        });
      }
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
  // 大カテゴリ（決まった選択肢のタブ）
  root.querySelectorAll("[data-cat]").forEach((btn) => {
    btn.onclick = () => {
      const it = itemsOf(view).find((i) => i.id === btn.dataset.cat);
      if (!it) return;
      openStMenu(btn, catList(view), it.category || "", (v) => {
        it.category = v;
        it.updatedAt = nowIso();
        upsert(view, it);
      });
    };
  });
  // 区分：選び直すとその区分のタブへ行が移る
  root.querySelectorAll("[data-side]").forEach((btn) => {
    btn.onclick = () => {
      const from = view;
      openStMenu(btn, SIDES, SEC(from).side, (v) => {
        const to = sideSecOf(v);
        const it = itemsOf(from).find((i) => i.id === btn.dataset.side);
        if (!it || to === from) return;
        moveItem(it, from, to);
      });
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
          row.querySelector(".pick-url")?.focus();
          row.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      }, 30);
    };
  });
  root.querySelectorAll("[data-canceladd]").forEach((b) => {
    /* 入力行だけでなく、その下に開いた「チェックした商品」ごとたたむ */
    b.onclick = () => {
      const id = b.dataset.canceladd;
      addRows.delete(id); openRows.delete(id);
      renderBody();
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
    /* 列を非表示にしていると入力欄が無いことがある */
    const inp = (sel) => row.querySelector(sel);
    const val = (sel) => { const el = inp(sel); return el ? el.value.trim() : ""; };
    const add = async () => {
      if (!inp(".pick-url")) { toast("URLの列が非表示です。▦ 列管理 で表示してください", true); return; }
      const url = val(".pick-url");
      if (!url) { toast("商品URLを入力してください", true); inp(".pick-url").focus(); return; }
      const it = itemsOf(view).find((i) => i.id === id);
      const sd = PSIDE(sideKeyOf(view));                 // このタブのモール側に入れる
      const od = PSIDE(sd.k === "amazon" ? "rakuten" : "amazon");
      const image = val(".pick-image");
      const url2  = val(".pick-url2");                   // もう片方のモール（任意）
      const pickId = uid();
      it.picks.unshift({
        id:      pickId,
        addedAt: val(".pick-added") || today(),
        title:   val(".pick-title"),
        urlAmazon: "", urlRakuten: "", imageAmazon: "", imageRakuten: "",
        [sd.url]: url,
        [sd.img]: image,
        [od.url]: url2,
        [od.img]: val(".pick-image2"),
        sales30: val(".pick-sales"),
        ...Object.fromEntries(Object.values(BUILTIN_VAL).map((k) => [k, stFirst(k)])),
        st: Object.fromEntries(stFields().filter((f) => !BUILTIN_VAL[f.key]).map((f) => [f.key, stFirst(f.key)])),
      });
      it.updatedAt = nowIso();
      const sec = view;
      upsert(sec, it);                                   // 追加はここで完了。待たせない
      toast(image ? "商品を追加しました" : "商品を追加しました（画像は裏で取得します）");
      if (!image) fetchPickImage(sec, id, pickId, sd.k); // 画像は裏で取りにいく
      if (url2 && !val(".pick-image2")) fetchPickImage(sec, id, pickId, od.k);
      setTimeout(() => {
        const next = $("list").querySelector(`tr.pick-new[data-for="${id}"] .pick-url`);
        if (next) next.focus();
      }, 30);
    };
    const addBtn = row.querySelector(".pick-add");
    if (addBtn) addBtn.onclick = add;
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
  root.querySelectorAll("[data-pickstatus]").forEach((btn) => {
    const [id, pid, field] = btn.dataset.pickstatus.split("|");
    btn.onclick = () => {
      const at0 = locatePick(`${id}|${pid}`);
      if (!at0) return;
      const list = stList(field);
      openStMenu(btn, list, pickVal(at0.p, field), (v) => {
        const at = locatePick(`${id}|${pid}`);
        if (!at) return;
        setPickVal(at.p, field, v);
        at.it.updatedAt = nowIso();
        persistLocal(); markDirty(true);
        const cur = list.find((o) => o.v === v) || list[0];
        btn.className = "st-sel " + cur.cls;
        btn.title = cur.label;
        btn.querySelector(".st-lb").textContent = cur.label;
        const row = btn.closest("tr");
        if (row) row.classList.toggle("pk-ng", pickAlert(at.p));
      });
    };
  });
  root.querySelectorAll("[data-pickedit]").forEach((b) => {
    b.onclick = () => { editPicks.add(b.dataset.pickedit); renderBody(); };
  });
  root.querySelectorAll("[data-pickcancel]").forEach((b) => {
    b.onclick = () => { editPicks.delete(b.dataset.pickcancel); renderBody(); };
  });
  /* 編集中の行の「文字 / URL」。入力値は消さずに、その場で入力欄の型だけ変える */
  root.querySelectorAll("[data-editmode]").forEach((b) => {
    b.onclick = () => {
      const box = b.closest(".url-cell");
      const inp = box.querySelector("[data-pf]");
      const mode = b.dataset.mode;
      inp.dataset.pfmode = mode;
      inp.type = mode === "text" ? "text" : "url";
      inp.placeholder = mode === "text" ? "文字" : (inp.dataset.ph || inp.placeholder);
      box.querySelectorAll("[data-editmode]").forEach((x) =>
        x.classList.toggle("on", x.dataset.mode === mode));
      inp.focus();
    };
  });
  root.querySelectorAll("[data-picksave]").forEach((b) => {
    const key = b.dataset.picksave;
    const row = root.querySelector(`.pick-editing[data-row="${key}"]`);
    const save = async () => {
      const at = locatePick(key);
      if (!at) return;
      const { it, p, sec } = at;
      /* 入力欄は data-pf に書き込み先の項目名を持たせている。
         列を非表示にしていると欄自体が無いので、その項目は今の値のままになる */
      const next = {};
      row.querySelectorAll("[data-pf]").forEach((el) => {
        next[el.dataset.pf] = el.value.trim();
        if (el.dataset.pfmode) setUrlMode(p, el.dataset.pf, el.dataset.pfmode);   // 文字 / URL
      });
      if (!next.addedAt) delete next.addedAt;                 // 空の日付は今の値を残す

      const after = { ...p, ...next };
      if (!after.urlAmazon && !after.urlRakuten) { toast("URLを空にはできません", true); return; }

      Object.assign(p, next);
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
    const label = colLabel(c);
    if (c.key === "ord") {
      const on = F().sort === "manual";
      return `<th class="c-ord sortable${on ? " on" : ""}" data-sort="manual" ` +
        `title="↑↓ で手動並べ替え。押すと手動⇔自動を切り替えます">${esc(label)}` +
        `${on ? '<span class="sort-mark">手動</span>' : ""}<span class="col-resizer" data-col="ord"></span></th>`;
    }
    const on = c.sort && F().sort === c.sort;
    return `<th class="${c.cls}${c.sort ? " sortable" : ""}${on ? " on" : ""}"${c.sort ? ` data-sort="${c.sort}"` : ""}>` +
      `${esc(label)}${c.sort ? sortMark(c.sort) : ""}` +
      `<span class="col-resizer" data-col="${c.key}"></span></th>`;
  }).join("");

  /* 行の高さに収まる行数だけ、ジャンル名を折り返して見せる */
  const nameLines = Math.max(1, Math.floor((rowH() - 16) / 19));
  const grp = colGroupOf(view);
  return `${alignStyle(COLS, grp, "table.rank-tbl", "tbody tr.r-main")}<div class="tbl-wrap"><table data-grp="${esc(grp)}" class="grid-tbl rank-tbl${tableEdit ? " editing" : ""}" style="--row-h:${rowH()}px;--name-lines:${nameLines}">
    <colgroup>${cols}</colgroup>
    <thead><tr>${heads}</tr></thead>
    <tbody>${list.map(rankRow).join("")}</tbody>
  </table></div>`;
}

/* 列ごとの揃えを nth-child で流し込む（セルの生成箇所を触らずに済む）。
   セルの中身は文字だけでなく、入力欄・画像・flexの塊もあるのでまとめて寄せる。 */
function alignStyle(cols, grp, tableSel, rowSel = "tbody tr") {
  const FLEX = { left: "flex-start", center: "center", right: "flex-end" };
  const rules = cols.map((c, i) => {
    const a = colAlign(c, grp);
    if (!a) return "";
    const n = i + 1;
    const S = `#list ${tableSel}`;
    const cell = `${S} ${rowSel} > td:nth-child(${n})`;
    const ml = a === "left"  ? "0" : "auto";
    const mr = a === "right" ? "0" : "auto";
    return [
      `${S} th:nth-child(${n}),${cell}{text-align:${a}}`,
      `${cell} input,${cell} textarea{text-align:${a}}`,
      `${cell} img,${cell} .thumb,${cell} .pick-thumb{margin-left:${ml};margin-right:${mr}}`,
      `${cell} .ord-cell,${cell} .st-sel{justify-content:${FLEX[a]}}`,
      `${cell} .check-cell{align-items:${FLEX[a]}}`,
      `${cell}.c-img{justify-content:${FLEX[a]}}`,
      `${cell} .src-name,${cell} .r-name{text-align:${a}}`,
    ].join("");
  }).filter(Boolean).join("");
  return rules ? `<style>${rules}</style>` : "";
}

/* ===== 追加した商品（全タブ横断・追加日ごと） ===== */
function addedTable(rows) {
  if (!rows.length) return "";

  const COLS = colsOf("products");
  const cols = COLS.map((c) => {
    const w = colWidth(c, "added");
    return `<col data-col="${c.key}"${w ? ` style="width:${w}px"` : ""}>`;
  }).join("");
  const heads = COLS.map((c) =>
    `<th class="${c.cls}">${esc(colLabel(c))}<span class="col-resizer" data-col="${c.key}"></span></th>`).join("");

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
    return `<tr class="day-row"><td class="day-cell" colspan="${COLS.length}">
        <span class="day-date">${esc(g.day)}</span>
        ${rel ? `<span class="day-rel">${esc(rel)}</span>` : ""}
        <span class="day-cnt">${g.list.length} 件</span>
      </td></tr>` + g.list.map(addedRow).join("");
  }).join("");

  return `${alignStyle(COLS, "added", "table.added-tbl", "tbody tr:not(.day-row)")}<div class="tbl-wrap"><table data-grp="added" class="grid-tbl pick-tbl added-tbl" style="--pick-row-h:${pRowH()}px">
    <colgroup>${cols}</colgroup>
    <thead><tr>${heads}</tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}

function addedRow(r) {
  const { sec, item: it, p } = r;
  const key = `${it.id}|${p.id}`;
  const side = SEC(sec).side;
  const [AMZ, RAK] = PICK_SIDES;
  const editing = editPicks.has(key);

  /* 出所は2行（1行目＝区分、2行目＝ジャンル名） */
  const srcCell = `<td class="td-src">
      ${side ? `<div><span class="src-side ${SIDE(side).cls}">${esc(SIDE(side).label.replace(/\n/g, " "))}</span></div>` : ""}
      <a class="src-name" href="${esc(mainUrl(it, sec))}" target="_blank" rel="noopener noreferrer"
         title="${esc(it.name)}">${esc(it.name)}</a>
    </td>`;

  const imgCell = (sd) =>
    `<td class="td-img" data-pickimg="${esc(key)}|${sd.k}">${pickThumb(it.id, p, sd.k)}</td>`;
  const urlCell = (sd) => `<td class="td-url">${urlCellHtml(p, sd.url, 52)}</td>`;

  /* 列キー → セル。列の並べ替え・非表示にそのまま追従する */
  const cells = editing ? {
    a_src:   `<td class="td-src"><input class="input-sm pe-date" type="date" data-pf="addedAt" value="${esc(p.addedAt)}" title="追加日"></td>`,
    p_aimg:  `<td class="td-img"><input class="input-sm pe-image" type="url" data-pf="imageAmazon" value="${esc(p.imageAmazon)}" placeholder="amazon画像"></td>`,
    p_rimg:  `<td class="td-img"><input class="input-sm pe-image" type="url" data-pf="imageRakuten" value="${esc(p.imageRakuten)}" placeholder="楽天画像"></td>`,
    a_title: `<td class="td-title"><input class="input-sm pe-title" type="text" data-pf="title" value="${esc(p.title)}" placeholder="商品名"></td>`,
    p_aurl:  urlEditCell(p, "urlAmazon", "amazonURL"),
    p_rurl:  urlEditCell(p, "urlRakuten", "楽天URL"),
    a_sales: `<td class="td-sales"><input class="input-sm pe-sales" type="text" inputmode="numeric" data-pf="sales30" value="${esc(p.sales30)}" placeholder="30日販売数"></td>`,
    ...stCellsFor(p, it.id, "added"),
    a_act:   `<td class="td-acts">
      <button class="btn btn-add btn-xs" data-picksave="${esc(key)}">保存</button>
      <button class="icon-btn" data-pickcancel="${esc(key)}" title="やめる">↩</button>
    </td>`,
  } : {
    a_src:   srcCell,
    p_aimg:  imgCell(AMZ),
    p_rimg:  imgCell(RAK),
    a_title: `<td class="td-title${p.title ? "" : " none"}">${esc(p.title || "—")}</td>`,
    p_aurl:  urlCell(AMZ),
    p_rurl:  urlCell(RAK),
    a_sales: `<td class="td-sales">
      <input class="sales-in" type="text" inputmode="numeric" value="${esc(p.sales30)}"
             data-picksales="${esc(key)}" placeholder="—" title="30日販売数">
    </td>`,
    ...stCellsFor(p, it.id, "added"),
    a_act:   `<td class="td-acts">
      <button class="btn btn-edit btn-xs" data-pickedit="${esc(key)}">編集</button>
      <button class="icon-btn" data-pickdel="${esc(key)}" title="削除">✕</button>
    </td>`,
  };
  const tds = colsOf("products")
    .map((c) => cells[c.key] || `<td class="${c.cls}"></td>`).join("");

  if (editing) return `<tr class="pick-editing" data-row="${esc(key)}">${tds}</tr>`;

  const chkColor = hasField("check")
    ? ((stList("check").find((o) => o.v === pickVal(p, "check")) || {}).color || "gray") : "gray";
  const done = hasField("buy") && pickVal(p, "buy") !== stFirst("buy");   // 買付が済んだ行は落ち着かせる
  return `<tr class="wk-row bar-${esc(chkColor)}${done ? " wk-done" : ""}${pickAlert(p) ? " pk-ng" : ""}">${tds}</tr>`;
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

let colTab = "";            // 列管理モーダルでいま見ている表（"lab_xxx" なら項目管理）
let colLabShown = "";       // 項目管理をいま描いてある項目
let colTabView = "";        // そのときのタブ（画面のタブを変えたら追従させる）
/* 列管理モーダル（上部の「▦ 列管理」）。表示する列・並び順・項目名・幅・揃え・行の高さ */
function renderColModal() {
  /* グループ＝設定のまとまり。4つとも常に出す（どのタブからでも設定できるように）。
     amazonランキングと楽天ランキングは列キーが同じなので共通、
     楽天ライバル（rivals）・追加した商品（added）・チェックした商品（pick）はそれぞれ別に持つ。 */
  const added = isAdded(view);
  const pickKey = added ? "amazon" : view;
  const all = [
    { grp: "amazon", ttl: "amazonランキング", note: "このタブだけの設定",
      which: "rowH", val: rowH(), def: ROW_H_DEF, cols: allColsOf("amazon") },
    { grp: "rakuten", ttl: "楽天ランキング", note: "このタブだけの設定",
      which: "rowH", val: rowH(), def: ROW_H_DEF, cols: allColsOf("rakuten") },
    { grp: "rivals", ttl: "楽天ライバル", note: "このタブだけの設定",
      which: "rowH", val: rowH(), def: ROW_H_DEF, cols: allColsOf("rivals") },
    ...ROAM_KEYS.map((k) => ({
      grp: "pick_" + k, ttl: SEC(k).label, note: `「${SEC(k).label}」の行を「N件表示」で開いた表`,
      which: "pickRowH", val: pRowH(), def: PROW_H_DEF, cols: allPickColsOf(k),
    })),
    { grp: "added", ttl: "追加した商品", note: "「追加した商品」タブの表",
      which: "pickRowH", val: pRowH(), def: PROW_H_DEF, cols: allColsOf("products") },
  ];
  /* 上のタブで1つ選んで、その表だけを出す */
  const mine = added ? "added" : colGroupOf(view);
  const alsoMine = added ? "" : pickGroupOf(view);           // 開いているタブの「チェックした商品」
  if (colTabView !== view) { colTab = mine; colTabView = view; }        // タブを切り替えたら追従
  const isLab = colTab.startsWith("lab_");                              // 項目管理（選択肢の中身）
  if (!isLab && !all.some((g) => g.grp === colTab)) colTab = mine;
  const cur = isLab ? null : all.find((g) => g.grp === colTab);
  if (cur) cur.now = cur.grp === mine || cur.grp === alsoMine;
  const groups = cur ? [cur] : [];

  const tab = (key, ttl, own) =>
    `<button type="button" class="col-tab${key === colTab ? " on" : ""}${own ? " mine" : ""}"
      data-ctab="${esc(key)}">${esc(ttl)}</button>`;
  const tabRow = (ttl, keys) => `<span class="col-tabs-ttl">${esc(ttl)}</span>` +
    keys.map((k) => {
      const g = all.find((x) => x.grp === k);
      return tab(g.grp, g.ttl, g.grp === mine || g.grp === alsoMine);
    }).join("");
  $("colTabs").innerHTML =
    `<div class="col-tabs-row">${`<span class="col-tabs-ttl">■ 項目管理</span>` +
      stFields().map((f) => tab("lab_" + f.key, stTitle(f.key), false)).join("") +
      `<button type="button" class="col-tab col-tab-add" id="btnFieldAdd" title="項目を増やす">＋ 項目</button>`}</div>` +
    `<div class="col-tabs-row">${tabRow("■ ランキング", ["amazon", "rakuten", "rivals", "added"])}</div>` +
    `<div class="col-tabs-row">${tabRow("■ 展開部分", ROAM_KEYS.map((k) => "pick_" + k))}</div>`;
  $("colTabs").querySelectorAll("[data-ctab]").forEach((b) => {
    b.onclick = () => { colTab = b.dataset.ctab; colLabShown = ""; renderColModal(); };
  });

  /* 項目を増やす */
  $("btnFieldAdd").onclick = () => {
    const f = { key: newFieldKey(), title: "新しい項目" };
    stFields().push(f);
    ensureLabels()[f.key] = NEW_FIELD_OPTS.map((o) => ({ ...o }));
    persistLocal(); markDirty(true);
    colTab = "lab_" + f.key; colLabShown = "";
    renderBody(); renderColModal();
    toast("項目を追加しました");
  };

  /* 項目管理：選択肢の文言と色をここで編集する（設定の🏷ラベルと同じもの） */
  if (isLab) {
    if (colLabShown !== colTab) {          // 入力中に描き直すと打った字が消えるので、同じ項目なら触らない
      $("colModalBody").innerHTML = "";
      renderLabelEditor("colModalBody", colTab.slice(4));
      colLabShown = colTab;
    }
    return;
  }
  colLabShown = "";

  /* 1列＝1行。左から 番号 / 表示 / 項目名 / 幅 / 揃え / 上下 */
  const row = (c, i, list, grp) => {
    const st = colBox(grp, c.key);
    const al = colAlign(c, grp);
    const off = colOff(c.key, grp);
    return `<div class="col-row${off ? " off" : ""}" data-col="${esc(c.key)}" data-grp="${esc(grp)}" data-lk="${esc(lkOf(c.key))}">
      <span class="col-mv">
        <button type="button" class="ord-btn" data-mv="up"${i === 0 ? " disabled" : ""} title="1つ上へ">↑</button>
        <button type="button" class="ord-btn" data-mv="down"${i === list.length - 1 ? " disabled" : ""} title="1つ下へ">↓</button>
      </span>
      <label class="col-chk" title="${off ? "この列を表示する" : "この列を隠す"}">
        <input type="checkbox" data-eye${off ? "" : " checked"}>
        <span></span>
      </label>
      <input class="col-name" type="text" maxlength="24" value="${esc(colLabel(c))}" placeholder="項目名"
             title="項目名はどの表でも共通です">
      <span class="col-w-box">
        <input class="col-w" type="number" min="40" max="1600" step="4" value="${st.w ?? (c.w || "")}" placeholder="${c.w || "自動"}">
        <span class="col-unit">px</span>
      </span>
      <span class="col-al">${ALIGNS.map((a) =>
        `<button type="button" class="${a.v === al ? "on" : ""}" data-al="${a.v}" title="${a.label}揃え">${a.mark}</button>`).join("")}</span>
    </div>`;
  };

  $("colModalBody").innerHTML = groups.map((g) => {
    const on = g.cols.filter((c) => !colOff(c.key, g.grp)).length;
    return `
    <section class="col-grp${g.now ? " now" : ""}" data-grp="${esc(g.grp)}">
      <h3 class="col-grp-ttl">
        ${g.now ? '<span class="col-grp-now">いま開いている表</span>' : ""}
        <span class="col-grp-note">${esc(g.note)}</span>
        <span class="col-grp-cnt">表示 ${on} / ${g.cols.length}</span>
        <span class="grow"></span>
        <span class="col-rowh">行の高さ
          <input class="col-w" type="number" min="30" max="600" step="4" data-rowh="${g.which}" value="${g.val}" placeholder="${g.def}">
          <span class="col-unit">px</span>
        </span>
        <button type="button" class="btn btn-ghost btn-xs" data-allon="${esc(g.grp)}">全部表示</button>
      </h3>
      <div class="col-rows-head">
        <span>移動</span><span>表示</span><span>項目名 <em>共通</em></span><span>幅 <em>表ごと</em></span><span>揃え <em>表ごと</em></span><span></span>
      </div>
      <div class="col-rows">${g.cols.map((c, i) => row(c, i, g.cols, g.grp)).join("")}</div>
    </section>`;
  }).join("");

  /* グループの今の並び（非表示も含む全部）を返す */
  const groupCols = (grp) => (groups.find((g) => g.grp === grp) || { cols: [] }).cols;
  /* その行の既定の項目名（名前を消したときに戻す値） */
  const defLabelOf = (rowEl) => {
    const c = groupCols(rowEl.dataset.grp).find((x) => x.key === rowEl.dataset.col);
    return c ? (c.key === "name" ? SEC(view).nameLabel : c.label) : "";
  };
  const reorder = (grp, from, to) => {
    const list = groupCols(grp).map((c) => c.key);
    if (from < 0 || to < 0 || to >= list.length || from === to) return false;
    list.splice(to, 0, list.splice(from, 1)[0]);
    ensureCols().order[grp] = list;
    return true;
  };
  const redraw = () => { saveCols(); renderBody(); renderColModal(); };

  $("colModalBody").querySelectorAll("[data-allon]").forEach((b) => {
    b.onclick = () => {
      const g = b.dataset.allon;
      ensureCols().hide[g] = hideSet(g).filter((k) => !groupCols(g).some((c) => c.key === k));
      redraw();
    };
  });

  $("colModalBody").querySelectorAll("[data-rowh]").forEach((inp) => {
    inp.oninput = () => {
      const which = inp.dataset.rowh;
      const v = parseInt(inp.value, 10);
      ensureCols()[which] = Number.isFinite(v) && v >= 30 ? v : (which === "rowH" ? ROW_H_DEF : PROW_H_DEF);
      /* pickRowH は「追加した商品」と「チェックした商品」で共通なので、もう片方の欄も合わせる */
      $("colModalBody").querySelectorAll(`[data-rowh="${which}"]`).forEach((o) => { if (o !== inp) o.value = inp.value; });
      saveCols(); renderBody();
    };
  });

  $("colModalBody").querySelectorAll(".col-row[data-col]").forEach((cd) => {
    const key = cd.dataset.col;
    const grp = cd.dataset.grp;
    const box = () => (layoutOf(grp)[key] ||= {});
    const idx = () => groupCols(grp).findIndex((c) => c.key === key);

    /* 表示 / 非表示 */
    cd.querySelector("[data-eye]").onchange = (e) => {
      if (!e.target.checked && groupCols(grp).filter((c) => !colOff(c.key, grp)).length <= 1) {
        toast("最後の1列は隠せません", true); e.target.checked = true; return;
      }
      if (e.target.checked) ensureCols().hide[grp] = hideSet(grp).filter((k) => k !== key);
      else if (!colOff(key, grp)) hideSet(grp).push(key);
      redraw();
    };

    /* ↑↓ でも動かせる */
    cd.querySelectorAll("[data-mv]").forEach((b) => {
      b.onclick = () => {
        const i = idx();
        if (reorder(grp, i, b.dataset.mv === "up" ? i - 1 : i + 1)) redraw();
      };
    });

    /* 項目名は lk 単位＝表をまたいで共通。他の表の同じ項目の欄も一緒に書き換える */
    const nameIn = cd.querySelector(".col-name");
    nameIn.oninput = (e) => {
      const v = e.target.value.slice(0, 24).trim();
      const lk = cd.dataset.lk;
      if (v) ensureCols().labels[lk] = v; else delete ensureCols().labels[lk];
      $("colModalBody").querySelectorAll(`.col-row[data-lk="${lk}"] .col-name`).forEach((o) => {
        if (o !== e.target) o.value = v || defLabelOf(o.closest(".col-row"));
      });
      /* ドロップダウン項目の列なら、上の「項目管理」タブの名前も直す */
      const fk = stFields().find((f) => fieldCol(f.key, "added") === key || fieldCol(f.key, "pick") === key)?.key;
      if (fk) {
        const t = $("colTabs").querySelector(`[data-ctab="lab_${fk}"]`);
        if (t) t.textContent = stTitle(fk);
      }
      saveCols(); renderBody();
    };
    /* 幅と揃えは表ごと */
    cd.querySelector(".col-w").oninput = (e) => {
      const v = parseInt(e.target.value, 10);
      if (Number.isFinite(v) && v >= 40) box().w = v; else delete layoutOf(grp)[key]?.w;
      saveCols(); renderBody();
    };
    cd.querySelectorAll("[data-al]").forEach((b) => {
      b.onclick = () => {
        const cur = colAlign({ key }, grp);
        if (cur === b.dataset.al) delete layoutOf(grp)[key]?.align;
        else box().align = b.dataset.al;
        cd.querySelectorAll("[data-al]").forEach((x) =>
          x.classList.toggle("on", x.dataset.al === colAlign({ key }, grp)));
        saveCols(); renderBody();
      };
    });
  });
}

function openColModal(show = true) {
  $("colModal").hidden = !show;
  $("btnCols").classList.toggle("on", show);
  if (show) renderColModal();
}
const colModalOpen = () => !$("colModal").hidden;

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
        const px = parseInt(col.style.width, 10);
        const grp = table.dataset.grp || colGroupOf(view);
        (layoutOf(grp)[rz.dataset.col] ||= {}).w = px;
        saveCols();
        const inp = document.querySelector(`[data-colw="${rz.dataset.col}"]`);
        if (inp) inp.value = px;
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    };
    // ダブルクリックで既定値に戻す
    rz.ondblclick = (e) => {
      e.stopPropagation();
      delete layoutOf(rz.closest("table").dataset.grp || colGroupOf(view))[rz.dataset.col];
      saveCols(); renderBody(); if (colModalOpen()) renderColModal();
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
    const text = isTextMode(it, c.field);
    return tableEdit
      ? `<td class="c-url"><input class="cell-input mono" type="${text ? "text" : "url"}" data-f="${c.field}" data-id="${esc(it.id)}"
             value="${esc(v)}" placeholder="${esc(text ? "文字" : c.label)}"></td>`
      : `<td class="c-url">${urlCellHtml(it, c.field, 42)}</td>`;
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
            ${stButton(SIDES.map((o) => ({ ...o, cls: o.cls })), v, `data-side="${esc(it.id)}"`, "side-sel")}
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
          : `<td class="c-name">${it.name
              ? (head
                  ? `<a class="r-name" href="${esc(head)}" target="_blank" rel="noopener noreferrer" title="${esc(it.name)}">${breadcrumbHtml(it.name)}</a>`
                  : `<span class="r-name" title="${esc(it.name)}">${breadcrumbHtml(it.name)}</span>`)
              : '<span class="dash">—</span>'}</td>`;
      case "name2": {
        const amz = it.urlAmazon || "";
        return tableEdit
          ? `<td class="c-name"><input class="cell-input" type="text" data-f="nameAmazon" data-id="${esc(it.id)}" value="${esc(it.nameAmazon)}"></td>`
          : `<td class="c-name">${it.nameAmazon
              ? (amz && !isTextMode(it, "urlAmazon")
                  ? `<a class="r-name" href="${esc(amz)}" target="_blank" rel="noopener noreferrer" title="${esc(it.nameAmazon)}">${breadcrumbHtml(it.nameAmazon)}</a>`
                  : `<span class="r-name" title="${esc(it.nameAmazon)}">${breadcrumbHtml(it.nameAmazon)}</span>`)
              : '<span class="dash">—</span>'}</td>`;
      }
      case "cat": {
        const list = catList(view);
        if (list.length) return `<td class="c-cat">
            ${stButton(list, it.category || "", `data-cat="${esc(it.id)}"`)}
          </td>`;
        return tableEdit
          ? `<td class="c-cat"><input class="cell-input" type="text" list="rankCatList" data-f="category" data-id="${esc(it.id)}" value="${esc(it.category)}"></td>`
          : `<td class="c-cat">${esc(it.category || "未分類")}</td>`;
      }
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
        /* 入力行を出している間は、同じ場所が赤の「キャンセル」になる */
        return `<td class="c-addp">${addRows.has(it.id)
          ? `<button class="btn btn-cancel btn-xs" data-canceladd="${esc(it.id)}" title="商品の追加をやめる">✕ キャンセル</button>`
          : `<button class="btn btn-add btn-xs" data-addpick="${esc(it.id)}" title="この行に商品URLを追加">＋ 商品</button>`}
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

/* サムネ1枚。side は "amazon" / "rakuten" */
/* 赤系の選択肢が1つでも付いていたら、その商品は「見送り寄り」。行ごと赤くする */
const NG_COLORS = new Set(["red", "pink"]);
function pickAlert(p) {
  for (const f of stFields()) {
    const cur = stList(f.key).find((o) => o.v === pickVal(p, f.key));
    if (cur && NG_COLORS.has(cur.color)) return true;
  }
  return false;
}

/* 商品1件ぶんの「項目」のセル。列キー → セル で返す */
function stCellsFor(p, itemId, where) {
  const out = {};
  for (const c of stCols(where)) {
    out[c.key] = `<td class="${c.cls}">${stButton(stList(c.field), pickVal(p, c.field),
      `data-pickstatus="${esc(itemId)}|${esc(p.id)}|${esc(c.field)}"`)}</td>`;
  }
  return out;
}

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
  const pickGrp = pickGroupOf(view);
  const cols = pickColsOf(view);
  const sd = PSIDE(sideKeyOf(view));                                  // このタブの基準側
  const od = PSIDE(sd.k === "amazon" ? "rakuten" : "amazon");         // もう片方

  const picks = it.picks
    .slice()
    .sort((a, b) => (b.addedAt || "").localeCompare(a.addedAt || ""))   // 同じ日なら追加が新しい順
    .map((p) => {
      const key = `${it.id}|${p.id}`;
      const editing = editPicks.has(key);
      const imgCell = (x) =>
        `<td class="td-img" data-pickimg="${esc(key)}|${x.k}">${pickThumb(it.id, p, x.k)}</td>`;
      const urlCell = (x) => `<td class="td-url">${urlCellHtml(p, x.url, 62)}</td>`;
      const imgEdit = (x) =>
        `<td class="td-img"><input class="input-sm pe-image" type="url" data-pf="${x.img}" value="${esc(p[x.img])}" placeholder="${esc(x.label)}画像"></td>`;
      const urlEdit = (x) => urlEditCell(p, x.url, `${x.label}のURL  https://…`);

      /* 列キー → セル。列の並べ替え・非表示にそのまま追従する */
      const cells = editing ? {
        p_date:  `<td class="td-date"><input class="input-sm pe-date" type="date" data-pf="addedAt" value="${esc(p.addedAt)}"></td>`,
        p_title: `<td class="td-title"><input class="input-sm pe-title" type="text" data-pf="title" value="${esc(p.title)}" placeholder="商品名"></td>`,
        [sd.imgCol]: imgEdit(sd),
        [sd.urlCol]: urlEdit(sd),
        [od.imgCol]: imgEdit(od),
        [od.urlCol]: urlEdit(od),
        a_sales: `<td class="td-sales"><input class="input-sm pe-sales" type="text" inputmode="numeric" data-pf="sales30" value="${esc(p.sales30)}" placeholder="30日販売数"></td>`,
        ...stCellsFor(p, it.id, "pick"),
        p_act:   `<td class="td-acts">
          <button class="btn btn-add btn-xs" data-picksave="${esc(key)}">保存</button>
          <button class="icon-btn" data-pickcancel="${esc(key)}" title="やめる">↩</button>
        </td>`,
      } : {
        p_date:  `<td class="td-date">${esc(p.addedAt || "—")}</td>`,
        p_title: `<td class="td-title${p.title ? "" : " none"}">${esc(p.title || "—")}</td>`,
        [sd.imgCol]: imgCell(sd),
        [sd.urlCol]: urlCell(sd),
        [od.imgCol]: imgCell(od),
        [od.urlCol]: urlCell(od),
        a_sales: `<td class="td-sales">
          <input class="sales-in" type="text" inputmode="numeric" value="${esc(p.sales30)}"
                 data-picksales="${esc(key)}" placeholder="—" title="30日販売数">
        </td>`,
        ...stCellsFor(p, it.id, "pick"),
        p_act:   `<td class="td-acts">
          <button class="btn btn-edit btn-xs" data-pickedit="${esc(key)}">編集</button>
          <button class="icon-btn" data-pickdel="${esc(key)}" title="削除">✕</button>
        </td>`,
      };
      const tds = cols.map((c) => cells[c.key] || `<td class="${c.cls}"></td>`).join("");
      return editing
        ? `<tr class="pick-editing" data-row="${esc(key)}">${tds}</tr>`
        : `<tr class="${pickAlert(p) ? "pk-ng" : ""}">${tds}</tr>`;
    }).join("");

  /* 「＋ 商品」の空行 */
  const newCells = {
    p_date:  `<td class="td-date"><input class="input-sm pick-added" type="date" value="${esc(today())}"></td>`,
    p_title: `<td class="td-title"><input class="input-sm pick-title" type="text" placeholder="商品名"></td>`,
    [sd.imgCol]: `<td class="td-img"><input class="input-sm pick-image" type="url" placeholder="画像URL"></td>`,
    [sd.urlCol]: `<td class="td-url"><input class="input-sm pick-url" type="url" placeholder="${esc(sd.label)}の商品URL  https://…"></td>`,
    [od.imgCol]: `<td class="td-img"><input class="input-sm pick-image2" type="url" placeholder="画像URL"></td>`,
    [od.urlCol]: `<td class="td-url"><input class="input-sm pick-url2" type="url" placeholder="${esc(od.label)}の商品URL（任意）"></td>`,
    a_sales: `<td class="td-sales"><input class="input-sm pick-sales" type="text" inputmode="numeric" placeholder="30日販売数"></td>`,
    p_act:   `<td class="td-acts"><button class="btn btn-add btn-xs pick-add">追加</button></td>`,
  };
  let newRow = "";
  if (addRows.has(it.id)) {
    const tds = cols.map((c) => newCells[c.key] || `<td class="${c.cls}"></td>`);
    /* 「操作」列を非表示にしていると追加ボタンの居場所が無くなるので、最後の列に置く */
    if (!cols.some((c) => c.key === "p_act") && tds.length) {
      tds[tds.length - 1] = `<td class="${cols[cols.length - 1].cls}"><button class="btn btn-add btn-xs pick-add">追加</button></td>`;
    }
    newRow = `<tr class="pick-new" data-for="${esc(it.id)}">${tds.join("")}</tr>`;
  }

  return `<section class="pick-block">
    <div class="pick-hdr">
      <span class="pick-hdr-ttl">チェックした商品</span>
      <span class="pick-hdr-cnt">${it.picks.length} 件</span>
      <button class="btn btn-ghost btn-xs pick-close" data-rowclose="${esc(it.id)}">✕ 閉じる</button>
    </div>

    ${alignStyle(cols, pickGrp, "table.pick-tbl:not(.added-tbl)")}
    <div class="pick-tbl-wrap"><table data-grp="${esc(pickGrp)}" class="pick-tbl" style="--pick-row-h:${pRowH()}px">
      <colgroup>${cols.map((c) => {
        const w = colWidth(c, pickGrp);
        return `<col data-col="${c.key}"${w ? ` style="width:${w}px"` : ""}>`;
      }).join("")}</colgroup>
      <thead><tr>${cols.map((c) => `<th class="${c.cls}">${esc(colLabel(c))}<span class="col-resizer" data-col="${c.key}"></span></th>`).join("")}</tr></thead>
      <tbody>
        ${newRow}
        ${picks}
        ${!it.picks.length && !addRows.has(it.id) ? `<tr><td class="pick-empty" colspan="${cols.length}">まだありません。右の「＋ 商品」から追加できます。</td></tr>` : ""}
      </tbody>
    </table></div>
  </section>`;
}

/* ヘッダーの実高さをCSS変数へ（表の見出しをこの下に貼り付けるため） */
let headRO = null;
function syncHeadH() {
  const h = document.querySelector(".app-header");
  if (!h) return;
  document.documentElement.style.setProperty("--head-h", Math.round(h.getBoundingClientRect().height) + "px");
}
function watchHeadH() {
  syncHeadH();
  const h = document.querySelector(".app-header");
  if (!h || headRO || typeof ResizeObserver === "undefined") return;
  headRO = new ResizeObserver(() => syncHeadH());
  headRO.observe(h);
}

function renderAll() {
  applySecTheme();
  renderNav(); renderSecBand(); renderToolbar(); renderBody();
  if (colModalOpen()) renderColModal();            // タブで項目が変わるので追従させる
  syncHeadH();
}

/* =========================================================
   編集モーダル
   ========================================================= */
/* ページからジャンル名を取り込む。取れなければ何もしない（手入力はいつでもできる） */
let genreBusy = false;
const GENRE_UI = {
  urlRakuten: { url: "rUrlRak", name: "rName",  btn: "btnGenre",    label: "楽天URLから取得",     via: "楽天" },
  urlAmazon:  { url: "rUrlAmz", name: "rName2", btn: "btnGenreAmz", label: "Amazon URLから取得", via: "Amazon" },
};
async function fillGenre(field, force) {
  const ui = GENRE_UI[field];
  if (genreBusy || !ui || !autoGenreTab(view)) return;
  if ($(ui.btn).hidden) return;
  const url = $(ui.url).value.trim();
  if (!url || isTextMode(entry, field)) return;
  if (!force && $(ui.name).value.trim()) return;          // 自動は空のときだけ
  const btn = $(ui.btn);
  const ph  = $(ui.name).placeholder;
  genreBusy = true;
  btn.disabled = true; btn.textContent = "取得中…";
  $(ui.name).placeholder = `${ui.via}のページから取得中…`;
  const name = await fetchGenre(url);
  genreBusy = false;
  btn.disabled = false; btn.textContent = ui.label;
  $(ui.name).placeholder = ph;
  if (name) { $(ui.name).value = name; toast(`ジャンル名を取り込みました：${name}`); }
  else if (force) toast("ジャンル名が取れませんでした。手で入れてください", true);
}

/* ---------- ジャンル名の一括取得（v0.88.0） ----------
   いま出ている行のうち、ジャンル名が空（表では「—」）のものだけを対象にする。
   すでに入っている名前は絶対に上書きしない。中継サービスは連打すると 429 を返すので、
   同時2本・1本ごとに間を空けて、連続で落ちたら途中で止める。 */
const GENRE_FIELDS = { urlRakuten: "name", urlAmazon: "nameAmazon" };
let genreAllBusy = false, genreAllStop = false;

/* 空のジャンル名 → 取りにいく対象の一覧 */
function genreAllTargets() {
  if (!autoGenreTab(view)) return [];
  const fields = urlFieldsOf(view);
  const out = [];
  for (const it of visibleItems()) {
    for (const f of ["urlRakuten", "urlAmazon"]) {
      if (!fields.includes(f)) continue;
      const target = GENRE_FIELDS[f];
      if ((it[target] || "").trim()) continue;          // 入っているものは触らない
      const url = (it[f] || "").trim();
      if (!url || isTextMode(it, f)) continue;          // 文字モードの欄はURLではない
      out.push({ id: it.id, sec: view, field: f, target, url });
    }
  }
  return out;
}

function paintGenreAllBtn(text) {
  const b = $("btnGenreAll");
  if (!b) return;
  b.textContent = text || "⟳ ジャンル一括取得";
  b.classList.toggle("btn-danger", genreAllBusy);
  b.title = genreAllBusy ? "押すと途中で止める"
    : "ジャンル名が空（—）の行だけ、URLのページから一括で取り込む";
}

async function runGenreAll() {
  if (genreAllBusy) { genreAllStop = true; paintGenreAllBtn("⟳ 止めています…"); return; }
  const jobs = genreAllTargets();
  if (!jobs.length) { toast("空のジャンル名はありません"); return; }

  genreAllBusy = true; genreAllStop = false;
  let done = 0, got = 0, miss = 0, streak = 0, stopped = "";
  paintGenreAllBtn(`⟳ 0/${jobs.length}　■止める`);

  const write = (j, name) => {
    const cur = itemsOf(j.sec).find((x) => x.id === j.id);
    if (!cur || (cur[j.target] || "").trim()) return false;   // 走っている間に入っていたら触らない
    cur[j.target] = name; cur.updatedAt = nowIso();
    return true;
  };

  let next = 0;
  const worker = async () => {
    while (next < jobs.length && !genreAllStop && !stopped) {
      const j = jobs[next++];
      let name = "";
      try { name = await fetchGenre(j.url); } catch { name = ""; }
      done++;
      if (name) { if (write(j, name)) got++; streak = 0; }
      else { miss++; streak++; }
      paintGenreAllBtn(`⟳ ${done}/${jobs.length}　■止める`);
      if (streak >= 6) { stopped = "中継サービスが応答しません。時間をおいて試してください"; break; }
      await new Promise((r) => setTimeout(r, 400));           // 中継をいたわる
    }
  };
  await Promise.all([worker(), worker()]);

  const byUser = genreAllStop;
  genreAllBusy = false; genreAllStop = false;
  paintGenreAllBtn();
  if (got) { persistLocal(); markDirty(true); }
  renderAll();
  if (stopped)      toast(`${got}件入れたところで中断しました。${stopped}`, true);
  else if (byUser)  toast(`途中で止めました（${got}件入れました。残りはもう一度押せば続きから）`);
  else toast(`ジャンル名を ${got}件 入れました${miss ? `（取れなかった ${miss}件はそのまま）` : ""}`, !got);
}

/* URL欄の「文字 / URL」。切り替えると入力欄の型と entry.modes が変わる */
const URL_MODE_UI = {
  url:        { box: "mUrl",    input: "rUrl",    ph: "https://…" },
  urlAmazon:  { box: "mUrlAmz", input: "rUrlAmz", ph: "https://www.amazon.co.jp/…" },
  urlRakuten: { box: "mUrlRak", input: "rUrlRak", ph: "https://ranking.rakuten.co.jp/…" },
};
function paintUrlMode(field) {
  const ui = URL_MODE_UI[field];
  if (!ui) return;
  const text = isTextMode(entry, field);
  $(ui.box).innerHTML = modeToggle(`data-rankmode="${field}"`, text).replace(/^<span class="url-mode">|<\/span>$/g, "");
  $(ui.input).type = text ? "text" : "url";
  $(ui.input).placeholder = text ? "文字（URL以外の覚え書き）" : ui.ph;
  $(ui.box).querySelectorAll("[data-rankmode]").forEach((b) => {
    b.onclick = () => {
      setUrlMode(entry, field, b.dataset.mode);
      paintUrlMode(field);
      $(ui.input).focus();
    };
  });
}
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

  /* URL → そのモールのジャンル名、の順に並べ直す */
  const NAME_BOX = { urlRakuten: "fName", url: "fName", urlAmazon: "fName2" };
  const urlWrap = $("rUrlFields");
  [...Object.values(FIELD_BOX), "fName", "fName2"].forEach((id) => { $(id).hidden = true; });
  fields.forEach((f) => {                                // 並び順もタブに合わせる
    const box = $(FIELD_BOX[f]);
    box.hidden = false;
    urlWrap.appendChild(box);
    const nb = NAME_BOX[f];
    if (nb) { $(nb).hidden = false; urlWrap.appendChild($(nb)); }
  });
  if ($("fName").hidden) { $("fName").hidden = false; urlWrap.appendChild($("fName")); }  // 名称は必ず出す
  entry.modes = normModes(entry.modes);
  fields.forEach(paintUrlMode);
  $("btnGenre").hidden = !(autoGenreTab(view) && fields.includes("urlRakuten"));
  $("btnGenreAmz").hidden = !(autoGenreTab(view) && fields.includes("urlAmazon"));

  $("rankModalTtl").textContent = `${SEC(view).label}を${isNew ? "追加" : "編集"}`;
  $("rNameLabel").textContent = SEC(view).nameLabel;
  $("rName").value    = entry.name;
  $("rName2").value   = entry.nameAmazon || "";

  /* 大カテゴリ。決まった選択肢のタブ（強さ）はドロップダウンにする */
  const cats = catList(view);
  $("rCatLabel").textContent = SEC(view).catLabel || "大カテゴリ";
  $("rCat").hidden    = cats.length > 0;
  $("rCatSel").hidden = !cats.length;
  if (cats.length) {
    const cur = isNew ? "" : (entry.category || "");
    $("rCatSel").innerHTML = cats.map((o) =>
      `<option value="${esc(o.v)}"${o.v === cur ? " selected" : ""}>${esc(o.label)}</option>`).join("");
    $("rCatSel").value = cats.some((o) => o.v === cur) ? cur : "";
    $("rCatSel").className = "side-sel side-sel-lg " + (cats.find((o) => o.v === $("rCatSel").value) || cats[0]).cls;
  } else {
    $("rCat").value = isNew ? "" : entry.category;
  }
  /* 使わない項目は出さない（ランキングのカテゴリー名・ライバルの確認内容） */
  const omit = SEC(view).omit || [];
  $("fNote").hidden = omit.includes("note");
  $("fCat").hidden  = omit.includes("cat");
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
  const name2 = $("fName2").hidden ? "" : $("rName2").value.trim();
  const vals = Object.fromEntries(fields.map((f) => [f, $(INPUT[f]).value.trim()]));
  if (!name && !name2) { toast(`${SEC(view).nameLabel}は必須です`, true); $("rName").focus(); return; }
  if (!fields.some((f) => vals[f])) {
    toast(fields.length > 1 ? "URLをどちらか入れてください" : "URLは必須です", true);
    $(INPUT[fields[0]]).focus();
    return;
  }

  entry.name = name;
  entry.nameAmazon = $("fName2").hidden ? (entry.nameAmazon || "") : $("rName2").value.trim();
  /* 画面に出ていないURL欄は今の値のまま（タブを移してきた行の反対側を消さない） */
  for (const f of ["url", "urlAmazon", "urlRakuten"]) if (fields.includes(f)) entry[f] = vals[f] || "";
  const cats = catList(view);
  if (!$("fCat").hidden) entry.category = cats.length ? $("rCatSel").value : ($("rCat").value.trim() || "未分類");
  entry.image     = $("rImage").value.trim();
  if (!$("fNote").hidden) entry.checkNote = $("rNote").value.trim();
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
function renderLabelEditor(boxId = "labEditor", only = "") {
  const L = ensureLabels;
  const box = $(boxId);

  box.innerHTML = stFields().filter((f) => !only || f.key === only).map((f) => {
    const list = stList(f.key);
    return `<div class="lab-grp" data-grp="${esc(f.key)}">
      <p class="cfg-sec-ttl">${esc(stTitle(f.key))}${only ? `
        <span class="grow"></span>
        <button type="button" class="btn btn-ghost btn-xs btn-danger" data-fdel="${esc(f.key)}">この項目を削除</button>` : ""}</p>
      ${list.map((o, i) => `
        <div class="lab-row" data-lab="${esc(f.key)}|${esc(o.v)}">
          <span class="lab-move">
            <button type="button" class="ord-btn" data-mv="up"${i === 0 ? " disabled" : ""} title="1つ上へ">↑</button>
            <button type="button" class="ord-btn" data-mv="down"${i === list.length - 1 ? " disabled" : ""} title="1つ下へ">↓</button>
          </span>
          <span class="lab-sw">${SWATCHES.map((sw) =>
            `<button type="button" class="sw-${sw.c}${sw.c === o.color ? " on" : ""}"
                     data-color="${sw.c}" title="${esc(sw.label)}"></button>`).join("")}</span>
          <input class="lab-in" type="text" maxlength="24" value="${esc(o.label)}" placeholder="表示名">
          <span class="lab-prev sw-${o.color}">${esc(o.label)}</span>
          <button type="button" class="icon-btn lab-del" data-del title="この選択肢を削除"${list.length < 2 ? " disabled" : ""}>✕</button>
        </div>`).join("")}
      <button type="button" class="btn btn-ghost btn-xs lab-add" data-add>＋ 選択肢を追加</button>
    </div>`;
  }).join("");

  const commit = (redraw) => {
    persistLocal(); markDirty(true); renderBody();
    if (redraw) renderLabelEditor(boxId, only);
  };

  box.querySelectorAll(".lab-row").forEach((row) => {
    const [key, v] = row.dataset.lab.split("|");
    const at = () => { const arr = L()[key]; return { arr, i: arr.findIndex((x) => x.v === v) }; };

    row.querySelector(".lab-in").oninput = (e) => {
      const { arr, i } = at();
      if (i < 0) return;
      const o = arr[i];
      o.label = e.target.value.slice(0, 24) || "(未設定)";
      const prev = row.querySelector(".lab-prev");
      prev.textContent = o.label;
      commit(false);
    };
    row.querySelectorAll(".lab-sw button").forEach((b) => {
      b.onclick = () => {
        const { arr, i } = at();
        if (i < 0) return;
        const o = arr[i];
        o.color = b.dataset.color;
        row.querySelector(".lab-prev").className = "lab-prev sw-" + o.color;
        row.querySelectorAll(".lab-sw button").forEach((x) =>
          x.classList.toggle("on", x.dataset.color === o.color));
        commit(false);
      };
    });
    row.querySelectorAll("[data-mv]").forEach((b) => {
      b.onclick = () => {
        const { arr, i } = at();
        const j = i + (b.dataset.mv === "up" ? -1 : 1);
        if (i < 0 || j < 0 || j >= arr.length) return;
        [arr[i], arr[j]] = [arr[j], arr[i]];
        commit(true);
      };
    });
    row.querySelector("[data-del]").onclick = () => {
      const { arr, i } = at();
      if (i < 0) return;
      if (arr.length < 2) { toast("選択肢は1つ以上必要です", true); return; }
      const used = allPicks().filter((r) => pickVal(r.p, key) === v).length;
      const name = arr[i].label;
      const moveTo = (arr[0].v === v ? arr[1] : arr[0]).label;
      if (!confirm(used
        ? `「${name}」を削除します。この選択肢が付いた商品 ${used} 件は「${moveTo}」に変わります。よろしいですか？`
        : `「${name}」を削除します。よろしいですか？`)) return;
      arr.splice(i, 1);
      reconcileLabels(data);
      commit(true);
      toast(used ? `削除しました（商品 ${used} 件を付け替え）` : "削除しました");
    };
  });

  box.querySelectorAll("[data-fdel]").forEach((b) => {
    b.onclick = () => {
      const key = b.dataset.fdel;
      const name = stTitle(key);
      const used = allPicks().filter((r) => {
        const v = pickVal(r.p, key);
        return v && v !== (stList(key)[0]?.v ?? "");
      }).length;
      if (!confirm(`項目「${name}」を消します。表からこの列が無くなります` +
        (used ? `（${used} 件に付いている値は残りますが見えなくなります）` : "") + "。よろしいですか？")) return;
      data.fields = stFields().filter((f) => f.key !== key);
      delete data.labels[key];
      persistLocal(); markDirty(true);
      colTab = "lab_" + (stFields()[0]?.key || "");
      if (!stFields().length) colTab = "amazon";
      colLabShown = "";
      renderBody(); renderColModal();
      toast(`「${name}」を消しました`);
    };
  });

  box.querySelectorAll("[data-add]").forEach((b) => {
    b.onclick = () => {
      const key = b.closest(".lab-grp").dataset.grp;
      L()[key].push({ v: newOptVal(), label: "新しい選択肢", color: "gray" });
      commit(true);
      const rows = box.querySelectorAll(`.lab-grp[data-grp="${key}"] .lab-row .lab-in`);
      const last = rows[rows.length - 1];
      if (last) { last.focus(); last.select(); }
    };
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
                quality: cur.quality || old.quality,
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
  /* 楽天のURLなら、ジャンル名（パンくず）も一緒に試す */
  if (isRakutenUrl(url) || isAmazonUrl(url)) {
    const g = await fetchGenre(url, (stage, msg) => add(stage, msg));
    add("ジャンル名", g || "取得できず", g ? "ok" : "ng");
  }
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
  $("btnNewWin").onclick = () => {
    const w = window.open(location.href, "_blank",
      `noopener,width=${Math.min(1600, screen.availWidth - 60)},height=${Math.min(1000, screen.availHeight - 60)}`);
    if (!w) toast("ポップアップがブロックされました。ブラウザで許可してください", true);
  };

  /* 同じブラウザの別ウィンドウで変更されたら、こちらにも取り込む */
  window.addEventListener("storage", (e) => {
    if (e.key !== LS_DATA || !e.newValue) return;
    const busy = !$("rankModal").hidden || !$("cfgModal").hidden || editPicks.size || addRows.size;
    if (busy) return;                       // 編集中は邪魔しない
    try {
      const next = normalize(JSON.parse(e.newValue));
      if ((next.updatedAt || "") <= (data.updatedAt || "")) return;
      data = next;
      renderAll();
      toast("別のウィンドウの変更を取り込みました");
    } catch { /* noop */ }
  });
  $("btnCols").onclick     = () => openColModal(!colModalOpen());
  $("colClose").onclick    = () => openColModal(false);
  $("btnColsDone").onclick = () => openColModal(false);
  $("btnColsReset").onclick = () => {
    if (!confirm("表示する列・並び順・項目名・幅・揃え・行の高さを既定に戻します。よろしいですか？")) return;
    data.cols = normCols(null);
    saveCols(); renderBody(); renderColModal();
    toast("列の設定を既定に戻しました");
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
  /* 楽天URL → ジャンル名（パンくず）。空のときだけ自動、ボタンならいつでも取り直し */
  $("rUrlRak").onchange   = () => fillGenre("urlRakuten", false);
  $("btnGenre").onclick    = () => fillGenre("urlRakuten", true);
  $("rUrlAmz").onchange    = () => fillGenre("urlAmazon", false);
  $("btnGenreAmz").onclick = () => fillGenre("urlAmazon", true);
  $("btnGenreAll").onclick = runGenreAll;
  $("rSide").onchange = () => {
    $("rSide").className = "side-sel side-sel-lg " + SIDE($("rSide").value).cls;
  };
  $("rCatSel").onchange = () => {
    const o = catList(view).find((x) => x.v === $("rCatSel").value);
    $("rCatSel").className = "side-sel side-sel-lg " + (o ? o.cls : "sw-gray");
  };
  ["rUrl", "rUrlAmz", "rUrlRak"].forEach((id) => {
    $(id).onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); saveRank(); } };
  });

  $("cfgClose").onclick   = () => { $("cfgModal").hidden = true; };
  const saveCfgAndClose = () => { readCfgForm(); $("cfgModal").hidden = true; toast("設定を保存しました"); };
  $("btnSaveCfg").onclick    = saveCfgAndClose;
  $("btnSaveCfgTop").onclick = saveCfgAndClose;
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
  $("colModal").onclick = (e) => { if (e.target.id === "colModal") openColModal(false); };
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!$("lightbox").hidden) { closeLightbox(); return; }
      if (colModalOpen()) { openColModal(false); return; }
      ["rankModal", "cfgModal"].forEach((id) => ($(id).hidden = true));
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); saveToGitHub(false); }
  });
  let fitTimer = null;
  window.addEventListener("resize", () => {
    syncHeadH();
    clearTimeout(fitTimer);
    fitTimer = setTimeout(fitColumns, 120);
  });
  watchHeadH();
  /* スクロール量でヘッダーを薄く（行ったり来たりしないよう閾値に幅を持たせる） */
  window.addEventListener("scroll", () => {
    const y = window.scrollY || 0;
    const on = document.body.classList.contains("scrolled");
    if (!on && y > 130) document.body.classList.add("scrolled");
    else if (on && y < 60) document.body.classList.remove("scrolled");
  }, { passive: true });
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
  migrateColsFromLocal();
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
