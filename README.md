# 型番商品チェッカー

型番ごとに関連URL（楽天・ランキングページ・仕入元など）をまとめて置いて、
順位・価格・レビュー数を**手入力で積み上げて定点監視する**ための静的Webツール。

`yusen`（優先順位決定くん）と同じ構成 — ビルド不要、GitHub Pages にそのまま置ける。

## 構成

```
index.html          画面のガワ
app.js              ロジック（一覧・編集・GitHub保存）
style.css           スタイル
favicon.svg
data/products.json  データ本体（これがGitHubに保存される）
```

## 使い方

1. このリポジトリを GitHub に置き、Settings → Pages で `main / (root)` を公開する
2. 公開URLを開き、右上の **⚙️ 設定** で以下を入力
   - オーナー: `kaiyoshida0318`
   - リポジトリ: このリポジトリ名
   - ブランチ: `main`
   - Personal Access Token（`contents: write` 権限のあるFine-grained PAT推奨）
3. **＋ 型番を追加** から型番・URLを登録
4. 右上の **💾 GitHubに保存**（`Cmd/Ctrl + S` でも可）で `data/products.json` にコミットされる

編集内容はブラウザの localStorage にも自動保存されるので、
保存し忘れてタブを閉じても次に開いたとき復元される（ヘッダーに `● 未保存` と出る）。

PAT はこの端末のブラウザ内にのみ保存され、GitHub API 以外には送信しない。

## データ形式

```jsonc
{
  "version": 1,
  "updatedAt": "ISO8601",
  "items": [
    {
      "id": "itm_xxxx",
      "model": "型番",              // 必須
      "name": "商品名",
      "brand": "メーカー",
      "category": "カテゴリ",
      "status": "watch | candidate | running | archived",
      "tags": ["タグ"],
      "note": "メモ",
      "links": [
        { "type": "rakuten", "label": "ラベル", "url": "https://..." }
      ],
      "records": [
        { "date": "2026-08-18", "rank": 15, "price": 57800, "reviews": 27, "genre": "ジャンル/KW", "note": "" }
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

- 楽天ウェブサービス（ランキングAPI・商品検索API）での自動取得
- GitHub Actions で定期実行して `records` を自動追記
- CSV / スプレッドシート書き出し
- 複数型番の推移を重ねて比較する画面
