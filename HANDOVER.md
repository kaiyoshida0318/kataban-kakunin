# 引き継ぎメモ（型番商品確認くん）

最終更新: 2026-08-26 / 現行版 **v0.77.0**

次のチャットに渡すもの:

1. `katabankakuninv0.77.0full.zip`（全ファイル入り。これが唯一の正）
2. このファイル（zipの中にも `HANDOVER.md` として入っている）

---

## 1. これは何か

型番商品のリサーチ作業を回すための**静的Webツール**。ビルド不要、GitHub Pages にそのまま置ける。
データは `data/products.json` 1本で、**GitHub Contents API 経由で読み書き**する。サーバーは無い。

```
index.html          画面の骨格（ヘッダー・モーダル・トースト等）  305行
app.js              ロジック全部（1ファイル）                  2,909行
style.css           スタイル全部                                801行
data/products.json  データ本体
logo.png / favicon.png
README.md           使う人向けの機能説明（ユーザー向け）
SETUP.md            GitHub連携のセットアップ手順
HANDOVER.md         これ（作る側向け）
```

- **README.md はユーザー向け、HANDOVER.md は開発側向け**。機能を足したら README も直すこと。
- 依存ライブラリ・ビルド・パッケージマネージャは**一切無い**。素のJSのまま保つ。

---

## 2. 作業の進め方（前チャットのやり方をそのまま踏襲すればよい）

### 環境

- 作業ディレクトリ: `/root/work/katabank`（zipを展開したもの）
- テストスクリプト: `/root/work/t*.js`（t.js 〜 t42.js まで42本ある。使い回して良い）
- ローカルサーバ: `cd /root/work/katabank && nohup python3 -m http.server 8899 &`
- Playwright: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` を `executablePath` に指定して使う

### 1サイクルの流れ

1. 要望を読む → 該当箇所を `grep -n` で特定
2. Python のヒアドキュメントで `app.js` / `style.css` を一括置換（下の「地雷」参照）
3. `node /root/work/tXX.js` で検証（新しい観点なら新規テストを書く）
4. 既存テスト（t18 / t28 / t32 / t35 / t36 あたり）を回してデグレを見る
5. `VERSION`（app.js 7行目）と `index.html` の `verLabel` を上げる
6. `zip -qr /root/work/katabankakuninvX.Y.Zfull.zip . -x "*.git*"` → `SendUserFile` で納品
7. 返信は「何を直したか」＋**検証ログの実出力**を短く貼る。日本語。

### テストの書き方の型

```js
const { chromium } = require('playwright');
const pickOpt = async (p, sel, v) => {   // 独自ドロップダウンを選ぶヘルパ
  await p.click(sel); await p.waitForTimeout(200);
  await p.click(`#stMenu button[data-v="${v}"]`); await p.waitForTimeout(300);
};
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));   // 最後に必ず出す
await p.goto('http://localhost:8899/index.html');
```

- 画面内の関数（`normRank` / `itemsOf` / `allPicks` / `persistLocal` / `renderAll` / `pickTotal` …）は
  `p.evaluate()` からそのまま呼べる。テストデータの仕込みはこれが速い。
- 画像取得を絡めたくないときは `await p.evaluate(() => { window.guessImage = async () => ''; })`。
- スクリーンショットも撮って自分で `Read` して見ること。CSSの案件は数値だけだと判断を誤る。

---

## 3. アーキテクチャの要点

### 3-1. タブは `SECTIONS` 配列で全部決まる

```js
const SECTIONS = [
  { key:"amazon",  label:"amazonランキング", side:"offense",
    urlFields:["urlAmazon","urlRakuten"], accent:"#206acf", tint:"#eef4fd", role:"巡回リスト", … },
  { key:"rakuten", label:"楽天ランキング", side:"defense",
    urlFields:["urlRakuten","urlAmazon"], accent:"#206acf", … },
  { key:"rivals",  label:"楽天ライバル", side:"rival",        // v0.64.0。中身は楽天ランキングと同じ
    urlFields:["urlRakuten","urlAmazon"], accent:"#206acf", … },
  { key:"products", label:"追加した商品", kind:"added",
    accent:"#2b8a63", tint:"#e8f5ee", role:"作業リスト", … },
];
```

- **タブを増やすときは SECTIONS に足して、`side` を持つなら SIDES にも1行足す**
  （`{v,label,cls,sec}`。`cls` は `style.css` の `.sd-*` と `.src-side.sd-*` に色を書く）。
  区分ドロップダウン・出所バッジ・出所の絞り込み・`data.sections` は SECTIONS / SIDES から作るので、
  この2箇所を直せば他は付いてくる。
- **`sideKeyOf()` は `urlFields[0]` で決める**（`side === "defense"` で判定しない）。
  ライバルタブのように defense 以外でも楽天基準にしたいタブがあるため。
- **タブごとの差はSECTIONSのキーで表す**（v0.65.0）。列管理の設定は3つの巡回タブで共通なので、
  タブ固有の違いはユーザー設定ではなく定義側に持たせる。楽天ライバルで使っているもの:

  | キー | 効き方 |
  |---|---|
  | `nameLabel` | 名称列と編集モーダルの見出し（ショップ名） |
  | `catLabel` | 大カテゴリ列の既定の見出し（ランキング2つ＝カテゴリー名 / ライバル＝強さ） |
  | `cats` | 大カテゴリを決まった選択肢のドロップダウンにする（`catList()`）。値がそのまま `category` に入る |
  | `omit` | その列を `rankDefs()` から落とす。編集モーダル（`#fNote` / `#fCat`）と絞り込みボタンも消える。\n    ランキング2タブは `["cat"]`、ライバルは `["note"]` |
  | `urlFields` | URL列の本数と並び。`["urlRakuten"]` なら楽天だけ |
  | `unit` | 帯の数え方（ショップ） |

  `cats` があるタブは絞り込みボタン（`categories()`）と並べ替え（`comparator()`）も選択肢の順に従う。
  **`saveRank()` は画面に出ている項目しか書かない。** 出していない `urlAmazon` や `checkNote` を
  空で上書きすると、タブを移してきた行の情報が消える。

