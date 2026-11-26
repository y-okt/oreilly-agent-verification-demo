# 注文一覧

ページの一番下の表。今の絞り込みに合う注文を、日付の新しい順に、先頭の20行まで出す。

## Sub-features

- `table-rows` 行は最大20。注文番号・日付・顧客・商品・数量・金額・状態・地域。
- `table-order` 日付の新しい順。同じ日付は注文番号の順。
- `table-customer-link` 顧客名を押すと、顧客の画面が開く（[customer-detail.md](customer-detail.md)）。

## How to get to it (user POV)

- ページを下へスクロールすると見える。利用者は「表」「一覧」と呼ぶ。

## Driving it with control-dashboard

```bash
node $C state                      # table に rowsShown・first・last
node $C screenshot --part table
```

確かめ方（前提と、見えるべき状態）。前提：`doctor` が `ok: true`。`reset` の直後（最初の画面、単位は円、検索と地域は空）。

- **最初の一覧。** `state`。`table.rowsShown` が 20、`table.first` が ORD-0049（2026年10月29日、久保 達也）、`table.last` が ORD-0013。
- **顧客名のリンク。** `customer "久保 達也"`。顧客の画面が開く（[customer-detail.md](customer-detail.md)）。

## Gotchas

- 20行を超える分は出ない（ページ送りは無い）。件数は `matchCount` で見る。
