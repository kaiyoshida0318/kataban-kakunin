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

## 5. 動作確認

1. **＋ 型番を追加** → 型番に `TEST-001`、URLを1本入れて **保存**
2. 右上が `● 未保存` になる
3. **💾 GitHubに保存**（`Cmd/Ctrl + S` でも可）→「GitHubに保存しました」
4. GitHubの `data/products.json` に `TEST-001` が入っていれば成功
5. 確認できたら削除 → もう一度 GitHubに保存

サンプルの `SD-1200X` も同じ手順で消せる。

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

- 複数端末で使うなら **開いたら ⤓ 読み込み → 触る → 💾 保存** の順
- `data/products.json` の履歴はGitに残るので、間違えて消しても過去コミットから戻せる
