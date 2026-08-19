/* =========================================================
   型番商品確認くん / app.js
   型番商品・楽天ランキング・AmazonランキングのURL置き場
   データ: data/products.json（GitHub Contents API で読み書き）
   ========================================================= */

const VERSION   = "0.6.1";
const DATA_PATH = "data/products.json";
const LS_CFG    = "kata_cfg_v1";
const LS_DATA   = "kata_data_v2";

/* ---------- セクション定義 ---------- */
const SECTIONS = [
  { key: "products", icon: "📦", label: "型番商品",          kind: "product",
    search: "型番・商品名・URLで検索…", add: "＋ 型番を追加",
    emptyTtl: "まだ型番が登録されていません",
    emptySub: "「＋ 型番を追加」から、監視したい商品のURLを登録してください。" },
  { key: "rakuten",  icon: "🏆", label: "楽天ランキング",     kind: "rank",
    search: "ジャンル名・URLで検索…", add: "＋ ランキングURLを追加",
    emptyTtl: "まだランキングURLが登録されていません",
    emptySub: "よく見る楽天のランキングページを登録しておくと、ここから一発で開けます。" },
  { key: "amazon",   icon: "📊", label: "Amazonランキング",   kind: "rank",
    search: "ジャンル名・URLで検索…", add: "＋ ランキングURLを追加",
    emptyTtl: "まだランキングURLが登録されていません",
    emptySub: "よく見るAmazonの売れ筋ランキングページを登録しておくと、ここから一発で開けます。" },
];
const SEC = (k) => SECTIONS.find((s) => s.key === k);

const LINK_TYPES = {
  rakuten:      "楽天",
  rakuten_rank: "楽天ランキング",
  amazon:       "Amazon",
  amazon_rank:  "Amazonランキング",
  yahoo:        "Yahoo!",
  mercari:      "メルカリ",
  alibaba:      "1688",
  taobao:       "タオバオ",
  official:     "公式",
  other:        "その他",
};
const STALE_DAYS = 14;   // 最終確認からこの日数を超えたら色を付ける

/* ---------- 状態 ---------- */
let cfg   = { owner: "", repo: "", branch: "main", pat: "" };
let data  = emptyData();
let sha   = null;
let dirty = false;
let entry = null;
let isNew = false;

