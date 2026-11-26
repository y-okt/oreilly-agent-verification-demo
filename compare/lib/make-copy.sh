# compare.sh と live-compare.sh が使う、作業用コピーの作り方。source して使う。
#   make_copy <作るディレクトリ> <with|without> [MLflow の tracking URI] [MLflow の実験名]
# with    ：skill「verify-dashboard」（Feature Map と CLI）を .claude/skills に見せる
# without ：skill と、それを案内する README・scripts を消し、AGENTS.md を最小限にする
# compare/（このフォルダ。直ったかの確かめ方が入っている）・講師用の instructor/（あれば）・.git・生成物は、どちらにも入れない。
# エージェントが、確かめ方や履歴を読めないようにするため。
make_copy() {
  local dir="$1" cond="$2" uri="${3:-}" exp="${4:-}"
  local src; src="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  if [ ! -x "$src/node_modules/.bin/vite" ]; then
    echo "$src/node_modules がありません。先にリポジトリの直下で pnpm install を実行してください（作業用コピーは、これを共有して使う）。" >&2
    return 1
  fi
  rm -rf "$dir"; mkdir -p "$dir"
  (cd "$src" && tar -cf - --exclude ./compare --exclude ./instructor --exclude ./node_modules --exclude ./dist --exclude ./.git \
      --exclude ./evidence --exclude ./.verify-dashboard --exclude ./.claude --exclude ./mlartifacts --exclude ./mlruns .) | tar -xf - -C "$dir"
  ln -s "$src/node_modules" "$dir/node_modules"
  if [ "$cond" = with ]; then
    mkdir -p "$dir/.claude/skills" && ln -s ../../skills/verify-dashboard "$dir/.claude/skills/verify-dashboard"
  else
    rm -rf "$dir/skills" "$dir/README.md" "$dir/scripts"
    node -e 'const f=process.argv[1],p=require(f);delete p.scripts["check:feature-map"];require("fs").writeFileSync(f,JSON.stringify(p,null,2)+"\n")' "$dir/package.json"
    printf '# 売上ダッシュボード\n\nReact + Vite + TypeScript のアプリ。パッケージ管理は pnpm。\n\n- 型の検査：`pnpm typecheck`\n- ビルド：`pnpm build`\n- 開発サーバー：`pnpm dev`\n- ブラウザの操作には Playwright（導入済み）が使える。\n' > "$dir/AGENTS.md"
  fi
  (cd "$dir" && git init -q && git add -A && git -c user.name=demo -c user.email=demo@example.com commit -qm start) >/dev/null
  if [ -n "$uri" ]; then  # トレースを MLflow に送る設定（.claude/settings.json と、MLflow の Claude プラグイン）
    local bin="${MLFLOW_BIN:-$src/compare/.venv/bin/mlflow}"; [ -x "$bin" ] || bin=mlflow
    (cd "$dir" && "$bin" autolog claude -u "$uri" -n "$exp" -y </dev/null >/dev/null 2>&1) \
      || { echo "mlflow autolog claude に失敗しました。compare/requirements.txt の版を入れてください。" >&2; return 1; }
  fi
}
