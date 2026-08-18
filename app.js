/* =========================================================
   型番商品チェッカー / app.js
   - 型番ごとにURLを置いて、順位・価格を手入力で定点記録する
   - データは data/products.json（GitHub Contents API で読み書き）
   ========================================================= */

const VERSION   = "0.1.0";
const DATA_PATH = "data/products.json";
const LS_CFG    = "kata_cfg_v1";
const LS_DATA   = "kata_data_v1";

const LINK_TYPES = {
  rakuten:      { label: "楽天" },
  rakuten_rank: { label: "楽天ランキング" },
  amazon:       { label: "Amazon" },
  yahoo:        { label: "Yahoo!" },
  mercari:      { label: "メルカリ" },
  alibaba:      { label: "1688" },
  taobao:       { label: "タオバオ" },
  official:     { label: "公式" },
  other:        { label: "その他" },
};

const STATUSES = [
  { key: "watch",     label: "監視中" },
  { key: "candidate", label: "検討中" },
  { key: "running",   label: "販売中" },
  { key: "archived",  label: "保留・除外" },
];

/* ---------- 状態 ---------- */
let cfg   = { owner: "", repo: "", branch: "main", pat: "" };
let data  = { version: 1, updatedAt: "", items: [] };
let sha   = null;               // data/products.json の blob SHA
let dirty = false;              // GitHub未保存の変更があるか
let entry = null;               // 編集中アイテム（作業コピー）
let isNew = false;

const filter = { q: "", cat: "*", status: "*" };
let sortKey  = "updated";

/* ---------- 小物 ---------- */
const $  = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => "itm_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const today = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();

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

/* 型番に紐づく記録を日付昇順で */
function recsOf(item) {
  return (item.records || []).slice().sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}
function latestRec(item, key) {
  const r = recsOf(item).filter((x) => x[key] != null && x[key] !== "");
  return r.length ? r[r.length - 1] : null;
}
function prevRec(item, key) {
  const r = recsOf(item).filter((x) => x[key] != null && x[key] !== "");
  return r.length > 1 ? r[r.length - 2] : null;
}

/* =========================================================
   設定 / ローカル保存
   ========================================================= */
function loadCfg() {
  try {
    const raw = localStorage.getItem(LS_CFG);
    if (raw) cfg = Object.assign(cfg, JSON.parse(raw));
  } catch { /* noop */ }
  if (!cfg.branch) cfg.branch = "main";
}
function saveCfg() {
  localStorage.setItem(LS_CFG, JSON.stringify(cfg));
}
function persistLocal() {
  data.updatedAt = nowIso();
  localStorage.setItem(LS_DATA, JSON.stringify(data));
}
function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_DATA);
    if (raw) return normalize(JSON.parse(raw));
  } catch { /* noop */ }
  return null;
}

function normalize(d) {
  const out = { version: 1, updatedAt: d?.updatedAt || "", items: [] };
  const items = Array.isArray(d?.items) ? d.items : [];
  out.items = items.map((it) => ({
    id:        it.id || uid(),
    model:     it.model || "",
    name:      it.name || "",
    brand:     it.brand || "",
    category:  it.category || "未分類",
    status:    STATUSES.some((s) => s.key === it.status) ? it.status : "watch",
    tags:      Array.isArray(it.tags) ? it.tags : [],
    note:      it.note || "",
    links:     (Array.isArray(it.links) ? it.links : []).map((l) => ({
                 type:  LINK_TYPES[l.type] ? l.type : "other",
                 label: l.label || "",
                 url:   l.url || "",
               })).filter((l) => l.url),
    records:   (Array.isArray(it.records) ? it.records : []).map((r) => ({
                 date:    r.date || today(),
                 rank:    r.rank    === "" || r.rank    == null ? null : Number(r.rank),
                 price:   r.price   === "" || r.price   == null ? null : Number(r.price),
                 reviews: r.reviews === "" || r.reviews == null ? null : Number(r.reviews),
                 genre:   r.genre || "",
                 note:    r.note || "",
               })),
    createdAt: it.createdAt || nowIso(),
    updatedAt: it.updatedAt || it.createdAt || nowIso(),
  }));
  return out;
}

