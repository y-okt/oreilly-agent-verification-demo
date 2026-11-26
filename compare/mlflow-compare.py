"""MLflow に記録した会話（Claude Code のトレース）を、実験ごとに数えて表にする。

  compare/.venv/bin/python compare/mlflow-compare.py              # 既定：../dashboard-mlflow/mlflow.db の dashboard- で始まる実験
  compare/.venv/bin/python compare/mlflow-compare.py --prefix dashboard-live-

実験は、live-compare.sh が dashboard-live-with / dashboard-live-without、
compare.sh が dashboard-compare-with / dashboard-compare-without に分けて作る。
列：トレース数・セッション数・ツール呼び出し（TOOL の span の数）・入力と出力のトークン・費用（MLflow が計算できたときだけ）・多いツール。
細かく見るときは、mlflow server で画面を開き、同じ実験のトレースを見比べる。
"""
import argparse
import collections
import json
from pathlib import Path

import mlflow
from mlflow.tracking import MlflowClient

here = Path(__file__).resolve().parent
default_db = here.parent.parent / "dashboard-mlflow" / "mlflow.db"
parser = argparse.ArgumentParser()
parser.add_argument("--db", default=str(default_db))
parser.add_argument("--prefix", default="dashboard-")
args = parser.parse_args()

mlflow.set_tracking_uri(f"sqlite:///{args.db}")
client = MlflowClient()
experiments = sorted((e for e in client.search_experiments() if e.name.startswith(args.prefix)), key=lambda e: e.name)
if not experiments:
    raise SystemExit(f"{args.db} に、{args.prefix} で始まる実験がありません。")

rows = []
for exp in experiments:
    traces = mlflow.search_traces(locations=[exp.experiment_id], return_type="list", max_results=10000)
    sessions, tools, by_tool = set(), 0, collections.Counter()
    tokens_in = tokens_out = 0
    cost, cost_known = 0.0, False
    for t in traces:
        meta = t.info.trace_metadata or {}
        sessions.add(meta.get("mlflow.trace.session") or t.info.trace_id)
        for span in t.data.spans:
            if str(span.span_type).upper() == "TOOL":
                tools += 1
                by_tool[span.name] += 1
        usage = t.info.token_usage or {}
        tokens_in += usage.get("input_tokens", 0)
        tokens_out += usage.get("output_tokens", 0)
        if (c := t.info.cost) and "total_cost" in c:
            cost += c["total_cost"]
            cost_known = True
    top = " ".join(f"{k}:{v}" for k, v in by_tool.most_common(4))
    rows.append([exp.name, len(traces), len(sessions), tools, tokens_in, tokens_out, f"{cost:.2f}" if cost_known else "-", top])

head = ["experiment", "traces", "sessions", "tool_calls", "input_tokens", "output_tokens", "cost_usd", "top_tools"]
widths = [max(len(str(r[i])) for r in rows + [head]) for i in range(len(head))]
for r in [head] + rows:
    print("  ".join(str(v).ljust(w) for v, w in zip(r, widths)))
