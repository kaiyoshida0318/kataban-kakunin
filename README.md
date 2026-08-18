# 型番商品確認くん

型番ごとに関連URL（楽天・ランキングページ・仕入元など）をまとめて置いておくための静的Webツール。
ビルド不要、GitHub Pages にそのまま置ける。

## 構成

```
index.html          画面
app.js              ロジック
style.css           スタイル
favicon.png
logo.png
data/products.json  データ本体（GitHubに保存される）
SETUP.md            セットアップ手順
```

## できること

- 型番の登録（型番 / 商品名 / カテゴリ）
- 型番ごとにURLを何本でも追加（楽天・楽天ランキング・Amazon・Yahoo!・メルカリ・1688・タオバオ・公式・その他）
- 型番・商品名・URL 横断の検索、カテゴリタブでの絞り込み
- 一覧でURLを全部展開表示、クリックで別タブ、⧉ でコピー
- 「💾 GitHubに保存」で `data/products.json` に直接コミット（`Cmd/Ctrl + S` でも可）

編集内容はブラウザの localStorage にも自動保存されるので、保存し忘れてタブを閉じても復元される
（ヘッダーが `● 未保存` のままなら未コミット）。

セットアップは [SETUP.md](SETUP.md) を参照。

## データ形式

```jsonc
{
  "version": 1,
  "updatedAt": "ISO8601",
  "items": [
    {
      "id": "itm_xxxx",
      "model": "型番",        // 必須
      "name": "商品名",
      "category": "カテゴリ",
      "links": [
        { "type": "rakuten", "label": "ラベル", "url": "https://..." }
      ],
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ]
}
```

`links[].type` は `rakuten` / `rakuten_rank` / `amazon` / `yahoo` / `mercari` /
`alibaba` / `taobao` / `official` / `other`。

## 今後の拡張余地

- 順位・価格の定点記録と推移グラフ
- 楽天ウェブサービスでの自動取得（GitHub Actions で定期実行）
- CSV / スプレッドシート書き出し
