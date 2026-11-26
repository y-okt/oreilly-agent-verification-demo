# 売上ダッシュボード

ダッシュボード（注文の一覧・集計・月別グラフ）、顧客ごとの画面、設定の3つの画面がある、React + Vite + TypeScript のアプリ。パッケージ管理は pnpm。

## コマンド

| 目的 | コマンド |
|---|---|
| 型の検査 | `pnpm typecheck` |
| ビルド | `pnpm build` |
| 画面を動かして確かめる | skill「verify-dashboard」：`skills/verify-dashboard/SKILL.md` を読んでから使う |

## 画面の機能

機能の一覧と、それぞれへの行き方は `skills/verify-dashboard/references/features/README.md`（Feature Map）にある。不具合の報告を受けたら、まずここで、どの機能の話かを決める。

## 決まり

- 画面の変更は、verify-dashboard で、利用者と同じ操作で動かして確かめる。直す前と直した後の状態とスクリーンショットを、報告に付ける。
- 機能を足したり、操作の手順を変えたりしたら、Feature Map も同じ変更で直す。
- 依存を足すときは `pnpm add` を使う。`pnpm-workspace.yaml` の `minimumReleaseAge`（公開から7日）は外さない。