function markDirty(v) {
  dirty = v;
  const el = $("saveState");
  if (dirty) { el.textContent = "● 未保存"; el.className = "save-state dirty"; }
  else       { el.textContent = "保存済";   el.className = "save-state ok"; }
}

/* =========================================================
   一覧の描画
   ========================================================= */
function categories() {
  const set = new Set(data.items.map((i) => i.category || "未分類"));
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ja"));
}

function renderTabs() {
  const cats = categories();
  const catTabs = $("catTabs");
  catTabs.innerHTML =
    tabHtml("*", "すべて", data.items.length, filter.cat === "*") +
    cats.map((c) => tabHtml(c, c, data.items.filter((i) => (i.category || "未分類") === c).length, filter.cat === c)).join("");
  catTabs.querySelectorAll(".tab").forEach((b) => {
    b.onclick = () => { filter.cat = b.dataset.k; renderTabs(); renderGrid(); };
  });

  const stTabs = $("statusTabs");
  stTabs.innerHTML =
    tabHtml("*", "全ステータス", data.items.length, filter.status === "*") +
    STATUSES.map((s) => tabHtml(s.key, s.label, data.items.filter((i) => i.status === s.key).length, filter.status === s.key)).join("");
  stTabs.querySelectorAll(".tab").forEach((b) => {
    b.onclick = () => { filter.status = b.dataset.k; renderTabs(); renderGrid(); };
  });

  // カテゴリのサジェスト
  $("catList").innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join("");
}
function tabHtml(k, label, cnt, on) {
  return `<button class="tab${on ? " on" : ""}" data-k="${esc(k)}">${esc(label)}<span class="cnt">${cnt}</span></button>`;
}

function visibleItems() {
  const q = filter.q.trim().toLowerCase();
  let list = data.items.filter((it) => {
    if (filter.cat !== "*" && (it.category || "未分類") !== filter.cat) return false;
    if (filter.status !== "*" && it.status !== filter.status) return false;
    if (!q) return true;
    const hay = [
      it.model, it.name, it.brand, it.category, it.note,
      (it.tags || []).join(" "),
      (it.links || []).map((l) => l.url + " " + l.label).join(" "),
    ].join(" ").toLowerCase();
    return hay.includes(q);
  });

  const rankOf = (it) => { const r = latestRec(it, "rank"); return r ? r.rank : Infinity; };
  list.sort((a, b) => {
    switch (sortKey) {
      case "model":   return (a.model || "").localeCompare(b.model || "", "ja");
      case "name":    return (a.name || "").localeCompare(b.name || "", "ja");
      case "created": return (b.createdAt || "").localeCompare(a.createdAt || "");
      case "rank":    return rankOf(a) - rankOf(b);
      default:        return (b.updatedAt || "").localeCompare(a.updatedAt || "");
    }
  });
  return list;
}

