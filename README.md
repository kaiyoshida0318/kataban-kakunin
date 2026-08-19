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
| 🏆 楽天ランキング | よく見る楽天のランキングページURL一覧 |
| 📊 Amazonランキング | よく見るAmazonの売れ筋ランキングページURL一覧 |

3タブとも `data/products.json` 1ファイルに入るので、保存は「💾 保存」1回で全部コミットされる。

## できること

- 型番の登録（型番 / 商品名 / カテゴリ）と、URLの複数紐づけ
- ランキングURLの登録（ジャンル名 / カテゴリ / 期間 / URL）
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
          "name": "ジャンル名",    // 必須
          "category": "カテゴリ",
          "period": "daily",      // daily | weekly | monthly | realtime | other
          "url": "https://...",   // 必須
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
