# ヘルプ

「ヘルプ」ボタンを押すと、使い方と集計の決まりを書いたダイアログが開く。

## Sub-features

- `help-open` ボタンでダイアログが開き、見出し「使い方」が出る。
- `help-code` 集計の決まりのコード例に色が付く。
- `help-close` 「閉じる」ボタンか、ダイアログの外を押すと閉じる。

## How to get to it (user POV)

- 画面右上の、「ヘルプ」という名前のボタン。

## Driving it with control-dashboard

```bash
node $C help open
node $C snapshot --part help
node $C help close
```

確かめ方（前提と、見えるべき状態）。前提：`doctor` が `ok: true`。`reset` の直後（最初の画面、単位は円、検索と地域は空）。

- **開く。** `help open`。`helpOpen: true`。`snapshot --part help` に、ダイアログ「ヘルプ」、見出し「使い方」、見出し「集計の決まり」、コード例、ボタン「閉じる」が出る。
- **閉じる。** `help close`。`helpOpen: false`。

## Gotchas

- ヘルプのコードは、開いたときに読み込まれる。開いた直後は中身が空のことがある。`help open` はコード例が出るまで待つ。
- ダイアログの外を押して閉じる経路は、このツールでは確かめていない（未確認）。
