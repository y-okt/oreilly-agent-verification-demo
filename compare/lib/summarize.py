"""compare.sh の結果（results.jsonl）を、条件ごとにまとめて表にする。

  python3 compare/lib/summarize.py <results.jsonl>   →  標準出力と、同じ場所の summary.md に Markdown の表

yes/no の項目は「何回中何回」、数の項目は「中央値（最小〜最大）」で出す。
"""
import json
import statistics
import sys
from pathlib import Path

path = Path(sys.argv[1])
rows = [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]
conds = [c for c in ("with", "without") if any(r["condition"] == c for r in rows)]
label = {"with": "地図とツールあり", "without": "地図とツールなし"}

COUNTS = [  # (項目名, キー, 数え方)
    ("直ったか（スクリプトが同じ操作で確かめた）", "fixed", lambda v: v == "pass"),
    ("先に聞き返した（1回目で src を直していない）", "asked_first", bool),
    ("直す前に、アプリを動かして再現した", "reproduced_before_fix", bool),
    ("再現するとき、通信を遅らせた", "slowed_network", bool),
    ("画面に見える値で判定した", "judged_by_visible_screen", bool),
    ("React の内部の値を読んだ", "judged_by_internal_state", bool),
    ("同じ手順を何回も流した", "repeated", bool),
    ("直した後に、アプリを動かして確かめた", "verified_after_fix", bool),
    ("直した後に、ほかの経路（前の顧客）も確かめた", "checked_other_path", bool),
    ("報告に、確かめていないことを書いた", "noted_unverified", bool),
    ("証拠の画像を、作業コピーの中に残した", "evidence_in_repo", lambda v: v > 0),
    ("Feature Map を直した", "map_updated", bool),
]
NUMS = [
    ("ツール呼び出し", "tool_calls", "{:.0f}"),
    ("費用（USD）", "cost_usd", "{:.2f}"),
    ("時間（秒）", "seconds", "{:.0f}"),
    ("アプリやブラウザを動かしたコマンドの数（直す前）", "runs_before", "{:.0f}"),
    ("アプリやブラウザを動かしたコマンドの数（直した後）", "runs_after", "{:.0f}"),
]

out = ["| 項目 | " + " | ".join(label[c] for c in conds) + " |", "|---|" + "---|" * len(conds)]
for name, key, ok in COUNTS:
    cells = []
    for c in conds:
        rs = [r for r in rows if r["condition"] == c]
        cells.append(f"{sum(1 for r in rs if ok(r.get(key)))}/{len(rs)}")
    out.append(f"| {name} | " + " | ".join(cells) + " |")
for name, key, fmt in NUMS:
    cells = []
    for c in conds:
        vs = [r[key] for r in rows if r["condition"] == c and isinstance(r.get(key), (int, float))]
        cells.append(f"{fmt.format(statistics.median(vs))}（{fmt.format(min(vs))}〜{fmt.format(max(vs))}）" if vs else "-")
    out.append(f"| {name}（中央値・最小〜最大） | " + " | ".join(cells) + " |")
text = "\n".join(out) + "\n"
(path.parent / "summary.md").write_text(text, encoding="utf-8")
print(text)
