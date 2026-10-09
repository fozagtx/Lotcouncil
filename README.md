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

Agents now write trading rules in seconds, and most of them are luck dressed up as
logic. The usual check is a single backtest, which the same agent can tune until it
looks good. Lotcouncil separates the two jobs: the model may translate and explain, but
only fixed code decides. Every idea must clear four checks that are hard to fake:
enough trades, a score on data that played no part in writing the rule, timing that
beats 500 random copies of itself, and survival at 3x fees and across weekend candles.
Hypothesis: if an idea cannot pass this on 90 days of real rToken prices, no agent
should act on it, and the agent can be told so in one tool call.

### 2. Target user and product value

Retail swing traders on Bitget tokenized US stocks (rTSLAUSDT, rNVDAUSDT, rAAPLUSDT and
similar), $1k to $20k capital, a few trades per week, holding hours to days, who now
build or ask an AI agent for their rules. Their pain: the agent sounds confident and the
backtest it shows was made by the same agent. Existing fixes are either a full quant
stack they will not run, or an LLM "review" that is one more opinion. Lotcouncil gives
them a yes/no from code they did not write and cannot bend, with the reasons in plain
sentences, before any order exists.

### 3. Validation data and key metrics

Observed, from `docs/calibration.md` (`scripts/calibrate.py`, 90 day windows, 0.1% fee):

- False pass rate on 800 series of random prices with no edge: 2.1% (target under 5%).
- Pass rate on 400 series with a planted trend: 17% overall, 29% to 34% for the trend
  rules it should catch, 0% for the dip-buy rule that bets against the trend.
- Same input, same ruling: 12 of 12 repeats identical.
- Time to ruling: median 6 ms on 2160 candles; 0.3 s to 3.5 s end to end through the
  hosted MCP endpoint including the Bitget fetch.
- Live run record: `docs/walkthrough.md`, one task on real Tesla data, reproduced from
  the audit file with matching hash.

No external users yet. Targeted for the first month after listing: 50 agents or clients
connected to the MCP endpoint, 500 rulings served, share of ideas that FAIL (the number
of bad trades not placed), and repeat use by the same client. The product places no
orders, so volume and AUM are not its metrics; avoided losses and retention are.

### 4. Progress

Built: three rule types, the four-test court, Bitget hourly data with labelled snapshot
fallback, audit files with `rerun`, MCP over SSE on Hugging Face and over stdio, Gradio
demo, CLI, 111 tests, calibration script. Not built: more rule types (RSI, volume,
shorting), per-user rule history, Playbook or Agentic account integration.

Problems and fixes: Bitget's symbol list no longer flags rTokens, so discovery is by
explicit symbol; the first UI hid the ruling under the chart on small screens, so the
whole web app was dropped in favour of an MCP server, which is what agents actually
call; the AI explanation sometimes added numbers the court never produced, so every
explanation is checked against the ruling and replaced by a template if it fails.

Next: strict rejection of non-listed windows, more rule shapes, a signed audit log.

Stack: Python, numpy, pandas, Gradio (MCP server), Hugging Face Spaces, Bitget public
spot API v2 (`/api/v2/spot/market/candles`), Qwen3-235B-A22B-Instruct via Nebius for
translation and explanation only.
