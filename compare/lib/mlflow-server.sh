# MLflow のトラッキングサーバーを用意する。source して使う。
#   ensure_mlflow_server <DB のパス>   →  MLFLOW_URI に http://127.0.0.1:<MLFLOW_PORT> が入る
# Claude Code の MLflow プラグインは、トレースを HTTP でサーバーに送る。sqlite:/// などのファイルの URI には送れないので、
# DB を持つサーバーを手元で起動しておく。すでに動いていれば、それを使う。
# ポートは既定で 5055（macOS では 5000 を AirPlay が使うことがあるため）。
# 止めるときは stop_mlflow_server <DB のパス>（または kill "$(cat <DB のフォルダ>/server.pid)"）。
#
# 注意：$( … ) の中で呼ばない。中で起動したサーバーが出力をつかんだままになり、$( … ) が終わらなくなる。
MLFLOW_PORT="${MLFLOW_PORT:-5055}"

ensure_mlflow_server() {
  local db="$1" dir url="http://127.0.0.1:$MLFLOW_PORT"
  dir="$(dirname "$db")"
  local src; src="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  local bin="${MLFLOW_BIN:-$src/compare/.venv/bin/mlflow}"; [ -x "$bin" ] || bin=mlflow
  MLFLOW_URI="$url"
  if curl -sf -m 3 "$url/health" >/dev/null 2>&1; then return 0; fi
  mkdir -p "$dir"
  # トレースの中身（artifacts）は DB と同じフォルダの mlartifacts/ に置く。リポジトリの中に置くと、
  # 作業用コピーに混ざって、エージェントがほかの回の記録を読めてしまうため。
  # exec で入れ替えるので、このシェルの標準入出力はサーバーに残らない。
  ( cd "$dir" && exec nohup "$bin" server --backend-store-uri "sqlite:///$db" \
      --artifacts-destination "$dir/mlartifacts" --host 127.0.0.1 --port "$MLFLOW_PORT" \
      </dev/null >server.log 2>&1 ) &
  echo $! > "$dir/server.pid"
  for _ in $(seq 1 60); do
    if curl -sf -m 3 "$url/health" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo "MLflow のサーバーが60秒で起動しませんでした。$dir/server.log を見てください。" >&2
  return 1
}

stop_mlflow_server() {
  local pidfile; pidfile="$(dirname "$1")/server.pid"
  [ -f "$pidfile" ] && kill "$(cat "$pidfile")" 2>/dev/null; rm -f "$pidfile"
}
