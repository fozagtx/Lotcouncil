"""Download Bitget hourly candles and save them as backup files the app can fall back on.

Run this from a machine that can reach api.bitget.com (step 1 of the build order):

    python scripts/fetch_candles.py                    # every token in COURT_TOKENS / the default list
    python scripts/fetch_candles.py rAAPLUSDT rTSLAUSDT --days 180
    python scripts/fetch_candles.py --list             # print Bitget symbols that look like stock tokens

It prints how much history each token has (an open question in the PRD) and
writes data/snapshots/<SYMBOL>.csv.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd  # noqa: E402
import requests  # noqa: E402

from lotcouncil.data import BITGET_BASE, MAX_DAYS, DataError, fetch_bitget, save_snapshot, token_list  # noqa: E402


def list_stock_tokens() -> int:
    resp = requests.get(BITGET_BASE + "/api/v2/spot/public/symbols", timeout=15)
    body = resp.json()
    if str(body.get("code")) != "00000":
        print(f"Bitget refused: {body.get('msg')}", file=sys.stderr)
        return 1
    rows = body.get("data") or []
    hits = [r for r in rows if str(r.get("symbol", "")).startswith("r") and str(r.get("symbol", "")).endswith("USDT")]
    hits += [r for r in rows if str(r.get("isReality", "")).lower() == "yes" and r not in hits]
    for r in sorted(hits, key=lambda r: r["symbol"]):
        print(r["symbol"], r.get("status", ""))
    print(f"{len(hits)} symbols", file=sys.stderr)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("symbols", nargs="*")
    ap.add_argument("--days", type=int, default=MAX_DAYS)
    ap.add_argument("--list", action="store_true", help="list stock-token symbols on Bitget")
    args = ap.parse_args()
    if args.list:
        return list_stock_tokens()

    failed = 0
    for symbol in args.symbols or token_list():
        try:
            df = fetch_bitget(symbol, args.days)
        except (DataError, requests.RequestException) as e:
            print(f"{symbol:12s} FAILED: {e}")
            failed += 1
            continue
        first = pd.to_datetime(df["time"].iloc[0], unit="ms", utc=True)
        last = pd.to_datetime(df["time"].iloc[-1], unit="ms", utc=True)
        gaps = int((df["time"].diff() > 3_600_000).sum())
        path = save_snapshot(symbol, df)
        days = (last - first).total_seconds() / 86400
        enough = "ok" if len(df) >= 500 else "UNDER 500 CANDLES"
        print(f"{symbol:12s} {len(df):5d} candles  {first:%Y-%m-%d %H:%M} -> {last:%Y-%m-%d %H:%M} UTC  "
              f"({days:.0f} days, {gaps} gaps)  {enough}  -> {path}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