let view = "products";
const openPicks = new Set();   // 商品URL追加フォームを開いたままにするID
const editPicks = new Set();   // インライン編集中の商品行 "itemId|pickId"
const filters ={ products: { q: "", cat: "*" }, rakuten: { q: "", cat: "*" }, amazon: { q: "", cat: "*" } };
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
function agoLabel(ymdStr) {
  const d = daysSince(ymdStr);
  if (d == null) return "未確認";
  if (d <= 0) return "今日";
  if (d === 1) return "昨日";
  return `${d}日前`;
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
   データ
   ========================================================= */
function emptyData() {
  return { version: 2, updatedAt: "", sections: { products: { items: [] }, rakuten: { items: [] }, amazon: { items: [] } } };
}
const itemsOf = (key) => data.sections[key].items;

function normProduct(it) {
  return {
    id:       it.id || uid(),
    model:    it.model || "",
    name:     it.name || "",
    category: it.category || "未分類",
    links: (Array.isArray(it.links) ? it.links : [])
      .map((l) => ({ type: LINK_TYPES[l.type] ? l.type : "other", label: l.label || "", url: l.url || "" }))
      .filter((l) => l.url),
    createdAt: it.createdAt || nowIso(),
    updatedAt: it.updatedAt || it.createdAt || nowIso(),
  };
}
function normRank(it) {
  return {
    id:        it.id || uid(),
    name:      it.name || "",
    category:  it.category || "未分類",
    url:       it.url || "",
    checkNote: it.checkNote || "",          // 確認内容
    checkedAt: ymd(it.checkedAt) || "",     // 最終確認日 (YYYY-MM-DD)
    picks: (Array.isArray(it.picks) ? it.picks : [])
      .map((p) => ({
        id:      p.id || uid(),
        addedAt: ymd(p.addedAt) || today(),        // 追加日
        url:     p.url || "",
        note:    p.note || p.name || "",           // メモ（旧 name から移行）
      }))
      .filter((p) => p.url),
    createdAt: it.createdAt || nowIso(),
    updatedAt: it.updatedAt || it.createdAt || nowIso(),
  };
}

function normalize(d) {
  const out = emptyData();
  out.updatedAt = d?.updatedAt || "";
  const s = d?.sections || {};
  // v1（items が直下）からの移行
  const legacy = Array.isArray(d?.items) ? d.items : null;
  out.sections.products.items = (legacy || s.products?.items || []).map(normProduct);
  out.sections.rakuten.items  = (s.rakuten?.items || []).map(normRank).filter((x) => x.url);
  out.sections.amazon.items   = (s.amazon?.items  || []).map(normRank).filter((x) => x.url);
  return out;
}

function loadCfg() {
  try {
    const raw = localStorage.getItem(LS_CFG);
    if (raw) cfg = Object.assign(cfg, JSON.parse(raw));
  } catch { /* noop */ }
  if (!cfg.branch) cfg.branch = "main";
}
function saveCfg() { localStorage.setItem(LS_CFG, JSON.stringify(cfg)); }

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

function markDirty(v) {
  dirty = v;
  $("saveState").hidden = !dirty;
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

  const cats = categories(view);
  const seg = (k, label, cnt, on) =>
    `<button class="seg-btn${on ? " on" : ""}" data-k="${esc(k)}">${esc(label)}<span class="seg-cnt">${cnt}</span></button>`;
  $("catSeg").innerHTML = cats.length < 2 ? "" :
    seg("*", "すべて", itemsOf(view).length, F().cat === "*") +
    cats.map((c) => seg(c, c, itemsOf(view).filter((i) => (i.category || "未分類") === c).length, F().cat === c)).join("");
  $("catSeg").querySelectorAll(".seg-btn").forEach((b) => {
    b.onclick = () => { F().cat = b.dataset.k; renderToolbar(); renderBody(); };
  });

  const dl = view === "products" ? "catList" : "rankCatList";
  $(dl).innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join("");
}

/* =========================================================
   一覧
   ========================================================= */
function visibleItems() {
  const q = F().q.trim().toLowerCase();
  const isProduct = SEC(view).kind === "product";
  return itemsOf(view)
    .filter((it) => {
      if (F().cat !== "*" && (it.category || "未分類") !== F().cat) return false;
      if (!q) return true;
      const hay = isProduct
        ? [it.model, it.name, it.category, it.links.map((l) => l.url + " " + l.label).join(" ")].join(" ")
        : [it.name, it.category, it.url, it.checkNote, it.picks.map((p) => p.note + " " + p.url).join(" ")].join(" ");
      return hay.toLowerCase().includes(q);
    })
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

function renderBody() {
  const s = SEC(view);
  const list = visibleItems();
  const total = itemsOf(view).length;

  $("countLabel").textContent = total ? `${list.length} / ${total} 件` : "";
  $("emptyState").hidden = list.length > 0;
  $("emptyTtl").textContent = total ? "条件に合うものがありません" : s.emptyTtl;
  $("emptySub").textContent = total ? "検索語やカテゴリの絞り込みを外してみてください。" : s.emptySub;

  $("list").innerHTML = s.kind === "product" ? list.map(productCard).join("") : list.map(rankCard).join("");

  const root = $("list");
  root.querySelectorAll("[data-edit]").forEach((b) => {
    b.onclick = () => {
      const it = itemsOf(view).find((i) => i.id === b.dataset.edit);
      s.kind === "product" ? openItem(it) : openRank(it);
    };
  });
  root.querySelectorAll("[data-copy]").forEach((b) => {
    b.onclick = () => { navigator.clipboard?.writeText(b.dataset.copy); toast("URLをコピーしました"); };
  });
  if (s.kind !== "rank") return;

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

  // 商品URLの追加フォームを開閉
  root.querySelectorAll("[data-pickopen]").forEach((b) => {
    b.onclick = () => {
      const box = root.querySelector(`.pick-form[data-for="${b.dataset.pickopen}"]`);
      box.hidden = !box.hidden;
      b.classList.toggle("on", !box.hidden);
      if (!box.hidden) box.querySelector(".pick-url").focus();
    };
  });
  root.querySelectorAll(".pick-form").forEach((box) => {
    const id  = box.dataset.for;
    const add = () => {
      const url = box.querySelector(".pick-url").value.trim();
      if (!url) { toast("URLを入力してください", true); return; }
      const it = itemsOf(view).find((i) => i.id === id);
      it.picks.push({
        id:      uid(),
        addedAt: box.querySelector(".pick-added").value || today(),
        url,
        note:    box.querySelector(".pick-memo").value.trim(),
      });
      it.updatedAt = nowIso();
      openPicks.add(id);
      upsert(view, it);
      toast("商品URLを追加しました");
    };
    box.querySelector(".pick-add").onclick = add;
    box.querySelectorAll("input").forEach((inp) => {
      inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } };
    });
  });
  root.querySelectorAll("[data-pickdel]").forEach((b) => {
    b.onclick = () => {
      const [id, pid] = b.dataset.pickdel.split("|");
      const it = itemsOf(view).find((i) => i.id === id);
      it.picks = it.picks.filter((p) => p.id !== pid);
      it.updatedAt = nowIso();
      editPicks.delete(b.dataset.pickdel);
      upsert(view, it);
    };
  });

  // 商品行のインライン編集
  root.querySelectorAll("[data-pickedit]").forEach((b) => {
    b.onclick = () => { editPicks.add(b.dataset.pickedit); renderBody(); };
  });
  root.querySelectorAll("[data-pickcancel]").forEach((b) => {
    b.onclick = () => { editPicks.delete(b.dataset.pickcancel); renderBody(); };
  });
  root.querySelectorAll("[data-picksave]").forEach((b) => {
    const key = b.dataset.picksave;
    const row = root.querySelector(`.pick-editing[data-row="${key}"]`);
    const save = () => {
      const [id, pid] = key.split("|");
      const url = row.querySelector(".pe-url").value.trim();
      if (!url) { toast("URLを空にはできません", true); return; }
      const it = itemsOf(view).find((i) => i.id === id);
      const p  = it.picks.find((x) => x.id === pid);
      p.addedAt = row.querySelector(".pe-date").value || p.addedAt;
      p.url     = url;
      p.note    = row.querySelector(".pe-note").value.trim();
      it.updatedAt = nowIso();
      editPicks.delete(key);
      upsert(view, it);
      toast("商品を更新しました");
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

function productCard(it) {
  const links = it.links.map((l) => `
    <li class="url-row">
      <span class="chip ${esc(l.type)}">${esc(LINK_TYPES[l.type] || "その他")}</span>
      <a class="url-link" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" title="${esc(l.url)}">
        ${l.label ? `<span class="url-label">${esc(l.label)}</span>` : ""}<span class="url-text">${esc(l.url)}</span>
      </a>
      <button class="icon-btn" data-copy="${esc(l.url)}" title="URLをコピー">⧉</button>
    </li>`).join("");

  return `<article class="item">
    <div class="item-head">
      <span class="model">${esc(it.model || "—")}</span>
      <span class="item-name">${esc(it.name || "")}</span>
      <span class="pill">${esc(it.category || "未分類")}</span>
      <span class="item-date">${esc(ymd(it.updatedAt))}</span>
      <button class="icon-btn" data-edit="${esc(it.id)}" title="編集">✎</button>
    </div>
    <ul class="url-list">${links || '<li class="url-row muted">URL未登録</li>'}</ul>
  </article>`;
}

function rankCard(it) {
  const d = daysSince(it.checkedAt);
  const stale = d == null || d > STALE_DAYS;

  const picks = it.picks
    .slice()
    .sort((a, b) => (b.addedAt || "").localeCompare(a.addedAt || ""))
    .map((p) => {
      const key = `${it.id}|${p.id}`;
      if (editPicks.has(key)) return `
    <li class="pick-row pick-editing" data-row="${esc(key)}">
      <input class="input-sm pe-date" type="date" value="${esc(p.addedAt)}">
      <input class="input-sm pe-url" type="url" value="${esc(p.url)}" placeholder="https://…">
      <input class="input-sm pe-note" type="text" value="${esc(p.note)}" placeholder="メモ（任意）">
      <span class="pick-acts">
        <button class="icon-btn ok" data-picksave="${esc(key)}" title="保存">✓</button>
        <button class="icon-btn" data-pickcancel="${esc(key)}" title="キャンセル">↩</button>
      </span>
    </li>`;
      return `
    <li class="pick-row">
      <span class="pick-date">${esc(p.addedAt || "—")}</span>
      <a class="pick-url-link" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" title="${esc(p.url)}">${esc(prettyUrl(p.url))}</a>
      <span class="pick-note${p.note ? "" : " none"}">${esc(p.note || "—")}</span>
      <span class="pick-acts">
        <button class="icon-btn" data-pickedit="${esc(key)}" title="編集">✎</button>
        <button class="icon-btn" data-copy="${esc(p.url)}" title="URLをコピー">⧉</button>
        <button class="icon-btn" data-pickdel="${esc(key)}" title="削除">✕</button>
      </span>
    </li>`;
    }).join("");

  return `<article class="item rank-card">
    <header class="rank-hd">
      <div class="rank-hd-main">
        <a class="rank-title" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">${esc(it.name || hostOf(it.url))}</a>
        <a class="rank-url" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer" title="${esc(it.url)}">${esc(prettyUrl(it.url, 90))}</a>
      </div>
      <div class="rank-hd-side">
        <span class="pill">${esc(it.category || "未分類")}</span>
        <span class="check-inline${stale ? " stale" : ""}">
          <span class="check-lbl">確認日</span>
          <input type="date" class="check-date" data-checkdate="${esc(it.id)}" value="${esc(it.checkedAt)}">
          <button class="btn btn-ghost btn-xs" data-today="${esc(it.id)}">本日反映</button>
          <span class="check-ago">${esc(agoLabel(it.checkedAt))}</span>
        </span>
        <button class="icon-btn" data-copy="${esc(it.url)}" title="URLをコピー">⧉</button>
        <button class="icon-btn" data-edit="${esc(it.id)}" title="編集">✎</button>
      </div>
    </header>

    ${it.checkNote ? `<div class="note-band">
      <span class="band-lbl">確認内容</span>
      <p class="band-body">${esc(it.checkNote)}</p>
    </div>` : ""}

    <section class="pick-block">
      <div class="pick-hdr">
        <span class="pick-hdr-ttl">チェックした商品</span>
        <span class="pick-hdr-cnt">${it.picks.length} 件</span>
        <button class="btn btn-add btn-xs pick-open${openPicks.has(it.id) ? " on" : ""}" data-pickopen="${esc(it.id)}">
          ${openPicks.has(it.id) ? "× 閉じる" : "＋ 商品を追加"}
        </button>
      </div>

      <div class="pick-form" data-for="${esc(it.id)}"${openPicks.has(it.id) ? "" : " hidden"}>
        <input class="input-sm pick-added" type="date" value="${esc(today())}">
        <input class="input-sm pick-url" type="url" placeholder="https://…">
        <input class="input-sm pick-memo" type="text" placeholder="メモ（任意）">
        <button class="btn btn-add btn-sm pick-add">追加</button>
      </div>

      ${it.picks.length ? `<ul class="pick-list">
        <li class="pick-row pick-hd"><span>追加日</span><span>URL</span><span>メモ</span><span></span></li>
        ${picks}
      </ul>` : `<p class="pick-none">まだありません。良かった商品のURLをここに足していけます。</p>`}
    </section>
  </article>`;
}

function renderAll() { renderNav(); renderToolbar(); renderBody(); }

/* =========================================================
   型番商品モーダル
   ========================================================= */
function openItem(item) {
  isNew = !item;
  entry = item
    ? JSON.parse(JSON.stringify(item))
    : { id: uid(), model: "", name: "", category: "", links: [], createdAt: nowIso(), updatedAt: nowIso() };

  $("itemModalTtl").textContent = isNew ? "型番を追加" : `${entry.model || "（型番未設定）"} を編集`;
  $("fModel").value = entry.model;
  $("fName").value  = entry.name;
  $("fCat").value   = isNew ? "" : entry.category;
  $("lLabel").value = "";
  $("lUrl").value   = "";
  $("btnDelItem").style.visibility = isNew ? "hidden" : "visible";

  renderLinks();
  $("itemModal").hidden = false;
  setTimeout(() => $("fModel").focus(), 30);
}
function closeItem() { $("itemModal").hidden = true; entry = null; }

function renderLinks() {
  const ul = $("linkList");
  if (!entry.links.length) { ul.innerHTML = `<li class="hint">URLがまだありません。</li>`; return; }

  ul.innerHTML = entry.links.map((l, i) => `
    <li class="link-item">
      <span class="chip ${esc(l.type)}">${esc(LINK_TYPES[l.type] || "その他")}</span>
      <div class="link-body">
        <div class="link-label">${esc(l.label || hostOf(l.url))}</div>
        <a class="link-url" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.url)}</a>
      </div>
      <button class="icon-btn" data-del="${i}" title="削除">✕</button>
    </li>`).join("");

  ul.querySelectorAll("[data-del]").forEach((b) => {
    b.onclick = () => { entry.links.splice(Number(b.dataset.del), 1); renderLinks(); };
  });
}

function addLink() {
  const url = $("lUrl").value.trim();
  if (!url) { toast("URLを入力してください", true); return; }
  entry.links.push({ type: $("lType").value, label: $("lLabel").value.trim(), url });
  $("lUrl").value = ""; $("lLabel").value = "";
  renderLinks();
  $("lUrl").focus();
}

function saveItem() {
  const model = $("fModel").value.trim();
  if (!model) { toast("型番は必須です", true); $("fModel").focus(); return; }

  entry.model     = model;
  entry.name      = $("fName").value.trim();
  entry.category  = $("fCat").value.trim() || "未分類";
  entry.updatedAt = nowIso();

  upsert("products", entry);
  closeItem();
  toast(isNew ? "追加しました" : "保存しました");
}

function deleteItem() {
  if (!confirm(`「${entry.model}」を削除します。よろしいですか？`)) return;
  removeById("products", entry.id);
  closeItem();
  toast("削除しました");
}

/* =========================================================
   ランキングURLモーダル
   ========================================================= */
function openRank(item) {
  isNew = !item;
  entry = item
    ? JSON.parse(JSON.stringify(item))
    : { id: uid(), name: "", category: "", url: "", checkNote: "", checkedAt: today(), picks: [],
        createdAt: nowIso(), updatedAt: nowIso() };

  $("rankModalTtl").textContent = `${SEC(view).label}のURLを${isNew ? "追加" : "編集"}`;
  $("rName").value    = entry.name;
  $("rCat").value     = isNew ? "" : entry.category;
  $("rUrl").value     = entry.url;
  $("rNote").value    = entry.checkNote;
  $("rChecked").value = entry.checkedAt;
  $("btnDelRank").style.visibility = isNew ? "hidden" : "visible";

  $("rankModal").hidden = false;
  setTimeout(() => $("rName").focus(), 30);
}
function closeRank() { $("rankModal").hidden = true; entry = null; }

function saveRank() {
  const name = $("rName").value.trim();
  const url  = $("rUrl").value.trim();
  if (!name) { toast("ジャンル名は必須です", true); $("rName").focus(); return; }
  if (!url)  { toast("URLは必須です", true); $("rUrl").focus(); return; }

  entry.name      = name;
  entry.url       = url;
  entry.category  = $("rCat").value.trim() || "未分類";
  entry.checkNote = $("rNote").value.trim();
  entry.checkedAt = $("rChecked").value || "";
  entry.updatedAt = nowIso();

  upsert(view, entry);
  closeRank();
  toast(isNew ? "追加しました" : "保存しました");
}

function deleteRank() {
  if (!confirm(`「${entry.name}」を削除します。よろしいですか？`)) return;
  removeById(view, entry.id);
  closeRank();
  toast("削除しました");
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

async function saveToGitHub() {
  if (!cfgReady()) { toast("設定でオーナー/リポジトリを入力してください", true); openCfg(); return; }
  if (!cfg.pat)   { toast("設定でPersonal Access Tokenを入力してください", true); openCfg(); return; }

  const btn = $("btnSaveGh");
  btn.disabled = true; btn.textContent = "保存中…";
  try {
    const head = await fetch(ghGetUrl(), { headers: ghHeaders(), cache: "no-store" });
    if (head.ok) sha = (await head.json()).sha;
    else if (head.status === 404) sha = null;
    else throw new Error(`${head.status} ${head.statusText}`);

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
    const out = await res.json();
    if (!res.ok) throw new Error(`${res.status} ${out.message || res.statusText}`);

    sha = out.content.sha;
    markDirty(false);
    toast("GitHubに保存しました");
  } catch (e) {
    toast("保存失敗: " + e.message, true);
  } finally {
    btn.disabled = false; btn.textContent = "💾 保存";
  }
}

/* =========================================================
   設定
   ========================================================= */
function openCfg() {
  $("cOwner").value  = cfg.owner;
  $("cRepo").value   = cfg.repo;
  $("cBranch").value = cfg.branch;
  $("cPat").value    = cfg.pat;
  $("cfgStatus").textContent = "";
  renderCfgUrl();
  $("cfgModal").hidden = false;
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
  cfg = { owner, repo, branch: normId($("cBranch").value) || "main", pat: $("cPat").value.trim() };

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
  $("btnNew").onclick      = () => (SEC(view).kind === "product" ? openItem(null) : openRank(null));
  $("btnSettings").onclick = openCfg;
  $("btnSaveGh").onclick   = saveToGitHub;

  $("q").oninput      = (e) => { F().q = e.target.value; renderBody(); };
  $("qClear").onclick = () => { $("q").value = ""; F().q = ""; renderBody(); };

  $("itemClose").onclick     = closeItem;
  $("btnCancelItem").onclick = closeItem;
  $("btnSaveItem").onclick   = saveItem;
  $("btnDelItem").onclick    = deleteItem;
  $("btnAddLink").onclick    = addLink;
  $("lUrl").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } };

  $("rankClose").onclick     = closeRank;
  $("btnCancelRank").onclick = closeRank;
  $("btnSaveRank").onclick   = saveRank;
  $("btnDelRank").onclick    = deleteRank;
  $("btnToday").onclick      = () => { $("rChecked").value = today(); };
  $("rUrl").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); saveRank(); } };

  $("cfgClose").onclick   = () => { $("cfgModal").hidden = true; };
  $("btnSaveCfg").onclick = () => { readCfgForm(); $("cfgModal").hidden = true; toast("設定を保存しました"); };
  $("btnTestGh").onclick  = testConnection;
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

  ["itemModal", "rankModal", "cfgModal"].forEach((id) => {
    $(id).onclick = (e) => { if (e.target.id === id) $(id).hidden = true; };
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") ["itemModal", "rankModal", "cfgModal"].forEach((id) => ($(id).hidden = true));
    if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); saveToGitHub(); }
  });
  window.addEventListener("beforeunload", (e) => {
    if (dirty) { e.preventDefault(); e.returnValue = ""; }
  });
}

async function boot() {
  loadCfg();
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
