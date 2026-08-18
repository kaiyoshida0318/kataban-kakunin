/* =========================================================
   型番商品チェッカー / app.js
   型番ごとにURLを置いておくだけのシンプルな置き場
   データ: data/products.json（GitHub Contents API で読み書き）
   ========================================================= */

const VERSION   = "0.2.0";
const DATA_PATH = "data/products.json";
const LS_CFG    = "kata_cfg_v1";
const LS_DATA   = "kata_data_v1";

const LINK_TYPES = {
  rakuten:      "楽天",
  rakuten_rank: "楽天ランキング",
  amazon:       "Amazon",
  yahoo:        "Yahoo!",
  mercari:      "メルカリ",
  alibaba:      "1688",
  taobao:       "タオバオ",
  official:     "公式",
  other:        "その他",
};

/* ---------- 状態 ---------- */
let cfg   = { owner: "", repo: "", branch: "main", pat: "" };
let data  = { version: 1, updatedAt: "", items: [] };
let sha   = null;
let dirty = false;
let entry = null;
let isNew = false;

const filter = { q: "", cat: "*" };

/* ---------- 小物 ---------- */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => "itm_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
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
function ymd(iso) { return (iso || "").slice(0, 10); }

/* =========================================================
   保存まわり
   ========================================================= */
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
  try {
    const raw = localStorage.getItem(LS_DATA);
    if (raw) return normalize(JSON.parse(raw));
  } catch { /* noop */ }
  return null;
}

function normalize(d) {
  const items = Array.isArray(d?.items) ? d.items : [];
  return {
    version: 1,
    updatedAt: d?.updatedAt || "",
    items: items.map((it) => ({
      id:       it.id || uid(),
      model:    it.model || "",
      name:     it.name || "",
      category: it.category || "未分類",
      links: (Array.isArray(it.links) ? it.links : [])
        .map((l) => ({
          type:  LINK_TYPES[l.type] ? l.type : "other",
          label: l.label || "",
          url:   l.url || "",
        }))
        .filter((l) => l.url),
      createdAt: it.createdAt || nowIso(),
      updatedAt: it.updatedAt || it.createdAt || nowIso(),
    })),
  };
}

function markDirty(v) {
  dirty = v;
  const el = $("saveState");
  if (dirty) { el.textContent = "● 未保存"; el.className = "save-state dirty"; }
  else       { el.textContent = "保存済";   el.className = "save-state ok"; }
}

/* =========================================================
   一覧
   ========================================================= */
function categories() {
  return Array.from(new Set(data.items.map((i) => i.category || "未分類")))
    .sort((a, b) => a.localeCompare(b, "ja"));
}

function renderTabs() {
  const cats = categories();
  const el = $("catTabs");
  const tab = (k, label, cnt, on) =>
    `<button class="tab${on ? " on" : ""}" data-k="${esc(k)}">${esc(label)}<span class="cnt">${cnt}</span></button>`;

  el.innerHTML =
    tab("*", "すべて", data.items.length, filter.cat === "*") +
    cats.map((c) => tab(c, c, data.items.filter((i) => (i.category || "未分類") === c).length, filter.cat === c)).join("");

  el.querySelectorAll(".tab").forEach((b) => {
    b.onclick = () => { filter.cat = b.dataset.k; renderTabs(); renderList(); };
  });
  el.hidden = cats.length < 2;

  $("catList").innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join("");
}