- `kind:"added"` かどうかで表の作りが完全に分岐する（`isAdded(key)`）。
- `side` があるタブには「区分」列が出て、ドロップダウンで**行がタブ間を移動**する（`moveItem`）。
- 色は `accent` / `tint` を CSS変数 `--sec` / `--sec-soft` に流している（`applySecTheme`）。
  **巡回リスト2つ＝青、作業リスト＝緑**（v0.61.0で赤から変更）。役割で色を分けるのはユーザーが明示的に決めた仕様。
  タブ・帯・見出し・日付帯・役割バッジは全部この2値から来るので、**色替えは SECTIONS の2行だけ**でよい。

### 3-2. 列は `colsOf(key)` / `ADDED_COLS` / `pickColsOf(key)` の3系統

| 関数 | 使う場所 |
|---|---|
| `colsOf(key)` | amazon基準 / 楽天基準の一覧表（`.rank-tbl`） |
| `ADDED_COLS` | 追加した商品の表（`.added-tbl`） |
| `pickColsOf(key)` | 一覧の行を開いたときの「チェックした商品」表（`.pick-tbl`） |

**列の見た目（項目名・幅・揃え・表示/非表示・並び順）は `data.cols` に入っていて products.json 経由で
全端末に同期する**。v0.63.0で持ち方を変えた:

```jsonc
data.cols = {
  rowH, pickRowH,
  labels: { "title": "商品名", "st_check": "隙あり/なし" },   // ← lk 単位。表をまたいで共通
  layout: { rank:{列キー:{w,align}}, added:{…}, pick:{…} },  // ← 表ごと
  order:  { rank:[列キー…], added:[…], pick:[…] },            // ← 表ごと
  hide:   { rank:[列キー…], added:[…], pick:[…] },            // ← 表ごと
}
```

- **項目名は `lkOf(列キー)` で引く。** 同じものを指す列でもキーが違うことがあるので
  （商品名 = `a_title` / `p_title`、編集 = `a_edit` / `p_edit`）、`LK` で対応付けている。
  同じキーで両方の表に出る列（`p_aimg` / `a_sales` 等）は lk も同じなので自動で共通。
  **列を足したら LK に載せるか、両表で同じキーにすること。**
