---
name: verify-dashboard
description: 売上ダッシュボードを、利用者と同じ操作でブラウザから動かし、画面の状態と証拠を集める。不具合の報告を再現するとき、UI を変えた後に動作を確かめるとき、「動作を確かめて」「再現して」と頼まれたときに使う。
---

# verify-dashboard

売上ダッシュボードを起動して、利用者と同じ操作で動かし、画面の状態（JSON）とスクリーンショットを証拠として残す。

ツールは `control-dashboard.mjs`（この skill と同じフォルダ）。リポジトリの直下で実行する。以下では `C=skills/verify-dashboard/control-dashboard.mjs` と置く。出力はすべて JSON。失敗したときは `reason` と、次にすることを書いた `next` が返る。

## 1. どの機能の話かを決める

`references/features/README.md`（Feature Map）を読む。報告の言葉（「上の数字」「グラフ」など）から機能を決め、その機能のファイルを読む。機能のファイルには、利用者がどこからその機能に触れるか（入口）と、操作のしかたと、落とし穴がある。

## 2. 起動して、確かめる

```bash
node $C launch     # ビルドし、アプリとヘッドレスのブラウザを起動する。ブラウザは、コマンドをまたいで同じ画面と設定を保つ
node $C doctor     # 操作してよい状態か
```

`doctor` が `ok: false` なら操作しない。`next` に従う（ソースが変わっていれば `rebuild`、それ以外は `cleanup` → `launch`）。

## 3. 操作して、状態を読む

```bash
node $C open settings            # メニューから移動する（dashboard|settings）
node $C unit 万円                # 設定の画面で、表示単位を選ぶ
node $C search モニター          # ダッシュボードの検索欄に入れて、落ち着くまで待つ
node $C region 関東              # 地域を選ぶ
node $C customer "久保 達也"     # 注文一覧の顧客名を押して、顧客の画面を開く
node $C next                     # 顧客の画面で「次の顧客」を押す（prev で前へ）
node $C delay <URL の一部> <ミリ秒>  # その文字を URL に含むリクエストへの応答を遅らせる（delay list／delay clear）
node $C idle                     # リクエストがすべて返り、画面が落ち着くまで待ってから state を返す
node $C help open                # ヘルプを開く（help close で閉じる）
node $C state                    # 今の画面（page と、その画面の値）
node $C screenshot --part cards  # page|filters|cards|chart|table|help|customer|settings
node $C snapshot --part help     # ARIA のツリー
node $C reload                   # 再読み込み（保存された設定は残る）
node $C reset                    # 保存された設定を消して、最初の画面へ（delay は残る）
```

- 操作は利用者の経路で行う。内部の関数や、テスト用の入口を呼ばない。
- 判定は `state` の値で行う。画像は人に見せる証拠。何が見えれば正しいかは、Feature Map の各ファイルの「確かめ方」にある。
- 待つときは `idle` を使う。決まった秒数の `sleep` で待たない。
- 前提がそろわず確かめられないときは、確かめ方を緩めて通さない。「確かめられなかった」として理由を返し、その機能のファイルの Gotchas に書く。

### 毎回は起きない不具合

- 同じ手順を何回か（たとえば10回）流し、合否の件数で返す。1回通っただけで「再現しない」「直った」と言わない。
- 手元で再現しないときは、報告の条件と手元の条件の違い（操作の順番と速さ、保存された設定、通信の速さ など）を挙げ、条件をそろえてから試す。
- 直した後も、直す前と同じ条件と回数で流して、件数を並べる。

## 4. 直したら

```bash
node $C rebuild                  # ソースを変えたら、必ず。古い画面のまま確かめない
```

`rebuild` は画面を読み込み直す。直す前と同じ操作を、最初からもう一度実行して、`state` とスクリーンショットを直す前と並べる。

## 5. 報告する

- 実行したコマンドと、直す前と直した後の `state` の該当部分を貼る。スクリーンショットのファイル名も書く。
- 確かめていない入口や操作は「未確認」と書く。別の経路で確かめたことにしない。
- 機能や操作の手順が変わったら、`references/features/` の該当ファイルも直し、`pnpm check:feature-map` を通す。

## 6. 片付ける

```bash
node $C cleanup                  # このツールが起動したプロセスだけを止める。evidence/ は残す
```

使い方の一覧は `node $C --help`、各コマンドは `node $C <command> --help`。
