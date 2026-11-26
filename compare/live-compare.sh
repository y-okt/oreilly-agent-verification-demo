#!/usr/bin/env bash
# 講義中に、地図とツール（skill「verify-dashboard」）がある場合と無い場合を、2つのペインで同時に走らせて比べる。
# 各ペインの Claude Code の下に「条件 │ ツール N回 │ $費用 │ 経過時間 │ モデル」が出続ける。
#
#   bash compare/live-compare.sh          # 作業用コピーを2つ作る（../dashboard-live/with と without）
#   MLFLOW=1 bash compare/live-compare.sh # 同じく。会話を MLflow にも記録する（実験 dashboard-live-with / -without）
#   bash compare/live-compare.sh summary  # 両方の、ツール呼び出しの数・費用・時間・直ったかを表にする
#
# ツール呼び出しの数は PreToolUse の hook で数え、費用は Claude Code がステータスラインに渡す見積もり
# （cost.total_cost_usd。定価で計算した値で、請求額とは違うことがある）を使う。
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"; PARENT="$(cd "$SRC/.." && pwd)"
LIVE="${DASHBOARD_LIVE_DIR:-$PARENT/dashboard-live}"   # 置き場所を変えるときは DASHBOARD_LIVE_DIR
MLFLOW_DB="$PARENT/dashboard-mlflow/mlflow.db"   # compare.sh と同じ DB
source "$SRC/compare/lib/make-copy.sh"
source "$SRC/compare/lib/check-fix.sh"
source "$SRC/compare/lib/mlflow-server.sh"

summary() {
  [ -d "$LIVE" ] || { echo "$LIVE がありません。先に bash compare/live-compare.sh を実行してください。" >&2; exit 1; }
  printf 'condition\tsessions\ttool_calls\tcost_usd\tseconds\tfixed\ttop_tools\n'
  for cond in with without; do
    node - "$LIVE/$cond/.claude/live/stats" "$cond" "$(check_fix "$LIVE/$cond")" <<'JS'
const { readdirSync, readFileSync, existsSync } = require('node:fs');
const [dir, cond, fixed] = process.argv.slice(2);
const read = (f) => { try { return JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')); } catch { return {}; } };
const ids = existsSync(dir) ? [...new Set(readdirSync(dir).map((f) => f.split('.')[0]))] : [];
let tools = 0, cost = 0, ms = 0; const by = {};
for (const id of ids) {
  const t = read(`${id}.tools.json`), c = read(`${id}.cost.json`);
  tools += t.tools ?? 0; cost += c.costUsd ?? 0; ms += c.durationMs ?? 0;
  for (const [k, v] of Object.entries(t.byTool ?? {})) by[k] = (by[k] ?? 0) + v;
}
const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k}:${v}`).join(' ');
console.log([cond, ids.length, tools, cost.toFixed(2), Math.round(ms / 1000), fixed, top].join('\t'));
JS
  done
}

if [ "${1:-}" = summary ]; then
  if command -v column >/dev/null; then summary | column -t -s $'\t'; else summary; fi
  # 表の外に出す（column に混ぜると、列の幅がこの行に引っぱられる）
  [ -f "$MLFLOW_DB" ] && echo && echo "会話の中身：http://127.0.0.1:${MLFLOW_PORT:-5055}（動いていなければ compare/.venv/bin/mlflow server --backend-store-uri sqlite:///$MLFLOW_DB --port ${MLFLOW_PORT:-5055}）→ 実験 dashboard-live-with と dashboard-live-without"
  exit 0
fi

# 以前に作ったものだけを消す（目印のファイルがあるときだけ）
if [ -e "$LIVE" ]; then
  [ -f "$LIVE/.live-compare" ] || { echo "$LIVE は、このスクリプトが作ったものではありません。名前を変えるか、中身を確かめてから消してください。" >&2; exit 1; }
  rm -rf "$LIVE"
fi
mkdir -p "$LIVE"; touch "$LIVE/.live-compare"
MLFLOW_URI=""; if [ "${MLFLOW:-0}" = 1 ]; then ensure_mlflow_server "$MLFLOW_DB"; fi

for cond in with without; do
  dir="$LIVE/$cond"
  make_copy "$dir" "$cond" "$MLFLOW_URI" "dashboard-live-$cond"
  mkdir -p "$dir/.claude/live"
  cp "$SRC/compare/live/hook.mjs" "$SRC/compare/live/statusline.mjs" "$dir/.claude/live/"
  if [ "$cond" = with ]; then echo "地図とツールあり" > "$dir/.claude/live/label"; else echo "地図とツールなし" > "$dir/.claude/live/label"; fi
  # ステータスライン・hook・権限を settings.local.json に足す。MLflow のプラグインの設定（enabledPlugins など）が
  # 同じファイルに入っているので、上書きせずに混ぜる
  node - "$dir/.claude/settings.local.json" "$dir/.claude/live" <<'JS'
const fs = require('node:fs');
const [file, live] = process.argv.slice(2);
let cur = {};
try { cur = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
const add = {
  statusLine: { type: 'command', command: `node "${live}/statusline.mjs"`, refreshInterval: 2 },
  hooks: { ...(cur.hooks ?? {}), PreToolUse: [...(cur.hooks?.PreToolUse ?? []), { matcher: '*', hooks: [{ type: 'command', command: `node "${live}/hook.mjs"` }] }] },
  permissions: { ...(cur.permissions ?? {}), defaultMode: 'acceptEdits', allow: [...new Set([...(cur.permissions?.allow ?? []), 'Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep', 'Skill'])] },
};
fs.writeFileSync(file, JSON.stringify({ ...cur, ...add }, null, 2) + '\n');
JS
done

# 依頼文（スライドの依頼1と同じ）と報告者の答え。compare.sh と同じファイルを使う
cp "$SRC/compare/prompts/request.txt" "$LIVE/prompt.txt"
cp "$SRC/compare/prompts/answers.txt" "$LIVE/answers.txt"
sed 's/verify-dashboard で再現してから/再現してから/' "$LIVE/prompt.txt" > "$LIVE/prompt-without.txt"

cat <<MSG
作りました：$LIVE/with（地図とツールあり）と $LIVE/without（地図とツールなし）
${MLFLOW_URI:+MLflow：${MLFLOW_URI}（実験 dashboard-live-with / dashboard-live-without。DB は ${MLFLOW_DB}）}

左のペイン：  cd "$LIVE/with"    && claude --model opus "\$(cat ../prompt.txt)"
右のペイン：  cd "$LIVE/without" && claude --model opus "\$(cat ../prompt-without.txt)"

- 初めてのフォルダでは、Claude Code が「このフォルダを信頼するか」を聞くので、講義の前に一度起動して答えておく。
- 質問が来たら、両方に同じ答えを貼る：$LIVE/answers.txt（compare.sh と同じ答え）
- 終わったら：bash compare/live-compare.sh summary
MSG