- 幅・揃えは `colWidth(c, grp)` / `colAlign(c, grp)`、`alignStyle(cols, grp, …)`。
  幅ドラッグは `<table data-grp>` から書き込み先の表を決める。
- v0.62.0以前の `items[列]={label,w,align,off}` は `normCols()` が移行する
  （項目名は lk へ、幅・揃えは3グループ全部へ配って見た目を保つ）。
`ensureCols()` → `{ rowH, pickRowH, items: { <colKey>: {label,w,align} } }`。
`colLabel()` / `colWidth()` / `colAlign()` を通して読むこと。定義配列の `label` を直接使わない。

**状態列（`a_check`/`p_check`、`a_buy`/`p_buy`）の項目名は1つを共有する。** `ST_COL_GROUP`
（`ST_FIELDS[].cols` から作る）で列キー→同じグループの列一覧を引き、`colLabelOf()` が
グループ内で最後（= `p_*`）から探して最初に見つかった `label` を返す。項目編集で名前を入れた
ときは `colGroup(key)` の全列に同じ値を書く。読み込み時は `unifyStCols()` が食い違いを解消するが、
**合わせる先は必ず `p_*`（チェックした商品）側**。`a_*` に寄せると N件表示で開く表の見出しが
勝手に変わり、ユーザーから「一個前に戻して」と言われる（v0.53.0で実際にやった）。
`p_*` に名前が無ければ両方消して既定に戻す。`stTitle()` も `colLabelOf()` 経由。

### 3-2a. 「チェックした商品」の列（v0.59.0）

`pickDefs()` は「追加した商品」（`ADDED_COLS`）と同じ顔ぶれを返す（`a_src` だけ無い）。
両モールの画像・URLを持ち、**そのタブの基準側を先**に置く。`a_sales` / `a_rival` / `a_qual` は
added と同じ列キーを使うので、項目名と幅は共通・表示/非表示は別（`hide` がグループごとのため）。

### 3-2b. 列管理（v0.56.0 / UIは v0.57.0）— 表示/非表示と並び順

UIは**画面下半分のパネル**（`#colModal` / `renderColModal()` / `openColModal()`）。
v0.70.0で「表を見ながら触りたい」という要望に合わせて、中央のモーダルから下寄せの板に変えた:
`#colModal{align-items:flex-end;background:transparent;pointer-events:none}` ＋
`.modal-cols{max-height:46vh;pointer-events:auto}`。**後ろを暗くしない・後ろを操作できる**のが要点で、
`pointer-events:none` を外すと表が触れなくなる。背面クリックでは閉じない（✕ / 閉じる / Esc）。1列＝1行の縦リストで、
左から 順番の数字 / ☑表示 / 項目名 / 幅 / 揃え / ↑↓。番号を打ち替えるとその位置へ動く（`reorder()`）。
**3グループとも常に出す**（v0.58.0）。開いているタブの表を先頭にして `now` バッジを付ける。
`rank` / `pick` の見本にするタブは、追加した商品タブから開いたときは `amazon` 固定。
v0.56.0ではヘッダー直下のインラインパネルだったが、ユーザーの要望でモーダルにした。
`renderBody()` は開いている間だけ `renderColModal()` を呼び直す（タブで列が変わるため）。

- 定義の配列（`rankDefs()` / `ADDED_COLS` / `pickDefs()`）は**素の定義**。ここから
  `arrangeCols(defs, group, secKey)` が `data.cols.order[group]` の順に並べ替え、
  `shownCols()` が `items[key].off` の列を落とす。画面が使うのは
  `colsOf(key)` / `pickColsOf(key)`（表示ぶんだけ）、列管理パネルは
  `allColsOf(key)` / `allPickColsOf(key)`（非表示も含む全部）。
- グループは4つ（v0.74.0）。**`rank` は amazonランキングと楽天ランキングで共通**、
  **`rivals` は楽天ライバル専用**（列の顔ぶれが違うので独立させた）、`added` と `pick` もそれぞれ別。
  振り分けは `colGroupOf(key)`。ユーザーが明示的に決めた仕様。
  v0.73.0以前の設定は `normCols()` が `rank` → `rivals` へ一度だけ写して見た目を保つ。
