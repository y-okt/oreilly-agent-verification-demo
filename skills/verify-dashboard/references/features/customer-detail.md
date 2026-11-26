# 顧客の画面

顧客1人について、注文数と合計金額（キャンセルを除く）、その顧客の注文の一覧を出す。注文は、画面を開いたときにサーバーから取る。

## Sub-features

- `customer-summary` 注文数と合計金額の2枚のカード。
- `customer-orders` その顧客の注文を、日付の新しい順に出す。
- `customer-pager` 「← 前の顧客」「次の顧客 →」で、顧客名の順（漢字の文字の順で、読みの五十音順ではない）に隣の顧客へ移る。
- `customer-loading` 注文を取っている間は「読み込み中…」と出る。
- `customer-back` 「← ダッシュボードへ戻る」で戻る。

## How to get to it (user POV)

- ダッシュボードの注文一覧で、顧客名を押す。メニューには無い。
- 顧客の画面の「前の顧客」「次の顧客」。月の報告を作るときに、顧客を順に見ていく使い方が多い。
- 利用者は「顧客のページ」「お客さんごとの合計」と呼ぶ。

## Driving it with control-dashboard

```bash
node $C customer "久保 達也"         # 注文一覧に出ている顧客名を、そのまま指定する
node $C next                        # 次の顧客へ（prev で前へ）
node $C idle                        # 注文が届き、画面が落ち着くまで待ってから state を返す
node $C screenshot --part page
node $C open dashboard              # 戻る
```

確かめ方（前提と、見えるべき状態）。前提：`doctor` が `ok: true`。`reset` の直後（最初の画面、単位は円、検索と地域は空）。

- **一覧から開く。** `customer "久保 達也"` → `idle`。`name` が「久保 達也」、`cards` が 注文数 4件・合計金額 ￥384,980、`orders.ids` が ORD-0049 から始まる。
- **次の顧客。** 続けて `next` → `idle`。`name` が「久保田 弘」、`cards` が 注文数 4件・合計金額 ￥782,080、`orders.ids` が ORD-0061 から始まる。
- **前の顧客。** `open dashboard` → `customer "久保 達也"` → `prev` → `idle`。`name` が「関根 輝」、合計金額 ￥911,400。
- **値の出どころ。** どの顧客でも、`orders.ids` は、ダッシュボードで `search <顧客名>` をして出る注文番号と同じ。

## Gotchas

- 注文一覧に出ていない顧客は押せない（一覧は先頭の20行）。`search <顧客名>` で絞ってから `customer` を使う。
- 注文は `GET /api/customers/<顧客名>` で取る。手元のサーバーはすぐに返すが、利用者の回線では数秒かかることがある。遅い回線は `delay <URL の一部> <ミリ秒>` で作れる。
- `state` の `loading: true` のときは、まだ注文が出ていない。決まった秒数を待つのではなく、`idle` で、リクエストが返って画面が落ち着くまで待ってから読む。
