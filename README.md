---
title: Lotcouncil
emoji: ⚖️
colorFrom: gray
colorTo: red
sdk: gradio
sdk_version: 6.29.0
app_file: app.py
pinned: false
---

# Lotcouncil — put a trading idea on trial

Before an AI agent trades, its idea faces a court. Lotcouncil is an MCP server that
translates a plain-English idea into one of three deterministic rules, runs fixed tests
on real hourly Bitget tokenized-stock prices, and returns PASS or FAIL. The verdict
always comes from fixed code, never from a model — PASS means "not obviously luck on
this history", not a prediction. It never places trades.

## MCP tools

- `judge_strategy(idea, symbol, days, fee_pct, rule_json)` → the ruling: verdict,
  headline, reasons, per-test results, market info and an explanation.
- `list_markets()` → the tokens, windows and fees the court accepts.

## Use it

Hosted Space — add to any MCP client (replace `<user>`):

```json
{ "mcpServers": { "lotcouncil": { "url": "https://<user>-lotcouncil.hf.space/gradio_api/mcp/sse" } } }
```

Local stdio:

```bash
pip install -r requirements.txt
python -m lotcouncil mcp        # MCP over stdio
python -m lotcouncil judge "buy when the 10 hour average crosses above the 40 hour average" --symbol rAAPLUSDT
python -m lotcouncil rerun audit.json   # re-check a saved audit file
```

Run the Gradio app itself (UI + MCP endpoint on :7860):

```bash
python app.py
```

## The three rules it can judge

| Rule | Shape |
| --- | --- |
| Average cross | `{"type":"ma_cross","fast":10,"slow":40}` — hold while the fast average is above the slow |
| Breakout | `{"type":"breakout","lookback":48,"exit_lookback":24}` — buy the highest close of the last N hours, sell at a lower low |
| Dip buy | `{"type":"dip_buy","lookback":24,"drop_pct":2,"max_hold":48}` — buy a dip below the average, sell back at it or after N hours |

## The tests every rule faces

1. **Gate** — enough trades on real candles to mean anything.
2. **A. Unseen data** — the rule is tuned on the first 60% of the window, then must score
   on the last 40% it never saw.
3. **B. Random timing** — the same trades at random times must do worse.
4. **C. Stress** — the rule must survive 3× fees and weekend-only behaviour.

## Environment

| Var | Default | Meaning |
| --- | --- | --- |
| `NEBIUS_API_KEY` | empty → AI off | optional Nebius key for idea translation and explanations — set it as a Space secret; the ruling is identical either way |
| `COURT_MODEL` | `Qwen/Qwen3-235B-A22B-Instruct-2507` | model for translate + explain |

## Data

Hourly candles from Bitget's public spot API. When Bitget is unreachable, committed
snapshots in `data/snapshots/` are used and labelled as such — no prices are ever made
up. Refresh with `python scripts/fetch_candles.py`.
