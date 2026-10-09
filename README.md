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

# Lotcouncil

MCP server that puts a trading idea on trial before an agent acts on it. It turns a
plain-English idea into one of three fixed rules, runs four tests on real Bitget hourly
candles, and returns PASS or FAIL. The verdict comes from fixed code, never from a model.
PASS means not obviously luck on this history. It is not a prediction. Nothing is traded.

## Features

- Two MCP tools: `judge_strategy` and `list_markets`
- Three rule types: average cross, breakout, dip buy
- Four checks: trade gate, unseen data, random timing, stress
- Real hourly candles from Bitget, with labelled snapshots as fallback
- Optional AI (Qwen via Nebius) for translating the idea and writing the explanation
- Audit files that anyone can re-run to get the same ruling

## Prerequisites

- An MCP client (Claude Desktop, Cursor, Codex, Devin, etc.)
- For local use: Python 3.12+

## Getting started

Hosted: https://huggingface.co/spaces/pima5/lotcouncil

Add it to your MCP client:

```json
{ "mcpServers": { "lotcouncil": { "url": "https://pima5-lotcouncil.hf.space/gradio_api/mcp/sse" } } }
```

The tools show up as `lotcouncil_judge_strategy` and `lotcouncil_list_markets`.

Local:

```bash
pip install -r requirements.txt
python app.py                  # UI and MCP endpoint on http://localhost:7860
python -m lotcouncil mcp       # MCP over stdio instead
```

## Usage

Judge an idea from an agent:

```
judge_strategy(idea="buy when the 10 hour average crosses above the 40 hour average",
               symbol="rTSLAUSDT", days=90, fee_pct=0.1)
```

Or give the exact rule:

```
judge_strategy(rule_json='{"type":"breakout","lookback":72}', symbol="rNVDAUSDT", days=180)
```

Result (trimmed):

```json
{ "ok": true, "verdict": "FAIL", "headline": "Its timing is no better than chance.",
  "reasons": ["Its timing beat only 78% of 500 random-timing copies; it needs at least 95%."],
  "rule": {"type": "ma_cross", "fast": 10, "slow": 40}, "trades": 30,
  "tests": { "A": {"passed": true}, "B": {"passed": false}, "C": {"passed": false} } }
```

Command line:

```bash
python -m lotcouncil judge "buy when the 10 hour average crosses above the 40 hour average" --symbol rAAPLUSDT --audit out.json
python -m lotcouncil rerun out.json
```

A complete worked example with real outputs is in [docs/walkthrough.md](docs/walkthrough.md).

### Rules

| Type | Rule | Meaning |
| --- | --- | --- |
| Average cross | `{"type":"ma_cross","fast":10,"slow":40}` | Hold while the 10 hour average is above the 40 hour average |
| Breakout | `{"type":"breakout","lookback":48,"exit_lookback":24}` | Buy on a close above the highest close of the last 48 hours; sell on a close below the lowest of the last 24 |
| Dip buy | `{"type":"dip_buy","lookback":24,"drop_pct":2,"max_hold":48}` | Buy when price is 2% below its 24 hour average; sell when it is back at the average or after 48 hours |

Lengths are hours. Anything else (RSI, MACD, volume, shorting, news) is rejected with a
plain message.

### Tests

| Check | Passes when |
| --- | --- |
| Gate | At least 10 trades |
| A. Unseen data | Score on the last 40% of candles is above 0.5 |
| B. Random timing | Beats at least 95% of 500 copies with the same positions shuffled in 24 hour blocks |
| C. Stress | Score at 3x fees is above 0, and weekend candles lose less than half the total result |

Inputs: `symbol` from `list_markets` (`rAAPLUSDT`, `rTSLAUSDT`, `rNVDAUSDT`, ...),
`days` 30, 60, 90 or 180, `fee_pct` 0.05, 0.1 or 0.2.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEBIUS_API_KEY` | unset (AI off) | Enables AI translation and explanation. Set as a Space secret. The ruling is the same either way |
| `COURT_MODEL` | `Qwen/Qwen3-235B-A22B-Instruct-2507` | Model used when AI is on |
| `COURT_TOKENS` | 8 US stock tokens | Comma-separated symbols offered by `list_markets` |

Snapshots in `data/snapshots/` are used only when Bitget is unreachable, and the result
says so. Refresh them with `python scripts/fetch_candles.py`.

## Project description

### 1. Thesis

AI agents now write trading rules in seconds, and the only check most of them get is a backtest run by the same agent that wrote the rule. Lotcouncil splits those two jobs. The model may translate the idea and explain the result, but fixed code decides. Every idea must make at least 10 trades, score above 0.5 on the last 40% of the data, beat 95% of 500 random-timing copies of itself, and still hold up at 3x fees and across weekend candles, all on real Bitget hourly prices. If an idea cannot pass that, it should not be traded, and an agent should find that out in one tool call.

### 2. Target user and product value

The user is a retail swing trader on Bitget rTokens such as rTSLAUSDT, rNVDAUSDT and rAAPLUSDT, with $1k to $20k, making a few trades a week and holding for hours to days, who now builds rules with an AI agent. The problem is that the agent's confidence and its backtest come from the same place. A full quant stack is too heavy for this trader, and asking another LLM to review the idea is just one more opinion. Lotcouncil gives a PASS or FAIL from code the trader cannot bend, with the reasons in plain sentences, before any order exists.

### 3. Validation data and key metrics

All figures below are observed and come from `docs/calibration.md`, run on 90 day windows with a 0.1% fee. On 800 series of random prices with no edge, the court passed 2.1% of rulings. On series with a planted trend, the trend rules passed 29% to 34% of the time and the dip-buy rule, which bets against the trend, passed 0%. Twelve repeated rulings on the same input were identical. A ruling takes 6 ms on average, and 0.3 to 3.5 seconds end to end through the hosted MCP endpoint. A live run on real Tesla data, including the audit file and a rerun with a matching hash, is in `docs/walkthrough.md`.

There are no external users yet. The targets for the first month are 50 connected MCP clients, 500 rulings served, the share of ideas that FAIL, and the number of clients that come back. Lotcouncil places no orders, so volume and AUM are not its metrics; bad trades avoided and retention are.

### 4. Progress

Built so far: three rule types, the four-test court, hourly price data from Bitget, audit files with a `rerun` command, an MCP server over SSE on Hugging Face and over stdio for local use, a Gradio demo, a command line, 111 tests and a calibration script. Not built yet: rules based on RSI, volume or short selling, saved history per user, and Playbook or Agentic account integration.

Three problems came up during development. Bitget's symbol list stopped marking which tokens are rTokens, so the symbols are now named directly. The first web UI hid the ruling below the chart on phones, so the UI was dropped in favour of an MCP server, which is what agents call anyway. The AI explanation sometimes quoted numbers the court never produced, so every explanation is now checked against the ruling and replaced by a plain template if it fails.

Next: reject time windows that are not in the list, add more rule shapes, and sign the audit log.

Stack: Python, numpy, pandas, Gradio as the MCP server, Hugging Face Spaces, the Bitget spot API v2 (`/api/v2/spot/market/candles`), and Qwen3-235B-A22B-Instruct through Nebius for translation and explanation only.
