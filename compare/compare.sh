#!/usr/bin/env bash
# 地図とツール（skill「verify-dashboard」）がある場合と無い場合で、講義のライブと同じ依頼を claude -p で何回か流し、
# 直ったかに加えて、どう確かめたか（再現したか・何で判定したか・直した後に確かめたか・証拠を残したか など）と、
# ツール呼び出しの数・費用・時間を、条件ごとにまとめる。
#
#   bash compare/compare.sh [回数=3] [モデル=opus]      # 流す。結果は ../dashboard-compare/ に
#   bash compare/compare.sh summary                     # 流さずに、今までの結果を表にする
#   MLFLOW=1 bash compare/compare.sh 3 opus             # 会話を MLflow にも記録する（実験 dashboard-compare-with / -without）
#                                                       # 手元に MLflow のサーバー（http://127.0.0.1:5055）を起動し、終わった後も動かしたままにする
#
# 1回は、ライブと同じく2つに分けて流す。
#   1回目：compare/prompts/request.txt（ライブの依頼文）を渡す。エージェントは質問を返して止まる
#   2回目：claude -p --resume で、compare/prompts/answers.txt（報告者の答え）を渡す
# 「直ったか」は、エージェントの報告ではなく、スクリプトが同じ操作で確かめる（lib/check-fix.sh）。
# 「どう確かめたか」は、記録に残ったコマンドと、エージェントが書いたファイルの言葉から数える近似（lib/analyze.py）。
# 表に載せる前に、各回の最後の報告（*.report.md）を何件か読んで、判定が合っているかを確かめる。
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"; PARENT="$(cd "$SRC/.." && pwd)"
OUT="${DASHBOARD_COMPARE_DIR:-$PARENT/dashboard-compare}"; mkdir -p "$OUT"
MLFLOW_DB="$PARENT/dashboard-mlflow/mlflow.db"   # live-compare.sh と同じ DB
RESULTS="$OUT/results.jsonl"

if [ "${1:-}" = summary ]; then python3 "$SRC/compare/lib/summarize.py" "$RESULTS"; exit 0; fi
RUNS="${1:-3}"; MODEL="${2:-opus}"
source "$SRC/compare/lib/make-copy.sh"
source "$SRC/compare/lib/check-fix.sh"
source "$SRC/compare/lib/mlflow-server.sh"
MLFLOW_URI=""; if [ "${MLFLOW:-0}" = 1 ]; then ensure_mlflow_server "$MLFLOW_DB"; fi
TOOLS="Bash,Read,Edit,Write,Glob,Grep,Skill"

# 作業用コピーの中で動いているプロセス（エージェントが起動した開発サーバーなど）を止める
stop_in_dir() {
  local dir="$1" pid cwd
  command -v lsof >/dev/null || return 0
  lsof -nP -d cwd -Fpn 2>/dev/null | while read -r line; do
    case "$line" in p*) pid="${line#p}";; n*) cwd="${line#n}"; case "$cwd" in "$dir"|"$dir"/*) kill "$pid" 2>/dev/null || true;; esac;; esac
  done || true
}

run_claude() {  # $1=作業用コピー $2=記録の置き場所 $3=プロンプト [$4=再開するセッション]
  local dir="$1" log="$2" prompt="$3" resume="${4:-}"
  ( cd "$dir" && claude -p "$prompt" ${resume:+--resume "$resume"} --model "$MODEL" --permission-mode acceptEdits \
      --allowedTools "$TOOLS" --output-format stream-json --verbose > "$log" ) || true
}

for n in $(seq 1 "$RUNS"); do
  for cond in with without; do
    id="$cond-$(date +%Y%m%d-%H%M%S)"; dir="$OUT/$id"
    make_copy "$dir" "$cond" "$MLFLOW_URI" "dashboard-compare-$cond"
    request="$(cat "$SRC/compare/prompts/request.txt")"
    [ "$cond" = without ] && request="${request//verify-dashboard で再現してから/再現してから}"
    run_claude "$dir" "$OUT/$id.turn1.jsonl" "$request"
    session="$(jq -r 'select(.type=="result") | .session_id' "$OUT/$id.turn1.jsonl" 2>/dev/null | tail -1)"
    if [ -n "$session" ] && [ "$session" != null ]; then
      run_claude "$dir" "$OUT/$id.turn2.jsonl" "$(cat "$SRC/compare/prompts/answers.txt")" "$session"
    fi
    stop_in_dir "$dir"
    fixed="$(check_fix "$dir")"
    python3 "$SRC/compare/lib/analyze.py" "$dir" "$OUT/$id.turn1.jsonl" "$OUT/$id.turn2.jsonl" \
      | jq -c --arg c "$cond" --arg id "$id" --arg f "$fixed" --arg m "$MODEL" '{condition: $c, id: $id, model: $m, fixed: $f} + .' >> "$RESULTS"
    stop_in_dir "$dir"
    tail -1 "$RESULTS" | jq -r '"\(.condition)  直ったか:\(.fixed)  再現:\(.reproduced_before_fix)  直した後に確かめた:\(.verified_after_fix)  ツール:\(.tool_calls)  $\(.cost_usd)  \(.seconds)秒"'
  done
done
python3 "$SRC/compare/lib/summarize.py" "$RESULTS"
echo "各回の最後の報告：$OUT/*.turn1.report.md"
[ -n "$MLFLOW_URI" ] && echo "会話の中身：${MLFLOW_URI}（実験 dashboard-compare-with / dashboard-compare-without）。サーバーを止めるときは kill $(cat "$(dirname "$MLFLOW_DB")/server.pid")"
