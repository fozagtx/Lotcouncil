"""Generate docs/walkthrough.md from real calls against the hosted Lotcouncil Space.

Runs the research task end to end: list the markets, judge the idea, judge one
disclosed longer-history variant, then reproduce the ruling locally with the CLI
and an audit file. Every number in the written document comes from this run.

    .venv/bin/python docs/walkthrough.py
"""

from __future__ import annotations

import asyncio
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from mcp import ClientSession
from mcp.client.sse import sse_client

REPO = Path(__file__).resolve().parent.parent
MCP_URL = "https://pima5-lotcouncil.hf.space/gradio_api/mcp/sse"
SPACE_URL = "https://huggingface.co/spaces/pima5/lotcouncil"
AUDIT_PATH = REPO / "docs" / "walkthrough-audit.json"

QUESTION = (
    "A trader wants to buy Tesla (rTSLAUSDT) whenever it drops 2% below its "
    "24-hour average and sell when it recovers or after 12 hours. "
    "Is that edge or luck?"
)
IDEA = "buy Tesla when it drops 2% below its 24 hour average, sell when it recovers or after 12 hours"


async def remote_calls() -> dict:
    out = {"utc": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")}
    async with sse_client(MCP_URL) as (r, w):
        async with ClientSession(r, w) as s:
            await s.initialize()

            t0 = time.time()
            res = await s.call_tool("lotcouncil_list_markets", {})
            out["markets"] = eval(res.content[0].text)
            out["markets_secs"] = round(time.time() - t0, 2)

            t0 = time.time()
            res = await s.call_tool("lotcouncil_judge_strategy", {
                "idea": IDEA, "symbol": "rTSLAUSDT", "days": 90, "fee_pct": 0.1,
            })
            out["judge90_secs"] = round(time.time() - t0, 2)
            out["judge90"] = eval(res.content[0].text)

            t0 = time.time()
            res = await s.call_tool("lotcouncil_judge_strategy", {
                "idea": IDEA, "symbol": "rTSLAUSDT", "days": 180, "fee_pct": 0.1,
            })
            out["judge180_secs"] = round(time.time() - t0, 2)
            out["judge180"] = eval(res.content[0].text)
    return out


def cli_reproduce(j90: dict) -> dict:
    py = str(REPO / ".venv" / "bin" / "python")
    cmd = [
        py, "-m", "lotcouncil", "judge", IDEA,
        "--symbol", "rTSLAUSDT", "--days", "90", "--fee", "0.1",
        "--json", "--audit", str(AUDIT_PATH),
    ]
    t0 = time.time()
    proc = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True)
    judge_secs = round(time.time() - t0, 2)
    proc2 = subprocess.run(
        [py, "-m", "lotcouncil", "rerun", str(AUDIT_PATH)],
        cwd=REPO, capture_output=True, text=True)
    return {
        "cmd": " ".join(cmd),
        "judge_stdout": proc.stdout, "judge_secs": judge_secs, "judge_rc": proc.returncode,
        "rerun_cmd": " ".join(proc2.args),
        "rerun_stdout": proc2.stdout, "rerun_rc": proc2.returncode,
        "audit_bytes": AUDIT_PATH.stat().st_size if AUDIT_PATH.exists() else 0,
    }


def test_lines(d: dict) -> str:
    lines = []
    for k, t in d.get("tests", {}).items():
        mark = "pass" if t.get("passed") else "FAIL"
        lines.append(f"- {k}. {t['name']}: {mark}. {t['sentence']}")
    return "\n".join(lines)


def render(o: dict, cli: dict, audit_committed: bool) -> str:
    m = o["markets"]
    j90, j180 = o["judge90"], o["judge180"]
    mkt = j90.get("market", {})
    md = f"""# Research task walkthrough

What this proves: a trading question goes in, a ruling comes out, a human decides.
Nothing is traded and nothing is recommended.

- Generated: {o['utc']}
- Space: {SPACE_URL}
- MCP endpoint: {MCP_URL}
- `list_markets` answered in {o['markets_secs']}s: {len(m['tokens'])} tokens,
  windows {m['windows_days']}, fees {m['fees_pct']}.

## 1. The question

The user is a retail swing trader checking an idea before placing it:

> {QUESTION}

## 2. Ask the court

```json
{{
  "tool": "lotcouncil_judge_strategy",
  "arguments": {{
    "idea": "{IDEA}",
    "symbol": "rTSLAUSDT",
    "days": 90,
    "fee_pct": 0.1
  }}
}}
```

Answered in {o['judge90_secs']}s:

```json
{json.dumps(j90, indent=2)}
```

Reading: the court read the idea as `{json.dumps(j90.get('rule'))}` ("{j90.get('rule_text')}").
It ran on {mkt.get('candles')} hourly candles from {mkt.get('source')} ({mkt.get('source_note')}).
The gate and tests:

{test_lines(j90)}

Verdict: **{j90.get('verdict')}** - "{j90.get('headline')}".

## 3. Follow-up with more history

Same rule, one disclosed variant: `days: 180` instead of 90. This is more history
to check whether the answer is stable, not a search through parameters.

```json
{{
  "tool": "lotcouncil_judge_strategy",
  "arguments": {{
    "idea": "{IDEA}",
    "symbol": "rTSLAUSDT",
    "days": 180,
    "fee_pct": 0.1
  }}
}}
```

Answered in {o['judge180_secs']}s:

```json
{json.dumps(j180, indent=2)}
```

Reading: on the longer window the verdict is {j180.get('verdict')} with
{j180.get('trades')} trades. One disclosed variant, reported in full.

## 4. Reproduce it yourself

The CLI runs the same engine. The exact rule from step 2:

```
{cli['cmd']}
```

Exit {cli['judge_rc']} in {cli['judge_secs']}s. Re-check the audit file:

```
{cli['rerun_cmd']}
```

```
{cli['rerun_stdout'].rstrip()}
```

Audit file: `docs/walkthrough-audit.json` ({cli['audit_bytes']} bytes{", committed with this document" if audit_committed else ""}).

## 5. Actionable insight

{j90.get('explanation') or j90.get('headline')}

PASS means not obviously luck on this history, not a prediction; a FAIL means the
court found no evidence the idea is better than chance here.

## Appendix: how it was generated

`python docs/walkthrough.py` with the repo `.venv`, using `mcp.client.sse` +
`ClientSession` against {MCP_URL}. Remote calls were `lotcouncil_list_markets`
and `lotcouncil_judge_strategy`; the local run used `python -m lotcouncil judge`
and `rerun`.
"""
    return md


async def main() -> int:
    o = await remote_calls()
    cli = cli_reproduce(o["judge90"])
    audit_committed = 0 < cli["audit_bytes"] < 2_000_000
    md = render(o, cli, audit_committed)
    (REPO / "docs" / "walkthrough.md").write_text(md)
    print(json.dumps({
        "judge90": {k: o["judge90"].get(k) for k in ("ok", "verdict", "headline", "trades")},
        "judge180": {k: o["judge180"].get(k) for k in ("ok", "verdict", "headline", "trades")},
        "rerun": cli["rerun_stdout"].strip(),
        "audit_bytes": cli["audit_bytes"], "audit_committed": audit_committed,
    }, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