- **非表示は `data.cols.hide[グループ]`（列キーの配列）でグループごとに持つ**（v0.58.0）。
  `p_aimg` / `p_rimg` / `p_aurl` / `p_rurl` は added と pick の両方に出る同じキーなので、
  キー単位（旧 `items[key].off`）だと片方を隠すともう片方も消えた。項目名と幅はキー単位のまま
  （どの表でも同じ名前・同じ幅にしたい）。旧 `off` は `normCols()` が全グループの hide へ移す。
- `rank` の**URL列だけは、そのタブの基準側を必ず先に置く**（`arrangeCols` の中で入れ替える）。
  並びが2タブ共通なので、これが無いと楽天基準タブでAmazon URLが先に来てしまう。
- **行を作る関数は「列キー → セル」の対応表を作って `cols.map()` で並べること。**
  `addedRow()` / `pickPanel()` は元々セルを固定順に書き並べていたので、v0.56.0で対応表に直した。
  ここを固定順のまま増やすと、並べ替え・非表示で列と中身がずれる。
- 列を隠すと**入力欄が存在しなくなる**。保存側は「無い欄は今の値のまま」にすること。
  **編集行の入力欄は `data-pf="<商品の項目名>"` を持たせ、保存は `[data-pf]` を集めるだけ**（v0.59.0）。
  クラス名（`.pe-url` 等）や「両モールかどうか」で分岐していたのをやめたので、どの表・どのモールでも同じ。
  `tr.pick-new` の追加は `val()` で欄の有無を吸収する。
- 「編集」列を隠すと「＋商品」の追加ボタンの居場所が無くなるので、最後の列に置き直している。

揃えは `alignStyle(cols, tableSel, rowSel)` が `nth-child` の `<style>` を生成して当てている。
**新しい列や新しいセル中身を足したら alignStyle のセレクタ列挙にも足す**（img / input / .st-sel など個別に指定している）。

### 3-3. ドロップダウンは自前実装

ネイティブ `<option>` は背景色が効かないので、`stButton()` でボタンを描き `openStMenu()` で
`#stMenu`（body直下の単一要素）を開く方式。選択肢は `data.labels` に入り、**文言も色も順番も
設定画面から編集できる**（`renderLabelEditor`）。

```js
const ST_FIELDS = [
  { key:"rival",   title:"楽天ライバル状況", cols:["a_rival"] },
  { key:"quality", title:"商品品質",        cols:["a_qual"]  },
  { key:"check",   title:"隙あり/なし",      cols:["a_check","p_check"] },  // 基準タブと共通
  { key:"buy",     title:"買付",            cols:["a_buy","p_buy"] },
];
```

`ST_FIELDS` の並び＝設定画面のグループの並び＝表の列の並び、を揃える約束になっている。
選択肢を消したときは `reconcileLabels()` が既存データを先頭の値に付け替えるので、**孤立した値が
残らない**。ここはテスト t32 が見ている。

### 3-3a. URL欄の「文字 / URL」（v0.67.0）

URL欄に覚え書きを書きたいことがあるので、欄ごとに扱いを選べる。
`it.modes[項目] === "text"`（商品は `p.modes`）でリンクをやめて素の文字で出す。

- **切り替えボタンは編集するところにだけ出す**（v0.69.0でユーザーが指定。一覧には出さない）。
  - 編集モーダル … `URL_MODE_UI` + `paintUrlMode(field)`。押すと `entry.modes` を書き換えて描き直すだけで、
    保存は今まで通り `saveRank()` の `upsert(entry)` に乗る。
  - 商品の編集行 … `urlEditCell()` が入力欄と切り替えを1組で出す。押しても再描画せず、
    入力欄の `type` と `data-pfmode` を変えるだけ（**再描画すると打ちかけの値が消える**）。
    保存時に `data-pfmode` を見て `setUrlMode()` する。
- 一覧の表示は `urlCellHtml(obj, field, cut)`。リンクにするか素の文字にするかだけを見る。
- **`normRank()` は項目を白紙から作り直すので、増やした項目は必ずここに足すこと**（`modes: normModes(...)`）。
  忘れると保存・読み込みのたびに消える。