function visibleItems() {
  const q = filter.q.trim().toLowerCase();
  return data.items
    .filter((it) => {
      if (filter.cat !== "*" && (it.category || "未分類") !== filter.cat) return false;
      if (!q) return true;
      const hay = [it.model, it.name, it.category, (it.links || []).map((l) => l.url + " " + l.label).join(" ")]
        .join(" ").toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

function renderList() {
  const list = visibleItems();
  $("emptyState").hidden = list.length > 0;

  $("list").innerHTML = list.map((it) => {
    const links = (it.links || []).map((l, i) => `
      <li class="url-row">
        <span class="chip ${esc(l.type)}">${esc(LINK_TYPES[l.type] || "その他")}</span>
        <a class="url-link" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" title="${esc(l.url)}">
          ${l.label ? `<span class="url-label">${esc(l.label)}</span>` : ""}<span class="url-text">${esc(l.url)}</span>
        </a>
        <button class="icon-btn" data-copy="${esc(it.id)}|${i}" title="URLをコピー">⧉</button>
      </li>`).join("");

    return `<article class="item" data-id="${esc(it.id)}">
      <div class="item-head">
        <span class="model">${esc(it.model || "—")}</span>
        <span class="item-name">${esc(it.name || "")}</span>
        <span class="pill">${esc(it.category || "未分類")}</span>
        <span class="item-date">${esc(ymd(it.updatedAt))}</span>
        <button class="icon-btn edit" data-edit="${esc(it.id)}" title="編集">✎</button>
      </div>
      <ul class="url-list">${links || '<li class="url-row muted">URL未登録</li>'}</ul>
    </article>`;
  }).join("");

  $("list").querySelectorAll("[data-edit]").forEach((b) => {
    b.onclick = () => openItem(data.items.find((i) => i.id === b.dataset.edit));
  });
  $("list").querySelectorAll("[data-copy]").forEach((b) => {
    b.onclick = () => {
      const [id, i] = b.dataset.copy.split("|");
      const it = data.items.find((x) => x.id === id);
      navigator.clipboard?.writeText(it.links[Number(i)].url);
      toast("URLをコピーしました");
    };
  });

  $("footNote").textContent =
    `${list.length} 件表示 / 全 ${data.items.length} 型番 ・ URL ${data.items.reduce((n, i) => n + i.links.length, 0)} 本`;
}

/* =========================================================
   編集モーダル
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

  const idx = data.items.findIndex((i) => i.id === entry.id);
  if (idx >= 0) data.items[idx] = entry; else data.items.push(entry);

  persistLocal(); markDirty(true);
  closeItem(); renderTabs(); renderList();
  toast(isNew ? "追加しました" : "保存しました");
}

function deleteItem() {
  if (!confirm(`「${entry.model}」を削除します。よろしいですか？`)) return;
  data.items = data.items.filter((i) => i.id !== entry.id);
  persistLocal(); markDirty(true);
  closeItem(); renderTabs(); renderList();
  toast("削除しました");
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
const ghBase = () => `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${DATA_PATH}`;
const ghGetUrl = () => `${ghBase()}?ref=${encodeURIComponent(cfg.branch)}`;
const cfgReady = () => Boolean(cfg.owner && cfg.repo && cfg.branch);

async function pullFromGitHub(silent) {
  if (!cfgReady()) { if (!silent) toast("オーナー/リポジトリを入力してください", true); return false; }
  try {
    const res = await fetch(ghGetUrl(), { headers: ghHeaders(), cache: "no-store" });
    if (res.status === 404) { if (!silent) toast("data/products.json が見つかりません（初回保存で作成されます）", true); return false; }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

    const json = await res.json();
    sha = json.sha;
    data = normalize(JSON.parse(b64decode(json.content)));
    persistLocal(); markDirty(false);
    renderTabs(); renderList();
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
    const body = {
      message: `Update ${DATA_PATH} (${data.items.length} items)`,
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
    btn.disabled = false; btn.textContent = "💾 GitHubに保存";
  }
}

/* =========================================================
   設定モーダル
   ========================================================= */
function openCfg() {
  $("cOwner").value  = cfg.owner;
  $("cRepo").value   = cfg.repo;
  $("cBranch").value = cfg.branch;
  $("cPat").value    = cfg.pat;
  $("cfgStatus").textContent = "";
  $("cfgModal").hidden = false;
}
function readCfgForm() {
  cfg = {
    owner:  $("cOwner").value.trim(),
    repo:   $("cRepo").value.trim(),
    branch: $("cBranch").value.trim() || "main",
    pat:    $("cPat").value.trim(),
  };
  saveCfg();
}

/* =========================================================
   起動
   ========================================================= */
function bind() {
  $("verLabel").textContent = "v" + VERSION;

  $("btnNew").onclick      = () => openItem(null);
  $("btnSettings").onclick = openCfg;
  $("btnSaveGh").onclick   = saveToGitHub;

  $("q").oninput      = (e) => { filter.q = e.target.value; renderList(); };
  $("qClear").onclick = () => { $("q").value = ""; filter.q = ""; renderList(); };

  $("itemClose").onclick     = closeItem;
  $("btnCancelItem").onclick = closeItem;
  $("btnSaveItem").onclick   = saveItem;
  $("btnDelItem").onclick    = deleteItem;
  $("btnAddLink").onclick    = addLink;
  $("lUrl").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } };

  $("cfgClose").onclick   = () => { $("cfgModal").hidden = true; };
  $("btnSaveCfg").onclick = () => { readCfgForm(); $("cfgModal").hidden = true; toast("設定を保存しました"); };
  $("btnPullGh").onclick  = async () => {
    readCfgForm();
    $("cfgStatus").textContent = "読み込み中…";
    const ok = await pullFromGitHub(false);
    $("cfgStatus").textContent = ok ? "読み込み完了" : "読み込めませんでした";
  };

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

  const local = loadLocal();
  if (local) { data = local; markDirty(true); }
  else {
    try {
      const res = await fetch(DATA_PATH + "?t=" + Date.now(), { cache: "no-store" });
      if (res.ok) data = normalize(await res.json());
    } catch { /* noop */ }
    markDirty(false);
  }

  renderTabs(); renderList();
  if (cfgReady() && !dirty) pullFromGitHub(true);
}

document.addEventListener("DOMContentLoaded", boot);
