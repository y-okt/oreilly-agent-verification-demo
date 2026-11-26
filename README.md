# 売上ダッシュボード（検証の教材）

ダッシュボード（注文の一覧・集計・月別グラフ）、顧客ごとの画面、設定の3つの画面がある Web アプリです。React + Vite + TypeScript で書いてあります。講義では、利用者からの報告を、エージェントが自分で再現し、直し、証拠を付けて返す流れを見ます。

エージェントに渡すものは2つです。

- **Feature Map**（`skills/verify-dashboard/references/features/`）：画面にある機能と、利用者がそれぞれにどうたどり着くか。
- **操作用の CLI**（`skills/verify-dashboard/control-dashboard.mjs`）：アプリとブラウザを起動し、利用者と同じ操作で動かして、画面の状態を JSON で、証拠をスクリーンショットで返す。

## 必要なもの

- Node.js 22.13 以上
- pnpm 10.26 以上
- Chrome か Chromium（`pnpm exec playwright install chromium` で入る。別の場所のブラウザは `BROWSER_PATH` で指定する）

## 準備と使い方

```sh
pnpm install
mkdir -p .claude/skills && ln -s ../../skills/verify-dashboard .claude/skills/verify-dashboard   # Claude Code の skill として使うとき
C=skills/verify-dashboard/control-dashboard.mjs
node $C --help
node $C launch
node $C search モニター
node $C state
node $C screenshot --part cards
node $C cleanup
```

Feature Map とツールが今のコードと合っているかは、`pnpm check:feature-map` で確かめられます。

## 講義のデモを、手元で比べる

講義では、同じ報告を、地図とツールがある場合と無い場合で Claude Code に渡し、ツール呼び出しの数と費用を比べました。手順は [compare/README.md](compare/README.md) にあります。

## 依存パッケージの決まり

`pnpm-workspace.yaml` の `minimumReleaseAge: 10080` で、公開から7日たっていない版は入りません。講義の前に `pnpm audit` を実行してください（2026-11-26 時点で既知の脆弱性なし）。

## 入っているもの

| 場所 | 内容 |
|---|---|
| `src/` | アプリ本体 |
| `skills/verify-dashboard/` | 検証の skill（SKILL.md・操作用の CLI・Feature Map） |
| `reports/` | 利用者から届いた報告（デモの入力） |
| `AGENTS.md`・`CLAUDE.md` | エージェントが最初に読む、コマンドと決まり |
| `compare/` | 地図とツールがある場合と無い場合を、Claude Code で比べるスクリプト（[compare/README.md](compare/README.md)） |

## ライセンス

MIT（[LICENSE](LICENSE)）
