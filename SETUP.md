# セットアップ手順

リポジトリ `kataban-kakunin`（Public）+ GitHub Pages で公開する構成。
Publicなので中身は誰でも見られる。非公開にしたい情報は書かないこと。

---

## 1. ファイルを置く

既にリポジトリがある場合は、**Add file → Upload files** で今回の一式をドロップして
上書きコミットするだけでよい（同じファイル名なので置き換わる）。

置くのはフォルダの**中身**:

```
index.html
app.js
style.css
favicon.svg
README.md
SETUP.md
data/products.json
```

---

## 2. GitHub Pages を有効にする

1. リポジトリの **Settings** → 左メニュー **Pages**
2. **Build and deployment**
   - Source: **Deploy from a branch**
   - Branch: **main** / フォルダ **/ (root)**
3. **Save**（初回は1〜2分かかる）

```
https://kaiyoshida0318.github.io/kataban-kakunin/
```

---

## 3. Personal Access Token を作る

アプリから `data/products.json` に書き込むために必要。

1. https://github.com/settings/personal-access-tokens/new
2. 入力する
   - **Token name**: `kataban-kakunin`
   - **Expiration**: 1年など
   - **Repository access**: **Only select repositories** → `kataban-kakunin`
   - **Repository permissions** → **Contents** を **Read and write**
     （`Metadata: Read-only` が自動で付くのはそのまま。他はNo access）
3. **Generate token** → 表示された `github_pat_…` をその場でコピー
   （画面を離れると二度と見られない）

> ⚠️ トークンは絶対にリポジトリに入れないこと。
> アプリはブラウザのlocalStorageにだけ保存し、送信先は `api.github.com` のみ。

---

## 4. アプリ側の設定

1. Pages のURLを開く
2. 右上 **⚙️ 設定**
   - オーナー: `kaiyoshida0318`
   - リポジトリ: `kataban-kakunin`
   - ブランチ: `main`
   - Personal Access Token: コピーしたもの
3. **⤓ GitHubから読み込む** →「読み込み完了」が出れば疎通OK
4. **保存**

---

## 5. 商品画像の自動取得（任意）

「チェックした商品」に商品URLを入れると画像を自動で拾う。Amazonは設定なしで動く。

**楽天も自動にしたい場合**

1. https://webservice.rakuten.co.jp/app/list でアプリを新規登録（無料）
2. **アプリID** と **アクセスキー** をコピー
3. アプリの右上 **⚙️ 設定** → 「商品画像の自動取得」に貼って **保存**

**Amazonの取得率を上げたい場合**

AmazonアソシエイトのトラッキングID（`yourname-22` の形）を持っていれば、⚙️設定 の
「Amazonアソシエイト タグ」に入れる。ASINから商品画像を引く公式ウィジェットが確実に通るようになる。
持っていなくても動くが、商品によっては画像が返らない。

**それ以外のサイト（Yahoo / メルカリ / 1688 など）**

中継サービス経由でページの `og:image` を拾う。既定の中継先が入っているのでそのままでよい。
別の中継先を使うなら `{url}` を含む形で入力する（例 `https://example.com/fetch?u={url}`）。
中継を使いたくないときは `-` だけ入れると、AmazonとRakuten以外は自動取得しなくなる。

> 中継サービスには商品URLだけが渡る。トークンなどは送られない。

---

## 6. 動作確認

1. **＋ 型番を追加** → 型番に `TEST-001`、URLを1本入れて **保存**
2. 右上が `● 未保存` になる
3. **💾 保存**（`Cmd/Ctrl + S` でも可）→「GitHubに保存しました」
4. GitHubの `data/products.json` に `TEST-001` が入っていれば成功
5. 確認できたら削除 → もう一度 GitHubに保存

サンプル（型番1件・楽天2件・Amazon1件）も同じ手順で消せる。

---

## つまずいたとき

| 症状 | 原因と対処 |
|---|---|
| 保存失敗: 404 | オーナー/リポジトリ名のtypo、またはPATの対象リポジトリにこれが入っていない |
| 保存失敗: 403 | PATの **Contents** が Read and write になっていない |
| 保存失敗: 401 | PATが失効 or 貼り間違い。作り直して入れ直す |
| 保存失敗: 409 | 別端末から先に保存された。**⤓ 読み込む** で最新を取ってからやり直す |
| Pagesが404 | 有効化直後は1〜2分待つ。`index.html` がリポジトリ直下にあるかも確認 |
| 保存したのに画面が古い | Pagesのキャッシュ。リロード or **⤓ 読み込む** |

---

## 運用メモ

- 保存は自動（変更の数秒後）。手動の **💾 保存** / `Cmd/Ctrl + S` も使える
- 複数端末で使うなら **開いたら ⤓ 読み込み** から始める。編集中に他端末が保存していた場合は自動でやり直すが、開きっぱなしのタブは古いままなので注意
- `data/products.json` の履歴はGitに残るので、間違えて消しても過去コミットから戻せる

### 過去の状態に戻す手順

1. GitHubで `data/products.json` を開き、右上の **History**
2. 戻したい時点のコミットを開く → ファイル右上の **⋯** → **View file**
3. **Raw** の中身を全部コピー
4. 現在の `data/products.json` を開いて ✏️ で編集 → 全選択して貼り替え → **Commit changes**
5. アプリを開いて ⚙️設定 → **⤓ GitHubから読み込む**