- 文字にした欄は `buildUrlIndex()` からも外す（URLではないので重複を数えない）。
- 入力欄（表編集・商品の編集行）は文字モードなら `type="text"`、プレースホルダも「文字」に変える。

### 3-3b. URLの重複表示（v0.66.0）

`buildUrlIndex()` が `renderBody()` の頭で全URLを数えて `urlCount`（Map）に入れ、
`dupTag(url)` が「唯一 / 他あり N」の `<span class="url-dup">` を返す。URLセル3箇所で使う。

- キーは `urlKey()`。**AmazonはASIN**（`asinOf`）、それ以外は `ホスト+パス`（`www.`・末尾スラッシュ・
  クエリを落とす）。同じ商品の別表記を同一視するためで、ここを厳密なURL一致に戻すと役に立たなくなる。
- 数える対象は**巡回タブの行のURLと、その行の商品のURL**。「追加した商品」は他タブの商品の写しなので
  数えない（数えると全部が「他あり」になる）。
- 押せない飾り（`<span>`。`cursor:default`）。リンクの中には入れない。

### 3-3b. URLの重複表示（v0.66.0）

`buildUrlIndex()` が `renderBody()` の頭で全URLを数えて `urlCount`（Map）に入れ、
`dupTag(url)` が「唯一 / 他あり N」の `<span class="url-dup">` を返す。URLセル3箇所で使う。

- キーは `urlKey()`。**AmazonはASIN**（`asinOf`）、それ以外は `ホスト+パス`（`www.`・末尾スラッシュ・
  クエリを落とす）。同じ商品の別表記を同一視するためで、ここを厳密なURL一致に戻すと役に立たなくなる。
- 数える対象は**巡回タブの行のURLと、その行の商品のURL**。「追加した商品」は他タブの商品の写しなので
  数えない（数えると全部が「他あり」になる）。
- 押せない飾り（`<span>`。`cursor:default`）。リンクの中には入れない。
- 出すのは表の3箇所だけ。**編集モーダルや表編集の入力欄には出さない**（ユーザーと確認済み）。

### 3-4. 保存（ここが一番こわい）

- `markDirty(true)` → `scheduleAutoSave()`（4秒アイドル / 最大60秒で発火）→ `saveToGitHub(true)`
- 409（sha衝突）は取り直して再試行。連続失敗は `saveFails` で数回だけリトライ。
- **`booting` フラグが立っている間は絶対に保存しない。** 起動時は
  `loadLocal()` → `fetchRemote()` → `updatedAt` で新しい方を採用 → `booting=false`、の順。
  かつてここを踏み外して**ユーザーのデータを消した事故がある**（下記「地雷」）。
- 件数が前回より50%以上減る保存はガードで止める。
- localStorage: `kata_cfg_v1`（PAT等・端末内のみ）/ `kata_data_v2`（データの写し）/
  `kata_cols_v1`（旧列幅・移行用）/ `kata_sort_v1`（タブごとの並び順）
- **PATは絶対にリポジトリへ入れない。** localStorage だけ、送り先は `api.github.com` だけ。

### 3-5. 画像の自動取得

商品URLだけ入れれば画像を拾う。`guessImage(url, log)` が段階的に試す:

1. Amazon: AsinImage ウィジェット → 旧 `images/P/` パターン
2. 楽天: 楽天市場商品検索API（JSONP。`applicationId` + `accessKey` が設定に要る）
3. ページを取ってOG画像（`ogImages`）。Amazonは `amazonImagesFromHtml()` で
   `images/I/…` を全部集め、URL内のサイズヒントで採点して `._AC_SL1500_` に組み直す
4. microlink → CORSプロキシ（`r.jina.ai` を先頭に複数）
5. `probeImage()` で 60×60 以上あるか実際に読んで検証
6. `isJunkImage()` でAmazonの汎用ロゴや `.svg` を弾く（これを入れないとロゴで止まる）

商品追加は**先に完了させて、画像は裏で取る**（サムネは「取得中」表示 → `paintPickThumb`）。
設定画面に画像取得テスト（`runImgTest`）があり、どの段で落ちたかログが出る。ユーザーは
画像が出ないとき、このログを貼ってくる。

