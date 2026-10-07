"""Command line: ``python -m lotcouncil <serve|judge|rerun|mcp>``."""

from __future__ import annotations

import argparse
import json
import os
import sys


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="lotcouncil", description="Put a trading idea on trial.")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("serve", help="run the web app")
    s.add_argument("--host", default="0.0.0.0")
    s.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8000)))

    j = sub.add_parser("judge", help="judge one idea and print the ruling")
    j.add_argument("idea", help='e.g. "buy when the 10 hour average crosses above the 40 hour average"')
    j.add_argument("--symbol", default="rAAPLUSDT")
    j.add_argument("--days", type=int, default=90)
    j.add_argument("--fee", type=float, default=0.1, help="fee per position change, in percent")
    j.add_argument("--json", action="store_true", help="print the full result as JSON")
    j.add_argument("--audit", metavar="FILE", help="also write an audit file")

    r = sub.add_parser("rerun", help="re-run an audit file and check the ruling matches")
    r.add_argument("file")

    sub.add_parser("mcp", help="run the MCP tool server over stdio")

    args = p.parse_args(argv)

    if args.cmd == "serve":
        import uvicorn

        uvicorn.run("lotcouncil.server:app", host=args.host, port=args.port)
        return 0

    if args.cmd == "mcp":
        from .mcp_server import main as mcp_main

        mcp_main()
        return 0

    if args.cmd == "rerun":
        from .audit import rerun_audit
        from .court import CourtError

        with open(args.file, encoding="utf-8") as f:
            audit = json.load(f)
        try:
            res = rerun_audit(audit)
        except CourtError as e:
            print(f"Cannot re-run: {e}", file=sys.stderr)
            return 2
        print(f"Data hash:  {'matches' if res['hash_ok'] else 'DOES NOT MATCH'} ({res['data_hash'][:23]}...)")
        print(f"Verdict:    file {res['verdict_in_file']}, re-run {res['verdict_now']}")
        for d in res["differences"]:
            print(f"  differs: {d}")
        print("Same ruling." if res["same"] else "Different ruling.")
        return 0 if res["same"] else 1

    from .service import CourtService

    svc = CourtService()
    out = svc.judge(symbol=args.symbol, days=args.days, idea=args.idea, fee=args.fee / 100)
    if not out.get("ok"):
        print(out.get("error"), file=sys.stderr)
        return 2
    if args.audit:
        req = out["request"]
        file = svc.audit(
            symbol=req["symbol"], days=req["days"], end_ms=req["end"], rule=req["rule"], fee=req["fee"],
            idea=req["idea"], parsed_by=req["parsed_by"], explanation=out.get("explanation"),
        )
        with open(args.audit, "w", encoding="utf-8") as f:
            json.dump(file, f)
    if args.json:
        print(json.dumps(out, indent=2))
        return 0
    ruling = out["ruling"]
    print(f"{ruling['verdict']}: {ruling['headline']}")
    print(f"Rule: {ruling['rule_text']}")
    print(f"Data: {out['market']['label']} ({out['market']['source']}), {out['market']['candles']} candles")
    print(f"- {ruling['gate']['sentence']}")
    for k, t in ruling["tests"].items():
        print(f"- {k}. {t['name']}: {'pass' if t['passed'] else 'FAIL'}. {t['sentence']}")
    if out.get("explanation"):
        print(f"\n{out['explanation']['text']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
