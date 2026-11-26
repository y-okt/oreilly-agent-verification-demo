# 直ったかどうかを、エージェントの報告ではなく、同じ操作で確かめる。source して使う。
#   check_fix <作業用コピー>   →  pass / fail / blocked を出す
# ツールは元のリポジトリのものを使う（地図とツールが無いコピーでも同じ確かめ方にするため）。
check_fix() {
  local dir="$1" port=$((4400 + RANDOM % 400))
  local cli; cli="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/skills/verify-dashboard/control-dashboard.mjs"
  ( cd "$dir" && export DASHBOARD_PORT=$port DASHBOARD_CDP_PORT=$((port + 1000))
    node "$cli" cleanup >/dev/null 2>&1; rm -rf .verify-dashboard   # エージェントが残したインスタンスを止める
    node "$cli" launch >/dev/null 2>&1 || { echo blocked; node "$cli" cleanup >/dev/null 2>&1; exit 0; }
    node "$cli" delay "/api/customers/久保 達也" 3000 >/dev/null
    node "$cli" customer "久保 達也" >/dev/null; node "$cli" next >/dev/null
    local state; state="$(node "$cli" idle)"   # 遅らせた応答が返り、画面が落ち着くまで待つ
    if grep -q '"name": "久保田 弘"' <<<"$state" && grep -q '"ORD-0061"' <<<"$state"; then echo pass; else echo fail; fi
    node "$cli" cleanup >/dev/null 2>&1; rm -rf .verify-dashboard evidence dist )
}