### 3-5b. 楽天のパンくず → ジャンル名（v0.73.0）

`fetchGenre(url, log)` が `proxyList()` の中継を順に叩き、`genreFromPage(txt)` が中身を読む。
中継は画像取得と同じものを使い回す（`r.jina.ai` はHTMLではなく**マークダウン**で返ってくるので、
HTMLパースだけにすると取りこぼす）。読む順は **JSON-LD の BreadcrumbList → HTMLのパンくず
（`[class*=readcrumb]` 等）→ h1/title**。`GENRE_DROP` で「楽天市場トップ」「ランキングトップ」を捨てる。

- **ジャンル名はモールごとに2つ**（v0.75.0）。`name` が楽天側、`nameAmazon` がAmazon側。
  一覧の列は `name` / `name2`、編集モーダルは `openRank()` が **URL欄 → そのモールの名前欄** の順に
  `#rUrlFields` へ並べ替える（`NAME_BOX`）。Amazonのパンくずは `amazonGenreFromHtml()`。
  必須チェックはどちらか片方でも入っていれば通る。
- 表示は `breadcrumbHtml()` が `>` で `<br>` に割る（`esc()` 済みなので `&gt;` で分ける）。
  行の高さで見える段数が決まる（`--name-lines` のクランプ）。
- 入れるのは **`autoGenreTab()` が真のタブ（amazon / rakuten）だけ**。楽天ライバルは店名なので対象外。
- **名前が空のときしか入れない。** ユーザーは「編集は自由」を選んだので、入力欄のロックはしていない。
  取り直しは編集モーダルの `#btnGenre`（こちらは上書きする）。
- 表編集でURLを直したときは非同期で取りにいき、**戻ってきた時点でまだ空なら**書く（`upsert`）。
- 中継は普通に失敗する（実測で `r.jina.ai` が 429 を返した）。**失敗しても何もしない**のが約束。
  ⚙️設定の画像取得テストに楽天URLを入れると `fetchGenre` のログも出る。

### 3-6. 見出しの固定（v0.52.0で追加。今いちばん新しい所）

- `.app-header` の実高さを `ResizeObserver` で測って `--head-h` に流す（`syncHeadH` / `watchHeadH`）。
  `renderAll()` / `toggleColPanel()` / `resize` でも呼んでいる。
- `.grid-tbl thead th{ position:sticky; top:var(--head-h); z-index:30 }`
- **`.tbl-wrap` は `overflow:hidden` ではなく `overflow:clip`。**
  `hidden` はスクロール枠を作ってしまい、中の `sticky` が死ぬ。ここを戻すとバグが再発する。
- `border-collapse:collapse` だと固定中に枠線が消えるので、見出しの枠は `box-shadow:inset` で描いている。
- スクロール中は `body.scrolled` が付いてヘッダーが薄くなる（130px超で付き、60px未満で外れる）。
- **入れ子の表の見出しは固定しない（v0.55.0）。** `.grid-tbl thead th` は子孫セレクタなので、
  一覧の行を開いた「チェックした商品」（`.pick-tbl-wrap > .pick-tbl`、一覧表の `<td>` の中）の
  見出しにも効いてしまう。`.pick-tbl-wrap` は `overflow:hidden`＝スクロール枠なので、そこでは
  `top:var(--head-h)` が「枠の上から186px下げる」の意味になり、見出しが商品行の上に重なって
  元の場所には空の帯だけが残る。`.pick-tbl-wrap .pick-tbl thead th{position:static}` で止めている。
  **`.grid-tbl …` の子孫セレクタを足すときは、入れ子の pick-tbl に効かないか必ず見ること。**
- **縦スクロールバーは常時表示（v0.53.0 → v0.54.0）。** `html{overflow-y:scroll;scrollbar-gutter:stable}`
  だけだと、Chromeの重ね表示スクロールバーでは中身が短いとき右に何も出ない。`html::-webkit-scrollbar`
  を定義すると場所を取る実体のあるスクロールバーになるので、スクロール不要でも帯が残る
  （`scrollbar-color` はFirefox用）。行が増減するたびに出入りすると表の幅が15px動き、商品追加の
  直後に列がずれて見えるので、ここは戻さないこと。
  検証時の注意: **Playwrightのheadlessは既定で `--hide-scrollbars` が付く。**
  `ignoreDefaultArgs:["--hide-scrollbars"]` を付けないと `innerWidth - clientWidth` が常に0になり、
  効いているのに効いていないように見える。

