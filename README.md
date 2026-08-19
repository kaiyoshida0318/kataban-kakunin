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
| 📦 型番商品 | 監視したい商品。1行1商品 |
| 🏆 楽天ランキング | よく見る楽天のランキングページ |
| 📊 Amazonランキング | よく見るAmazonの売れ筋ランキングページ |

**3タブとも同じ表・同じ編集モーダル**で、データ形式も共通。保存は「💾 保存」1回で `data/products.json` に全部入る。

## できること

- 一覧は普通の表。左端にアイキャッチ画像、以降 名称 / カテゴリ / URL / 確認内容 / 確認日 / 商品数 / 操作
- 列見出しクリックで昇順↔降順の並べ替え
- 上部の **⇔ 幅・高さ調整** で、各列の幅と行の高さをpxで入力できる。列幅は境目のドラッグでも変更可。どちらもブラウザに保存される
- 表は画面幅いっぱい。横スクロールバーは出さず、狭い画面では列幅が比率を保ったまま縮む
- 確認日は表の中で直接入力でき、隣の **本日反映** で今日の日付が入る。14日を超えると欄が琥珀色に
- 「商品」列の件数ボタンで行を展開すると、関連URLを表で管理できる（追加日 / 画像 / 商品URL / メモ）
- 商品行の右端の **✎** でその場で編集（Enterで保存、Escでキャンセル）
- 編集モーダルは左にアイキャッチ画像、右に各項目、下に追加済みの商品一覧
- タブごとの検索とカテゴリ絞り込み
- 「💾 保存」で `data/products.json` に直接コミット（`Cmd/Ctrl + S` でも可）

編集内容はブラウザの localStorage にも自動保存されるので、保存し忘れてタブを閉じても復元される
（ヘッダーに `● 未保存` が出ていれば未コミット）。

セットアップは [SETUP.md](SETUP.md) を参照。

## データ形式

```jsonc
{
  "version": 3,
  "updatedAt": "ISO8601",
  "sections": {
    "products": { "items": [ /* 下記の共通形式 */ ] },
    "rakuten":  { "items": [ /* 同上 */ ] },
    "amazon":   { "items": [ /* 同上 */ ] }
  }
}

// 3タブ共通のアイテム
{
  "id": "itm_xxxx",
  "name": "名称",              // 必須（型番商品なら「型番 商品名」）
  "url": "https://...",        // 必須
  "image": "https://…/eye.jpg", // アイキャッチ画像
  "category": "カテゴリ",
  "checkNote": "確認内容",
  "checkedAt": "2026-08-19",   // 最終確認日 (YYYY-MM-DD)
  "picks": [                   // 関連URL・チェックした商品
    { "id": "pk_xxxx", "addedAt": "2026-08-19", "image": "", "url": "https://...", "note": "メモ" }
  ],
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

旧形式（v1の `items` 直下、v2の `model` + `links[]`）は読み込み時に自動で移行される。
型番と商品名は `name` にまとめられ、2本目以降のURLは `picks` に移る。

`links[].type` は `rakuten` / `rakuten_rank` / `amazon` / `amazon_rank` / `yahoo` /
`mercari` / `alibaba` / `taobao` / `official` / `other`。

旧形式（`items` が直下にある v1）のJSONを読み込んだ場合は、自動的に `sections.products` に移行される。

## 今後の拡張余地

- 順位・価格の定点記録と推移グラフ
- 楽天ウェブサービスでの自動取得（GitHub Actions で定期実行）
- CSV / スプレッドシート書き出し
