# 月別売上グラフ

集計カードの下の棒グラフ。今の絞り込みに合う注文の、月ごとの売上（キャンセルを除く）。棒の上に金額が文字で出る。

## Sub-features

- `chart-bars` 注文のある月だけ、古い順に棒が並ぶ。
- `chart-labels` 棒の上に「479.7万円」の形の金額。

## How to get to it (user POV)

- ページを開くと見える。利用者は「グラフ」「棒」と呼ぶ。

## Driving it with control-dashboard

```bash
node $C state                      # chart に [{ month, value }]
node $C screenshot --part chart
```

確かめ方（前提と、見えるべき状態）。前提：`doctor` が `ok: true`。`reset` の直後（最初の画面、単位は円、検索と地域は空）。

- **最初のグラフ。** `state`。`chart` は 5月〜10月の6本で、5月 479.7万円・6月 380.0万円・7月 694.2万円から始まる。
- **絞り込みに従う。** `region 関東`。`chart` の値が、関東の注文だけの値に変わる。

## Gotchas

- SVG で描いている。値は `state` の `chart`（SVG の文字）で読む。画像の比較で判定しない。
- 注文の無い月は棒が出ない。絞り込むと月の数が減ることがある。