### 3-7. その他

- ウィンドウを2つ開ける（`btnNewWin`）。`storage` イベントで中身を同期するが、
  **モーダルを開いている／インライン編集中は割り込まない**（入力が消えないように）。
- 履歴から復元: 直近Nコミットを取って `mergeVersions()` で合成する。事故ったときの命綱。
- 画像クリックで拡大（`openLightbox`）。
- 列の境目はドラッグでも幅を変えられる（`bindResizers`）。ダブルクリックで既定に戻る。

---

## 4. 触るときの地雷（実際に踏んだもの）

| 事故 | 教訓 |
|---|---|
| **データ消失**（起動時に古いlocalStorageを新しいリモートへ上書き保存した） | `booting` / `fetchRemote()` の順序を崩さない。保存まわりを触ったら必ずリロード込みでテストする |
| Pythonの一括置換スクリプトが途中の `assert` で落ち、**それより前の編集も丸ごと消えた** | 1バッチを小さく。**書き込み後に必ず `grep` で確認**する |
| `const L = () => (data.labels = normLabels(...))` が毎回新しい配列を作り、編集が反映されなかった | 「正規化して返す」関数は**同じ参照を返す**（`ensureLabels()` の形）。取得は `at()` 系ヘルパで1回だけ |
| microlinkがAmazonの汎用ロゴを返して、それを採用して止まっていた | `isJunkImage()` の除外リストを保つ。`.svg` は全部弾く |
| リファクタ後に旧名（`DEFAULT_PROXY` / `PICK_COLS`）が残り、設定モーダルが無言で開かなくなった | 名前を変えたら `grep -n` で全部潰す。`pageerror` を必ずログに出す |
| 項目編集パネルがタブ切替に追従しなかった | 表の形が変わる操作の後は `renderAll()` 側で追従させる |
| 名称が空の行にURLのホスト名（amazon.co.jp）が出ていた | 名前が2本になったので、空なら素直に「—」。`it.name || hostOf(head)` のような穴埋めは、項目が増えたときに嘘になる |
| 揃え設定が日付の帯（`.day-row`）にも効いてしまった | `alignStyle` の `rowSel` で行を絞る |
| 確認日を縦積みにしたら揃え設定が効かなくなった | `.check-cell` は `flex-direction:column`。寄せるのは `justify-content` ではなく `align-items`（`alignStyle` で別扱いにしてある） |
| 「チェックした商品」の編集行を `.pe-url2` の有無で「両モール」と判定していて、列を隠すと保存先がずれた | 入力欄には `data-pf` で書き込み先を持たせる。DOMの有無で意味を判定しない |
| 見出し固定（`.grid-tbl thead th`）が入れ子の「チェックした商品」にも効き、見出しが商品行に重なった | 一覧表の中には別の表が入る。`.grid-tbl` 配下のセレクタは `.pick-tbl` にも当たると考える |

---

## 5. これまでの流れ（v0.19.0 → v0.52.0 の要約）

引き継ぎ時は v0.19.0。ユーザーの要望を1つずつ潰して30版ほど重ねた。大きな節目だけ:

