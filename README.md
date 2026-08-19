# 型番商品確認くん

型番や、よく見るランキングページのURLをまとめて置いておくための静的Webツール。
ビルド不要、GitHub Pages にそのまま置ける。

## 構成

```
index.html          画面
app.js              ロジック
style.css           スタイル
logo.png / favicon.png
data/products.json  データ本体（GitHubに保存される）
SETUP.md            セットアップ手順
```

## グローバルメニュー

| タブ | 中身 |
|---|---|
| 📦 型番商品 | 型番ごとに、関連URLを何本でも紐づけて置く |
| 🏆 楽天ランキング | よく見る楽天のランキングページ。確認内容・最終確認日と、ランキング内の良かった商品URLを持てる |
| 📊 Amazonランキング | 同上（Amazonの売れ筋ランキング） |

3タブとも `data/products.json` 1ファイルに入るので、保存は「💾 保存」1回で全部コミットされる。

## できること

- 型番の登録（型番 / 商品名 / カテゴリ）と、URLの複数紐づけ
- ランキング一覧は普通の表。左端にアイキャッチ画像、以降 ジャンル名 / カテゴリ / URL / 確認内容 / 確認日 / 商品数 / 操作
- 列見出し（ジャンル名・カテゴリ・確認日・商品）をクリックで昇順↔降順の並べ替え
- 列の境目をドラッグして幅を調整（ブラウザに保存。境目をダブルクリックで既定値に戻る）
- ランキングURLの登録（ジャンル名 / URL / アイキャッチ画像 / 確認内容 / 最終確認日 / カテゴリ）
- 「商品」列の件数ボタンで行を展開すると、その中でチェックした商品を表で管理できる（追加日 / 画像 / 商品URL / メモ）
- 編集モーダルは左にアイキャッチ画像、右に各項目、下に追加済みの商品一覧
- 画像は商品ページの画像を右クリックしてURLを貼るだけ（サムネイル表示。任意）
- 商品行の右端の **✎** でその場で編集（Enterで保存、Escでキャンセル）
- 確認日はカード上で直接入力でき、隣の **本日反映** ボタンで今日の日付が入る。14日を超えると琥珀色になる
- タブごとの検索とカテゴリ絞り込み
- URLはクリックで別タブ、⧉ でコピー
- 「💾 保存」で `data/products.json` に直接コミット（`Cmd/Ctrl + S` でも可）

編集内容はブラウザの localStorage にも自動保存されるので、保存し忘れてタブを閉じても復元される
（ヘッダーに `● 未保存` が出ていれば未コミット）。

セットアップは [SETUP.md](SETUP.md) を参照。

## データ形式

```jsonc
{
  "version": 2,
  "updatedAt": "ISO8601",
  "sections": {
    "products": {
      "items": [
        {
          "id": "itm_xxxx",
          "model": "型番",        // 必須
          "name": "商品名",
          "category": "カテゴリ",
          "links": [ { "type": "rakuten", "label": "ラベル", "url": "https://..." } ],
          "createdAt": "ISO8601",
          "updatedAt": "ISO8601"
        }
      ]
    },
    "rakuten": {
      "items": [
        {
          "id": "rk_xxxx",
          "name": "ジャンル名",      // 必須
          "url": "https://...",     // 必須
          "image": "https://…/eyecatch.jpg",  // アイキャッチ画像
          "checkNote": "確認内容",
          "checkedAt": "2026-08-19", // 最終確認日 (YYYY-MM-DD)
          "category": "カテゴリ",
          "picks": [                 // ランキング内の良かった商品
            { "id": "pk_xxxx", "addedAt": "2026-08-19", "image": "https://…/thumb.jpg", "url": "https://...", "note": "メモ" }
          ],
          "createdAt": "ISO8601",
          "updatedAt": "ISO8601"
        }
      ]
    },
    "amazon": { "items": [ /* rakutenと同じ形 */ ] }
  }
}
```

`links[].type` は `rakuten` / `rakuten_rank` / `amazon` / `amazon_rank` / `yahoo` /
`mercari` / `alibaba` / `taobao` / `official` / `other`。

旧形式（`items` が直下にある v1）のJSONを読み込んだ場合は、自動的に `sections.products` に移行される。

## 今後の拡張余地

- 順位・価格の定点記録と推移グラフ
- 楽天ウェブサービスでの自動取得（GitHub Actions で定期実行）
- CSV / スプレッドシート書き出し
