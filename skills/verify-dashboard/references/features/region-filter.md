# 地域の絞り込み

地域を選ぶと、件数・集計カード・月別売上グラフ・注文一覧が、その地域の注文だけになる。「すべて」で元に戻る。

## Sub-features

- `region-select` 地域を選ぶと、件数が変わる。
- `region-combined` 検索語が入っているときは、地域と検索語の両方に合う注文だけになる。
- `region-restore` 「すべて」で、地域の絞り込みが外れる（検索語は残る）。

## How to get to it (user POV)

- 絞り込みの行の、ラベル「地域」の選択欄。入口はここだけ。
- 選択肢：すべて、北海道・東北、関東、中部、関西、中国・四国、九州・沖縄。

## Driving it with control-dashboard

```bash
node $C region 関東
node $C region すべて
```

- 返り値の `state` に、選んだ後の件数・集計カード・グラフ・一覧が入る。

確かめ方（前提と、見えるべき状態）。前提：`doctor` が `ok: true`。`reset` の直後（最初の画面、単位は円、検索と地域は空）。

- **地域で絞る。** `region 関東`。`region` が「関東」、`matchCount` が 18件、`table.first` の地域が「関東」で、注文番号は ORD-0004。
- **元に戻す。** `region すべて`。`matchCount` が 120件、`cards` が最初の値に戻る（[summary-cards.md](summary-cards.md)）。

## Gotchas

- 一覧は先頭の20行まで。件数が20を超える地域では、行数は20のまま。件数（`matchCount`）で判定する。