function renderGrid() {
  const list = visibleItems();
  const body = $("gridBody");
  $("emptyState").hidden = list.length > 0;
  $("grid").style.display = list.length ? "" : "none";

  body.innerHTML = list.map((it) => {
    const lr = latestRec(it, "rank");
    const pr = prevRec(it, "rank");
    const lp = latestRec(it, "price");
    const last = recsOf(it).slice(-1)[0];

    let diff = `<span class="diff-flat">—</span>`;
    if (lr && pr) {
      const d = pr.rank - lr.rank;              // 順位は小さいほど良い
      if (d > 0)      diff = `<span class="diff-up">▲ ${d}</span>`;
      else if (d < 0) diff = `<span class="diff-down">▼ ${Math.abs(d)}</span>`;
      else            diff = `<span class="diff-flat">±0</span>`;
    }

    const chips = (it.links || []).slice(0, 4).map((l) =>
      `<a class="chip ${esc(l.type)}" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer"
          title="${esc(l.url)}" onclick="event.stopPropagation()">${esc(LINK_TYPES[l.type]?.label || "URL")}</a>`
    ).join("");
    const more = (it.links || []).length > 4 ? `<span class="chip">+${it.links.length - 4}</span>` : "";
    const st = STATUSES.find((s) => s.key === it.status);

    return `<tr data-id="${esc(it.id)}">
      <td><span class="model">${esc(it.model || "—")}</span></td>
      <td>
        <div class="name-cell">
          <span class="name-main">${esc(it.name || "（商品名未設定）")}</span>
          <span class="name-sub">${esc(it.brand || "")}${it.brand && it.tags.length ? " ・ " : ""}${esc((it.tags || []).join(", "))}</span>
        </div>
      </td>
      <td><span class="pill ${esc(it.status)}">${esc(st ? st.label : it.status)}</span><br>
          <span class="name-sub">${esc(it.category || "未分類")}</span></td>
      <td><div class="link-chips">${chips || '<span class="muted">—</span>'}${more}</div></td>
      <td class="num-cell">${lr ? esc(lr.rank) + " 位" : '<span class="muted">—</span>'}</td>
      <td class="num-cell">${diff}</td>
      <td class="num-cell">${lp ? "¥" + Number(lp.price).toLocaleString() : '<span class="muted">—</span>'}</td>
      <td class="num-cell muted">${last ? esc(last.date) : "—"}</td>
      <td><button class="icon-btn" title="編集">✎</button></td>
    </tr>`;
  }).join("");

  body.querySelectorAll("tr").forEach((tr) => {
    tr.onclick = () => openItem(data.items.find((i) => i.id === tr.dataset.id));
  });

  $("footNote").textContent =
    `${list.length} 件表示 / 全 ${data.items.length} 型番 ・ ` +
    `URL ${data.items.reduce((n, i) => n + i.links.length, 0)} 本 ・ ` +
    `記録 ${data.items.reduce((n, i) => n + i.records.length, 0)} 件`;
}

/* =========================================================
   詳細 / 編集モーダル
   ========================================================= */
function openItem(item) {
  isNew = !item;
  entry = item
    ? JSON.parse(JSON.stringify(item))
    : {
        id: uid(), model: "", name: "", brand: "", category: "未分類",
        status: "watch", tags: [], note: "", links: [], records: [],
        createdAt: nowIso(), updatedAt: nowIso(),
      };

  $("itemModalTtl").textContent = isNew ? "型番を追加" : `${entry.model || "（型番未設定）"} を編集`;
  $("fModel").value  = entry.model;
  $("fName").value   = entry.name;
  $("fBrand").value  = entry.brand;
  $("fCat").value    = entry.category;
  $("fStatus").value = entry.status;
  $("fTags").value   = (entry.tags || []).join(", ");
  $("fNote").value   = entry.note;
  $("btnDelItem").style.visibility = isNew ? "hidden" : "visible";

  $("rDate").value = today();
  ["lLabel", "lUrl", "rRank", "rPrice", "rReviews", "rGenre", "rNote"].forEach((k) => ($(k).value = ""));

  renderLinks();
  renderRecords();
  $("itemModal").hidden = false;
  setTimeout(() => $("fModel").focus(), 30);
}
function closeItem() { $("itemModal").hidden = true; entry = null; }

