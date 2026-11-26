# 表示単位の設定

金額を、円（￥384,980）で出すか、万円（38.5万円）で出すかを選ぶ。選んだ単位はブラウザに保存され、次に開いたときも同じ単位になる。

## Sub-features

- `unit-select` 円・万円のどちらかを選ぶ。
- `unit-apply` 選ぶとすぐに、すべての画面の金額に反映される。
- `unit-persist` 再読み込みしても、選んだ単位が残る。

## How to get to it (user POV)

- 画面上部のメニューの「設定」。
- 利用者は「万円表示」「単位」と言うことが多い。

## Driving it with control-dashboard

```bash
node $C open settings
node $C unit 万円
node $C open dashboard
node $C state
```

確かめ方（前提と、見えるべき状態）。前提：`doctor` が `ok: true`。`reset` の直後（最初の画面、単位は円、検索と地域は空）。

- **選ぶ。** `open settings` → `unit 万円`。`unit` が「万円」。
- **ダッシュボードに反映される。** `open dashboard`。`cards` の売上合計が 3,003.2万円、平均注文額が 27.8万円。
- **顧客の画面に反映される。** `customer "久保 達也"`。合計金額が 38.5万円。
- **残る。** `reload`。`open settings` で `unit` が「万円」のまま。

## Gotchas

- `unit` は設定の画面でだけ使える。先に `open settings`。
- `reload` と `rebuild` の後も、選んだ単位は残る。最初の単位（円）に戻すときは `reset`。
- 月別売上グラフは、設定にかかわらず、いつも万円。この設定の対象外。
