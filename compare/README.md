# 地図とツールがある場合と無い場合を比べる

講義のデモで見せた比べ方を、手元で再現するためのフォルダです。同じ依頼を、skill「verify-dashboard」（Feature Map と操作用の CLI）がある作業用コピーと、無い作業用コピーで Claude Code に渡し、ツール呼び出しの数・費用・時間・直ったかを比べます。

小さなアプリなので、どちらでも直せることがあります。ですので、直ったかどうかだけでなく、そこまでの手数と費用を見ます。

> このフォルダには、直ったかを確かめる手順（不具合の再現のしかた）が入っています。デモを自分で試す前に読むと、答えが分かります。作業用コピーには、このフォルダは入りません。

## 必要なもの

- リポジトリ直下の README の「必要なもの」と `pnpm install`
- Claude Code（`claude` コマンド）
- 会話を MLflow に残すときだけ：Python 3

MLflow を使うときは、このフォルダの仮想環境に入れます（ほかの Python 環境の依存を壊さないため）。

```bash
# リポジトリの直下で
python3 -m venv compare/.venv
compare/.venv/bin/pip install -r compare/requirements.txt
```

## 2つのペインで、同時に走らせて比べる

```bash
MLFLOW=1 bash compare/live-compare.sh     # MLflow に残さないなら MLFLOW=1 を外す
```

`../dashboard-live/with`（地図とツールあり）と `../dashboard-live/without`（地図とツールなし）ができます。表示されたコマンドを、左右のペインで実行します。

```bash
# 左：地図とツールあり
cd ../dashboard-live/with && claude --model opus "$(cat ../prompt.txt)"
# 右：地図とツールなし
cd ../dashboard-live/without && claude --model opus "$(cat ../prompt-without.txt)"
```

- 各ペインの下に「条件 │ ツール N回 │ $費用 │ 経過時間 │ モデル」が出続けます。ツールの回数はツールを呼ぶ直前の hook（PreToolUse）で数え、費用は Claude Code がステータスラインに渡す見積もり（定価での計算で、請求額とは違うことがあります）です。
- 編集と Bash は、あらかじめ許可してあります（承認待ちで止まらないように）。作業用コピーの外は触らないので、気になる場合は `.claude/settings.local.json` の `permissions` を外してください。
- 初めてのフォルダでは「このフォルダを信頼するか」を聞かれます。作り直しても同じ場所なので、答えは残ります。
- 作業用コピーは、このリポジトリの隣にできます。エージェントが隣のこのリポジトリ（`compare/` に再現の手順がある）を読まないようにしたいときは、`DASHBOARD_LIVE_DIR=~/somewhere/dashboard-live` のように、離れた場所を指定してください。

エージェントから質問が来たら、両方に同じ答えを貼ります。報告者の答えは `../dashboard-live/answers.txt`（元は [`prompts/answers.txt`](prompts/answers.txt)）です。

終わったら、両方の結果を表にします。

```bash
bash compare/live-compare.sh summary
```

| 列 | 中身 |
|---|---|
| `tool_calls` | ツールを呼んだ回数 |
| `cost_usd` | 費用の見積もり |
| `seconds` | かかった時間 |
| `fixed` | 直ったか。エージェントの報告ではなく、このスクリプトが同じ操作で確かめる（pass / fail / blocked） |
| `top_tools` | よく使ったツール |

もう一度やるときは、`bash compare/live-compare.sh` で作り直します（前の `../dashboard-live` は消えます）。

## 何回か流して、比べる

1回だけの結果は、逆になることもあります。`compare.sh` は、ライブと同じ依頼を `claude -p` で条件ごとに何回か流します。

```bash
MLFLOW=1 bash compare/compare.sh 5 opus   # 5回ずつ。結果は ../dashboard-compare/
bash compare/compare.sh summary           # 流さずに、今までの結果を表にする
```

1回は、ライブと同じく2つに分けて流します。

1. ライブの依頼文（[`prompts/request.txt`](prompts/request.txt)）を渡す。エージェントは質問を返して止まる
2. `claude -p --resume` で、報告者の答え（[`prompts/answers.txt`](prompts/answers.txt)）を渡す

