# セットアップ手順（GitHub）

Public リポジトリ + GitHub Pages で公開する構成。
URLを知っている人だけが使う想定だが、**Publicなので中身は誰でも見られる**点だけ念頭に。
非公開にしたい情報（原価、仕入先の交渉内容など）は書かないこと。

所要時間：10分くらい。

---

## 1. リポジトリを作る

1. https://github.com/new を開く
2. 入力する
   - **Repository name**: `kataban-kakunin`（好きな名前でOK。あとで設定画面に入れる）
   - **Description**: `型番商品チェッカー`（任意）
   - **Public** を選択
   - **Add a README file** は **チェックしない**（zipにREADMEが入っているため）
   - `.gitignore` / `license` も **None** のまま
3. **Create repository**

---

## 2. ファイルを置く

### 方法A：ブラウザだけで完結（おすすめ）

1. zipをPCで展開する（展開してできるフォルダ名は何でもよい）
2. 作ったリポジトリの画面 → **uploading an existing file** リンク
   （もしくは **Add file → Upload files**）
3. 展開したフォルダの**中身**をまとめてドラッグ＆ドロップ
   - `index.html` / `app.js` / `style.css` / `favicon.svg` / `README.md` / `SETUP.md` / `data` フォルダ
   - ⚠️ 展開したフォルダごとではなく、**中身**を入れる
     （フォルダごと入れると `フォルダ名/index.html` になってPagesのURLがずれる）
4. 下の **Commit changes** を押す

### 方法B：gitコマンド

```bash
cd kataban-kakunin
git init
git add .
git commit -m "初期コミット"
git branch -M main
git remote add origin https://github.com/kaiyoshida0318/kataban-kakunin.git
git push -u origin main
```

---

## 3. GitHub Pages を有効にする

1. リポジトリの **Settings** タブ → 左メニューの **Pages**
2. **Build and deployment**
   - Source: **Deploy from a branch**
   - Branch: **main** / フォルダは **/ (root)**
3. **Save**
4. 1〜2分待つと同じ画面の上部にURLが出る

```
https://kaiyoshida0318.github.io/kataban-kakunin/
```

開いてサンプルの3型番が並んでいればOK。

---

## 4. Personal Access Token（PAT）を作る

アプリから `data/products.json` に書き込むために必要。

1. https://github.com/settings/personal-access-tokens/new を開く
   （手動なら 右上アイコン → Settings → 一番下 Developer settings
   → Personal access tokens → **Fine-grained tokens** → Generate new token）
2. 入力する
   - **Token name**: `kataban-kakunin`
   - **Expiration**: 1年など（切れたら作り直して入れ替える）
   - **Repository access**: **Only select repositories** → `kataban-kakunin` を選ぶ
   - **Repository permissions** → **Contents** を **Read and write** にする
     （`Metadata: Read-only` が自動で付くのはそのままでOK。他はNo accessのまま）
3. **Generate token**
4. 表示された `github_pat_…` を**その場でコピー**（画面を離れると二度と見られない）

> ⚠️ このトークンは**絶対にリポジトリに入れない**こと。
> アプリは入力されたトークンをブラウザのlocalStorageにだけ保存し、
> 送信先は `api.github.com` のみ。

---

## 5. アプリ側の設定

1. Pages のURLを開く
2. 右上 **⚙️ 設定**
   - オーナー: `kaiyoshida0318`
   - リポジトリ: `kataban-kakunin`
   - ブランチ: `main`
   - Personal Access Token: さっきコピーしたもの
3. **⤓ GitHubから読み込む** を押して「読み込み完了」と出れば接続OK
4. **保存**

---

## 6. 動作確認

1. **＋ 型番を追加** → 型番に適当な値（例 `TEST-001`）を入れて **保存**
2. 右上が `● 未保存` になる
3. **💾 GitHubに保存**（`Cmd/Ctrl + S` でも可）→「GitHubに保存しました」
4. GitHubの `data/products.json` を開いて `TEST-001` が入っていれば成功
5. 確認できたら `TEST-001` は削除 → もう一度 GitHubに保存

サンプルの3型番も、いらなくなったら同じ手順で消せる。

---

## よくあるつまずき

| 症状 | 原因と対処 |
|---|---|
| 「保存失敗: 404」 | オーナー/リポジトリ名のtypo、またはPATのRepository accessにこのリポジトリが入っていない |
| 「保存失敗: 403」 | PATの **Contents** が Read and write になっていない |
| 「保存失敗: 401」 | PATが失効した or 貼り間違い。作り直して設定に入れ直す |
| 「保存失敗: 409」 | 別の端末から先に保存された。**⤓ GitHubから読み込む** で最新を取ってからやり直す |
| Pagesが404 | 有効化直後は1〜2分かかる。あとは `index.html` がリポジトリ直下にあるか確認 |
| 保存したのに画面が古い | Pagesのキャッシュ。リロードするか **⤓ GitHubから読み込む** |

---

## 運用メモ

- 複数端末で使うなら、**開いたらまず ⤓ 読み込み → 触る → 💾 保存** の順を守る
- 編集内容はlocalStorageにも残るので、保存し忘れてタブを閉じても復元される
  （ヘッダーが `● 未保存` のままなら未コミット）
- `data/products.json` の履歴はGitに全部残るので、間違えて消しても過去のコミットから戻せる