function renderLinks() {
  const ul = $("linkList");
  if (!entry.links.length) {
    ul.innerHTML = `<li class="hint">URLがまだありません。</li>`;
    return;
  }
  ul.innerHTML = entry.links.map((l, i) => `
    <li class="link-item">
      <span class="chip ${esc(l.type)}">${esc(LINK_TYPES[l.type]?.label || "その他")}</span>
      <div class="link-body">
        <div class="link-label">${esc(l.label || hostOf(l.url))}</div>
        <a class="link-url" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.url)}</a>
      </div>
      <button class="icon-btn" data-copy="${i}" title="コピー">⧉</button>
      <button class="icon-btn" data-del="${i}" title="削除">✕</button>
    </li>`).join("");

  ul.querySelectorAll("[data-del]").forEach((b) => {
    b.onclick = () => { entry.links.splice(Number(b.dataset.del), 1); renderLinks(); };
  });
  ul.querySelectorAll("[data-copy]").forEach((b) => {
    b.onclick = () => {
      navigator.clipboard?.writeText(entry.links[Number(b.dataset.copy)].url);
      toast("URLをコピーしました");
    };
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

function renderRecords() {
  const recs = recsOf(entry);
  $("recEmpty").hidden = recs.length > 0;
  $("recBody").innerHTML = recs.map((r, i) => `
    <tr>
      <td>${esc(r.date)}</td>
      <td class="num-cell">${r.rank != null ? esc(r.rank) : "—"}</td>
      <td class="num-cell">${r.price != null ? "¥" + Number(r.price).toLocaleString() : "—"}</td>
      <td class="num-cell">${r.reviews != null ? esc(r.reviews) : "—"}</td>
      <td>${esc(r.genre || "—")}</td>
      <td class="muted">${esc(r.note || "")}</td>
      <td><button class="icon-btn" data-rdel="${i}" title="削除">✕</button></td>
    </tr>`).join("");

  $("recBody").querySelectorAll("[data-rdel]").forEach((b) => {
    b.onclick = () => {
      const target = recsOf(entry)[Number(b.dataset.rdel)];
      entry.records.splice(entry.records.indexOf(target), 1);
      renderRecords();
    };
  });
  renderSpark();
}

function addRecord() {
  const num = (v) => (v === "" ? null : Number(v));
  const rec = {
    date:    $("rDate").value || today(),
    rank:    num($("rRank").value),
    price:   num($("rPrice").value),
    reviews: num($("rReviews").value),
    genre:   $("rGenre").value.trim(),
    note:    $("rNote").value.trim(),
  };
  if (rec.rank == null && rec.price == null && rec.reviews == null) {
    toast("順位・価格・レビュー数のどれか1つは入力してください", true);
    return;
  }
  entry.records.push(rec);
  ["rRank", "rPrice", "rReviews", "rNote"].forEach((k) => ($(k).value = ""));
  renderRecords();
}

/* ---------- スパークライン ---------- */
function renderSpark() {
  const metric = $("sparkMetric").value;
  const svg = $("spark");
  const pts = recsOf(entry).filter((r) => r[metric] != null);
  const invert = metric === "rank";   // 順位は小さいほど上に描く

  if (pts.length < 2) {
    svg.innerHTML = `<text x="160" y="62" text-anchor="middle" class="spark-lbl">記録が2件以上で表示されます</text>`;
    $("sparkHint").textContent = "";
    return;
  }

  const W = 320, H = 120, PAD = 14;
  const vals = pts.map((p) => Number(p[metric]));
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }

  const x = (i) => PAD + (i * (W - PAD * 2)) / (pts.length - 1);
  const y = (v) => {
    const t = (v - min) / (max - min);
    return invert ? PAD + t * (H - PAD * 2) : H - PAD - t * (H - PAD * 2);
  };

  const line = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`;
  const dots = vals.map((v, i) => `<circle class="spark-dot" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.5"><title>${pts[i].date}: ${v}</title></circle>`).join("");

  svg.innerHTML =
    `<line class="spark-grid" x1="${PAD}" y1="${H - PAD}" x2="${W - PAD}" y2="${H - PAD}"></line>` +
    `<path class="spark-area" d="${area}"></path>` +
    `<path class="spark-line" d="${line}"></path>` + dots +
    `<text class="spark-lbl" x="${PAD}" y="${H - 3}">${pts[0].date}</text>` +
    `<text class="spark-lbl" x="${W - PAD}" y="${H - 3}" text-anchor="end">${pts[pts.length - 1].date}</text>`;

  const unit = metric === "price" ? "円" : metric === "rank" ? "位" : "件";
  $("sparkHint").textContent = `${pts.length}件 ・ ${min}〜${max}${unit}（${invert ? "上ほど上位" : "上ほど大きい"}）`;
}

/* ---------- 保存 ---------- */
function saveItem() {
  const model = $("fModel").value.trim();
  if (!model) { toast("型番は必須です", true); $("fModel").focus(); return; }

  entry.model    = model;
  entry.name     = $("fName").value.trim();
  entry.brand    = $("fBrand").value.trim();
  entry.category = $("fCat").value.trim() || "未分類";
  entry.status   = $("fStatus").value;
  entry.tags     = $("fTags").value.split(",").map((s) => s.trim()).filter(Boolean);
  entry.note     = $("fNote").value;
  entry.updatedAt = nowIso();

  const idx = data.items.findIndex((i) => i.id === entry.id);
  if (idx >= 0) data.items[idx] = entry; else data.items.push(entry);

  persistLocal(); markDirty(true);
  closeItem(); renderTabs(); renderGrid();
  toast(isNew ? "追加しました" : "保存しました");
}

function deleteItem() {
  if (!confirm(`「${entry.model}」を削除します。よろしいですか？`)) return;
  data.items = data.items.filter((i) => i.id !== entry.id);
  persistLocal(); markDirty(true);
  closeItem(); renderTabs(); renderGrid();
  toast("削除しました");
}

/* =========================================================
   GitHub 連携（Contents API）
   ========================================================= */
function b64encode(str) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(str)));
}
function b64decode(b64) {
  const bin = atob(b64.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
function ghHeaders() {
  const h = { Accept: "application/vnd.github+json" };
  if (cfg.pat) h.Authorization = `token ${cfg.pat}`;
  return h;
}
function ghUrl() {
  return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${DATA_PATH}?ref=${encodeURIComponent(cfg.branch)}`;
}
function cfgReady() {
  return Boolean(cfg.owner && cfg.repo && cfg.branch);
}

async function pullFromGitHub(silent) {
  if (!cfgReady()) { if (!silent) toast("設定でオーナー/リポジトリを入力してください", true); return false; }
  try {
    const res = await fetch(ghUrl(), { headers: ghHeaders(), cache: "no-store" });
    if (res.status === 404) { if (!silent) toast("data/products.json が見つかりません（初回保存で作成されます）", true); return false; }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const json = await res.json();
    sha = json.sha;
    data = normalize(JSON.parse(b64decode(json.content)));
    persistLocal(); markDirty(false);
    renderTabs(); renderGrid(); renderStats();
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
    // 競合を避けるため最新SHAを取り直す
    const head = await fetch(ghUrl(), { headers: ghHeaders(), cache: "no-store" });
    if (head.ok) sha = (await head.json()).sha;
    else if (head.status === 404) sha = null;
    else throw new Error(`${head.status} ${head.statusText}`);

    data.updatedAt = nowIso();
    const body = {
      message: `Update ${DATA_PATH} (${data.items.length} items)`,
      content: b64encode(JSON.stringify(data, null, 2)),
      branch:  cfg.branch,
    };
    if (sha) body.sha = sha;

    const res = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${DATA_PATH}`, {
      method: "PUT", headers: { ...ghHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.json()).message || res.statusText}`);

    sha = (await res.json()).content.sha;
    markDirty(false);
    toast("GitHubに保存しました");
  } catch (e) {
    toast("保存失敗: " + e.message, true);
  } finally {
    btn.disabled = false; btn.textContent = "💾 GitHubに保存";
  }
}

/* =========================================================
   設定モーダル / インポート・エクスポート
   ========================================================= */
function openCfg() {
  $("cOwner").value  = cfg.owner;
  $("cRepo").value   = cfg.repo;
  $("cBranch").value = cfg.branch;
  $("cPat").value    = cfg.pat;
  $("cfgStatus").textContent = "";
  renderStats();
  $("cfgModal").hidden = false;
}
function renderStats() {
  $("statItems").textContent = data.items.length;
  $("statLinks").textContent = data.items.reduce((n, i) => n + i.links.length, 0);
  $("statRecs").textContent  = data.items.reduce((n, i) => n + i.records.length, 0);
}

function exportJson() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `products-${today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importJson(file) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      data = normalize(JSON.parse(fr.result));
      persistLocal(); markDirty(true);
      renderTabs(); renderGrid(); renderStats();
      toast(`${data.items.length} 型番を読み込みました`);
    } catch (e) { toast("JSONの読み込みに失敗: " + e.message, true); }
  };
  fr.readAsText(file);
}

/* =========================================================
   起動
   ========================================================= */
function bind() {
  $("verLabel").textContent = "v" + VERSION;

  $("btnNew").onclick      = () => openItem(null);
  $("btnSettings").onclick = openCfg;
  $("btnSaveGh").onclick   = saveToGitHub;
  $("btnExport").onclick   = exportJson;
  $("btnImport").onclick   = () => $("fileInput").click();
  $("fileInput").onchange  = (e) => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ""; };

  $("q").oninput      = (e) => { filter.q = e.target.value; renderGrid(); };
  $("qClear").onclick = () => { $("q").value = ""; filter.q = ""; renderGrid(); };
  $("sortSel").onchange = (e) => { sortKey = e.target.value; renderGrid(); };

  // アイテムモーダル
  $("itemClose").onclick      = closeItem;
  $("btnCancelItem").onclick  = closeItem;
  $("btnSaveItem").onclick    = saveItem;
  $("btnDelItem").onclick     = deleteItem;
  $("btnAddLink").onclick     = addLink;
  $("lUrl").onkeydown         = (e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } };
  $("btnAddRec").onclick      = addRecord;
  $("sparkMetric").onchange   = renderSpark;

  // 設定モーダル
  $("cfgClose").onclick   = () => { $("cfgModal").hidden = true; };
  $("btnSaveCfg").onclick = () => {
    cfg = {
      owner:  $("cOwner").value.trim(),
      repo:   $("cRepo").value.trim(),
      branch: $("cBranch").value.trim() || "main",
      pat:    $("cPat").value.trim(),
    };
    saveCfg();
    $("cfgModal").hidden = true;
    toast("設定を保存しました");
  };
  $("btnPullGh").onclick = async () => {
    cfg.owner  = $("cOwner").value.trim();
    cfg.repo   = $("cRepo").value.trim();
    cfg.branch = $("cBranch").value.trim() || "main";
    cfg.pat    = $("cPat").value.trim();
    saveCfg();
    $("cfgStatus").textContent = "読み込み中…";
    const ok = await pullFromGitHub(false);
    $("cfgStatus").textContent = ok ? "読み込み完了" : "読み込めませんでした";
  };
  $("btnWipe").onclick = () => {
    if (!confirm("この端末に保存されているデータを消します。GitHub上のファイルは消えません。")) return;
    localStorage.removeItem(LS_DATA);
    data = { version: 1, updatedAt: "", items: [] };
    renderTabs(); renderGrid(); renderStats();
    toast("ローカルデータを消しました");
  };

  // オーバーレイの外側クリックで閉じる
  ["itemModal", "cfgModal"].forEach((id) => {
    $(id).onclick = (e) => { if (e.target.id === id) $(id).hidden = true; };
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { $("itemModal").hidden = true; $("cfgModal").hidden = true; }
    if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); saveToGitHub(); }
  });
  window.addEventListener("beforeunload", (e) => {
    if (dirty) { e.preventDefault(); e.returnValue = ""; }
  });
}

async function boot() {
  loadCfg();
  bind();

  // 1) ローカルの作業中データ 2) 同梱の data/products.json の順で表示
  const local = loadLocal();
  if (local) { data = local; markDirty(true); }
  else {
    try {
      const res = await fetch(DATA_PATH + "?t=" + Date.now(), { cache: "no-store" });
      if (res.ok) { data = normalize(await res.json()); markDirty(false); }
    } catch { markDirty(false); }
  }

  renderTabs(); renderGrid(); renderStats();

  // 設定済みならGitHubの最新を静かに取りに行く（ローカル未変更時のみ）
  if (cfgReady() && !dirty) pullFromGitHub(true);
}

document.addEventListener("DOMContentLoaded", boot);