終わると、条件ごとの表（`../dashboard-compare/summary.md`）が出ます。yes/no の項目は「何回中何回」、数の項目は「中央値（最小〜最大）」です。

| 項目 | 何を見るか |
|---|---|
| 直ったか | スクリプトが、前の顧客の応答を遅らせて「次の顧客」を押し、正しい顧客の注文が出るかを確かめる |
| 先に聞き返した | 1回目（質問を返す回）で、src を直していないか |
| 直す前に、アプリを動かして再現した／通信を遅らせた | 最初に src を直す前に、アプリやブラウザを動かすコマンドがあるか。遅延を入れたか |
| 画面に見える値で判定した／React の内部の値を読んだ | 画面の文字（CLI の `state`、DOM の文字）を見たか。React の内部（`__reactFiber` など）を読んだか |
| 同じ手順を何回も流した | 繰り返しの書き方（`for`・`seq` など）があるか、5回以上動かしたか |
| 直した後に、アプリを動かして確かめた／ほかの経路も確かめた | 最後に src を直した後に、アプリを動かしたか。「前の顧客」も試したか |
| 報告に、確かめていないことを書いた | 最後の報告に「未確認」などがあるか |
| 証拠の画像を、作業コピーの中に残した／Feature Map を直した | 作業コピーに画像があるか。Feature Map のファイルを変えたか |
| ツール呼び出し・費用・時間 | 2回分を足したもの |

「どう確かめたか」の項目は、記録に残ったコマンドと、エージェントが書いたファイルの言葉から数えた近似です。表を使う前に、各回の最後の報告（`../dashboard-compare/*.turn1.report.md`）と記録（`*.jsonl`）を何件か読んで、判定が合っているかを確かめてください。1回ごとの値は `results.jsonl` にあります。

## MLflow で、あとから比べる

`MLFLOW=1` を付けると、どちらのスクリプトも、条件ごとの実験に会話を記録します。

- Claude Code の MLflow プラグインは、トレースを HTTP でサーバーに送ります（`sqlite:///` のようなファイルには送れません）。そのため、スクリプトが手元に MLflow のサーバー（http://127.0.0.1:5055、DB は `../dashboard-mlflow/mlflow.db`）を起動し、終わった後も動かしたままにします。ポートは `MLFLOW_PORT` で変えられます。
- プラグインは、`mlflow autolog claude` が作業用コピーごとに入れます（`.claude/settings.local.json`）。
- トレースは、Claude Code が応答を終えるたびに送られます。

| 実験 | 中身 |
|---|---|
| `dashboard-live-with` / `dashboard-live-without` | live-compare.sh の記録 |
| `dashboard-compare-with` / `dashboard-compare-without` | compare.sh の記録 |

```bash
open http://127.0.0.1:5055                                                  # 画面で、会話の中身を見比べる
compare/.venv/bin/python compare/mlflow-compare.py                          # 実験ごとの表
compare/.venv/bin/python compare/mlflow-compare.py --prefix dashboard-live-
kill "$(cat ../dashboard-mlflow/server.pid)"                                # サーバーを止める
```

表の列は、トレース数・セッション数・ツール呼び出し（TOOL の span の数）・入力と出力のトークン・費用（MLflow が計算できたときだけ）・多いツールです。

## 入っているもの

| ファイル | 内容 |
|---|---|
| `live-compare.sh` | 2つのペインで比べるための作業用コピーを作る。`summary` で表にする |
| `compare.sh` | `claude -p` で何回か流して、直ったかと、どう確かめたかを条件ごとに数える |
| `prompts/` | 依頼文と、報告者の答え（compare.sh と live-compare.sh で共有） |
| `mlflow-compare.py` | MLflow の記録を、実験ごとに数えて表にする |
| `live/` | 作業用コピーに入れる、ステータスラインと hook |
| `lib/` | 作業用コピーの作り方、直ったかの確かめ方、MLflow のサーバーの起動、記録の数え方（analyze.py）と表の作り方（summarize.py） |
| `requirements.txt` | MLflow の版 |