- タブ構成の試行錯誤（不規則分/定期分を作って→消した）→ **amazon基準（オフェンス）/ 楽天基準（ディフェンス）/ 追加した商品** の3本に確定
- 「区分」ドロップダウンで行をタブ間移動できるように
- 商品URLだけで画像を自動取得（Amazonが鬼門。何度も直した）
- 保存ボタンを押さない自動保存 → **これで一度データを飛ばし、復元機能を追加**（v0.37.0で修正）
- 追加した商品の列を業務に合わせて改造（30日販売数 / 楽天ライバル状況 / 商品品質 / 隙あり/なし / 買付）
- ドロップダウンの文言・色・増減・並べ替えを設定画面から編集可能に
- 項目編集（項目名・幅・揃え・行の高さ）を products.json に持たせて全端末で共有
- 役割で見た目を分離（巡回リスト＝青 / 作業リスト＝赤 → v0.61.0で緑）
- v0.51.0 新しいウィンドウ + ウィンドウ間同期
- v0.52.0 表の見出しをスクロール追従
- v0.53.0 状態列の項目名を表どうしで共通化 / 縦スクロールバー常時表示
- v0.54.0 揃える先を「チェックした商品」側に修正 / スクロールバーを短い画面でも出す
- v0.55.0 N件表示で開いた表の見出しがずれる不具合を修正
- v0.56.0 列管理（表示/非表示・並び順）。amazon基準/楽天基準は共通、追加した商品は別
- v0.57.0 列管理をモーダル化。縦リスト＋チェックボックス＋順番の数字
- v0.58.0 列管理に3つの表を全部出す。非表示を表ごとに持つよう変更
- v0.59.0 チェックした商品に「追加した商品」と同じ項目を追加
- v0.60.0 ＋商品を押している間は赤い「✕ キャンセル」に変わる
- v0.61.0 追加した商品のベースカラーを赤から緑へ
- v0.62.0 ＋商品のキャンセルで「チェックした商品」ごと閉じる
- v0.63.0 項目名を表をまたいで共通化、幅・揃えは表ごとに分離
- v0.64.0 タブ名を「amazonランキング」「楽天ランキング」に変更 / 「楽天ライバル」タブを追加
- v0.65.0 楽天ライバルを専用の形に（強さ / ショップ名 / 楽天URLのみ）
- v0.66.0 URLの下に「唯一 / 他あり」の印
- v0.67.0 URL欄ごとに「文字 / URL」を選べるように
- v0.68.0 ランキング2タブの「大カテゴリ」を「カテゴリー名」に
- v0.69.0 文字/URLの切り替えを編集画面だけに（一覧からは外した）
- v0.70.0 列管理を画面下半分のパネルに（表を見ながら触れる）
- v0.71.0 確認日の「本日反映」を日付の下に（列幅 212→140px）
- v0.72.0 タブ名から（オフェンス）（ディフェンス）を外す（区分の呼び名は据え置き）
- v0.73.0 楽天URLのパンくずからジャンル名を自動で入れる
- v0.74.0 列管理を4グループに（楽天ライバルを独立）
- v0.75.0 ジャンル名を楽天/amazonの2本立てに（URL→ジャンル名の並び）
- v0.76.0 ランキング2タブのカテゴリー名を廃止 / ジャンル名を「>」で改行表示
- **v0.77.0 ジャンル名が空のときにURLのホスト名（amazon.co.jp）が出ていたのを「—」に（最新）**

---

## 6. 宿題・未解決

1. ~~「追加した商品の最強配送」~~ / ~~「隙あり/なしを基準タブと共通に」~~ … **v0.53.0で解決。**
   コードに「最強配送」は無く、ユーザーの `data.cols.items.a_check.label` に入っていた（項目編集で
   付けた名前は products.json に入り全端末へ同期するので、コードをいくら grep しても出てこない）。
   同じフィールドなのに表ごとに別名を持てたのが原因。項目名をグループで共有＋読み込み時に
   食い違いを既定へ戻す形にした。**ユーザーのデータで見つからない文字列は data.cols / data.labels を疑う。**
2. README.md の「今後の拡張余地」に書いてある未着手ネタ:
   順位・価格の定点記録とグラフ / 楽天APIの定期自動取得 / CSV書き出し

---

## 7. ユーザーの進め方の癖（合わせると速い）

- 要望は**短文で連投**される。1メッセージに複数の要望が混ざることが多いので、拾い漏らさない。
- 「〜してほしい」は全部**実装依頼**。仕様の確認より、まず動くものを出した方が喜ばれる。
- 見た目・使い勝手への感度が高い（「ごちゃってる」「デザインで用途を分けて」など）。
  言われた通りに直すだけでなく、**役割が伝わる形**まで持っていくと通りが良い。
- 返信は日本語・簡潔に。**検証ログの実出力を貼る**と安心してもらえる。
- 毎回 zip で全ファイルを渡す（差分ではなく丸ごと）。バージョンは必ず上げる。
