# 検索

検索欄に顧客名か商品名の一部を入れると、件数・集計カード・月別売上グラフ・注文一覧が、その語を含む注文だけになる。

## Sub-features

- `search-filter` 語を入れると、顧客名か商品名にその語を含む注文だけになる。
- `search-combined` 地域を選んでいるときは、地域と検索語の両方に合う注文だけになる。
- `search-clear` 空にすると、検索の絞り込みが外れる（地域は残る）。

## How to get to it (user POV)

- 絞り込みの行の、プレースホルダー「顧客名・商品名」の入力欄（ラベル「検索」）。入口はここだけ。

## Driving it with control-dashboard

```bash
node $C search モニター
node $C search ""          # 空に戻す
```

確かめ方（前提と、見えるべき状態）。前提：`doctor` が `ok: true`。`reset` の直後（最初の画面、単位は円、検索と地域は空）。

- **商品名で探す。** `search モニター`。`matchCount` が 13件、`table.first` の商品が「4Kモニター 27型」で、注文番号は ORD-0100。
- **顧客名で探す。** `search "久保田 弘"`。`matchCount` が 4件、`table.first` の注文番号が ORD-0061。
- **空に戻す。** `search ""`。`matchCount` が 120件。

## Gotchas

- 入力から画面への反映に 150ms の遅延がある。入力した直後の画面を読むと、古い値に見える。`search` は、表示が落ち着くまで待ってから `state` を返す（`settled: true`）。自分で DOM を読むときも待つ。
- 前後の空白は無視される。大文字・小文字やひらがな・カタカナは区別する。
