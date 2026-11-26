"""1回分の記録（claude -p の stream-json）と作業用コピーから、確かめ方を数えて1行の JSON にする。

  python3 compare/lib/analyze.py <作業用コピー> <記録.jsonl>...   →  標準出力に JSON、最後の報告は <記録の1つ目>.report.md

数え方は、記録に残ったコマンドと、エージェントが書いたファイルの中身の言葉を手がかりにした近似。
表に載せる前に、report.md と記録を何件か読んで、判定が合っているかを確かめる。
"""
import json
import re
import subprocess
import sys
from pathlib import Path

copy = Path(sys.argv[1])
logs = [Path(p) for p in sys.argv[2:]]

# アプリやブラウザを動かしたとみなす手がかり
DRIVE = re.compile(r"control-dashboard\.mjs|playwright|chromium|puppeteer|connectOverCDP")
SLOW = re.compile(r"control-dashboard\.mjs\S*\s+delay\b|\.route\(|setTimeout\(\s*r|waitForTimeout|route\.fulfill|route\.continue")
INTERNAL = re.compile(r"__reactFiber|__reactProps|memoizedState|_reactInternals|__REACT_DEVTOOLS|fiber\.return")
VISIBLE = re.compile(r"control-dashboard\.mjs\S*\s+(state|idle|customer|next|prev)\b|textContent|innerText|getByText|getByTestId|toHaveText|locator\(")
OTHER_PATH = re.compile(r"control-dashboard\.mjs\S*\s+prev\b|前の顧客")
LOOP = re.compile(r"\bfor\b.*\b(in|of)\b|\bseq\s+\d|\{1\.\.\d+\}|while\b|repeat|Array\.from\(\{\s*length")
UNVERIFIED = re.compile(r"未確認|確かめていない|確認していない|試していない|検証していない")

events = []  # (種類, 中身) を起きた順に
result_texts, tools, turns, cost, ms = [], 0, 0, 0.0, 0
written = {}  # エージェントが書いたファイル名 → 中身
for k, log in enumerate(logs):
    if not log.exists():
        continue
    for line in log.read_text(encoding="utf-8").splitlines():
        try:
            m = json.loads(line)
        except ValueError:
            continue
        if m.get("type") == "assistant":
            for c in m.get("message", {}).get("content", []):
                if c.get("type") != "tool_use":
                    continue
                tools += 1
                name, inp = c.get("name"), c.get("input", {})
                if name in ("Write", "Edit", "MultiEdit"):
                    path = inp.get("file_path", "")
                    body = inp.get("content") or inp.get("new_string") or json.dumps(inp.get("edits", ""), ensure_ascii=False)
                    written[Path(path).name] = written.get(Path(path).name, "") + body
                    events.append(("edit", path, body, k))
                elif name == "Bash":
                    cmd = inp.get("command", "")
                    for target in re.findall(r"cat\s*>+\s*['\"]?([^\s'\"<>]+)['\"]?\s*<<", cmd):  # ヒアドキュメントで書いたスクリプト
                        written[Path(target).name] = written.get(Path(target).name, "") + cmd
                    for src_, dst in re.findall(r"\bcp\s+(\S+)\s+(\S+)", cmd):  # 書いたスクリプトを別の名前で写したとき
                        if Path(src_).name in written:
                            written[Path(dst).name] = written.get(Path(dst).name, "") + written[Path(src_).name]
                    events.append(("bash", cmd, "", k))
                elif name == "Skill":
                    events.append(("skill", json.dumps(inp, ensure_ascii=False), "", k))
        if m.get("type") == "result":
            turns += m.get("num_turns") or 0
            cost += m.get("total_cost_usd") or 0
            ms += m.get("duration_ms") or 0
            result_texts.append(m.get("result") or "")


def expand(cmd: str) -> str:
    """コマンドに、そのコマンドが実行したスクリプト（エージェントが書いたもの）の中身を足す。
    C=skills/.../control-dashboard.mjs のように変数に入れて呼んだ形（node $C state）も、CLI の呼び出しとして読む。"""
    if "control-dashboard.mjs" in cmd:
        cmd = re.sub(r'"?\$\{?C\}?"?(?=\s)', "control-dashboard.mjs", cmd)
    extra = [body for fname, body in written.items() if fname and fname in cmd]
    return cmd + "\n" + "\n".join(extra)


def is_src_edit(e) -> bool:
    return e[0] == "edit" and "/src/" in e[1] and "/node_modules/" not in e[1]


src_edits = [i for i, e in enumerate(events) if is_src_edit(e)]
first_fix = src_edits[0] if src_edits else len(events)
last_fix = src_edits[-1] if src_edits else len(events)
drives = [(i, expand(e[1])) for i, e in enumerate(events) if e[0] == "bash" and DRIVE.search(expand(e[1]))]
before = [t for i, t in drives if i < first_fix]
after = [t for i, t in drives if i > last_fix]
all_drive_text = "\n".join(t for _, t in drives)


def git(*args: str) -> str:
    return subprocess.run(["git", "-C", str(copy), *args], capture_output=True, text=True).stdout


changed = (git("diff", "--name-only") + git("ls-files", "--others", "--exclude-standard")).split()
pngs = [p for p in copy.rglob("*.png") if not {"node_modules", ".git", "reports"} & set(p.relative_to(copy).parts)]
# 2回に分けて流したとき、1回目（質問を返す回）で src を直していなければ、先に聞き返したとみなす
asked_first = len(logs) > 1 and not any(is_src_edit(e) for e in events if e[3] == 0)
report = result_texts[-1] if result_texts else ""
logs[0].with_suffix(".report.md").write_text(report, encoding="utf-8")
print(json.dumps({
    "asked_first": asked_first, "tool_calls": tools, "turns": turns, "cost_usd": round(cost, 4), "seconds": round(ms / 1000),
    "fixed_src": bool(src_edits),
    "reproduced_before_fix": bool(before),
    "slowed_network": bool(SLOW.search("\n".join(before))),
    "judged_by_internal_state": bool(INTERNAL.search(all_drive_text)),
    "judged_by_visible_screen": bool(VISIBLE.search(all_drive_text)),
    "runs_before": len(before), "runs_after": len(after),
    "repeated": bool(LOOP.search("\n".join(before + after))) or len(before) >= 5 or len(after) >= 5,
    "verified_after_fix": bool(after),
    "checked_other_path": bool(OTHER_PATH.search("\n".join(after))),
    "noted_unverified": bool(UNVERIFIED.search(report)),
    "evidence_in_repo": len(pngs),
    "map_updated": any("references/features" in p for p in changed),
}, ensure_ascii=False))
