# Lotcouncil

Put a trading idea on trial before you risk money on it. Type the idea in plain English; Lotcouncil tests it on hourly prices of Bitget tokenized US stocks and returns **PASS** or **FAIL** with the evidence.

The AI only translates your sentence into a rule and explains the result. Deterministic code runs three tests and makes the ruling. The AI never decides pass or fail.

## Features

- Plain-English ideas: average crosses, breakouts, dip buys. Anything else is refused with a message listing what the court can read.
- Three tests, all must pass: unseen data (60/40 time split), random timing (500 shuffled copies), stress (3x fees, weekend candles).
- Same input, same ruling: fixed seed, finished candles only, no look-ahead.
- Trading-terminal UI: candlestick chart with holding periods, per-test cards, trade ledger, editable rule, court timeline.
- Share and audit: verdict card image, re-runnable link, JSON audit file with a SHA-256 data fingerprint.
- MCP server so AI agents can judge their own ideas before trading.
- Works with no API key (keyword reader + template explanation). Add a Nebius key to turn the AI on.

## Prerequisites

- Python 3.12+ (3.14 works)
- Node.js LTS
- Git

## Getting started

One command:

```bash
python3 run.py          # Windows: py run.py
```

It installs what is missing, builds the page and opens <http://localhost:8000>. Step-by-step guide for Windows, Mac and Linux: [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md).

By hand:

```bash
pip install -r requirements.txt
(cd frontend && npm ci && npm run build)
uvicorn lotcouncil.server:app --port 8000
```

Frontend dev server with hot reload (proxies `/api` to port 8000):

```bash
cd frontend && npm run dev     # http://localhost:5173
```

To enable the AI, copy `.env.example` to `.env` and set `NEBIUS_API_KEY`.

## Usage

Web: open the page, type an idea, pick a token, window and fee, press Judge.

CLI:

```bash
python -m lotcouncil judge "buy when the 10 hour average crosses above the 40 hour average" --symbol rAAPLUSDT --audit ruling.json
python -m lotcouncil rerun ruling.json
```

MCP (stdio):

```bash
python -m lotcouncil mcp
```

```json
{
  "mcpServers": {
    "lotcouncil": {
      "command": "python",
      "args": ["-m", "lotcouncil", "mcp"],
      "cwd": "/path/to/lotcouncil"
    }
  }
}
```

Tools: `judge_strategy(idea | rule, symbol, days, fee_pct)` and `list_markets()`.

### Idea types

| Type | Example | Rule |
| --- | --- | --- |
| Average cross | "buy when the 10 hour average crosses above the 40 hour average" | `{"type": "ma_cross", "fast": 10, "slow": 40}` |
| Breakout | "buy when the price breaks above its 48 hour high, sell at its 24 hour low" | `{"type": "breakout", "lookback": 48, "exit_lookback": 24}` |
| Dip buy | "buy when the price drops 1.5% below its 24 hour average, sell after 24 hours" | `{"type": "dip_buy", "drop_pct": 1.5, "lookback": 24, "max_hold": 24}` |

Rules are long-only. Lengths are in hours; days and weeks are converted.

### The three tests

An idea passes only if it makes at least 10 trades and passes all three. Implementation: [`lotcouncil/court.py`](lotcouncil/court.py).

| Test | Question | Passes when |
| --- | --- | --- |
| A. Unseen data | Does it work on the last 40% of history it was not tuned on? | Annualised Sharpe on that slice > 0.5 |
| B. Random timing | Is the timing better than chance? | Beats at least 95% of 500 block-shuffled copies |
| C. Stress | Does it survive 3x fees and weekend candles? | Sharpe at 3x fees > 0, weekend loss < half the total result |

### HTTP API

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/markets` | tokens, windows, fees, AI status |
| GET | `/api/prices?symbol=&days=` | hourly closes and data source |
| POST | `/api/understand` | `{rule, rule_text, source, notice}` |
| POST | `/api/judge` | NDJSON stream: `understood`, `data`, `gate`, `A`, `B`, `C`, `verdict`, `explanation` |
| POST | `/api/audit` | audit file |
| POST | `/api/rerun` | `{same, hash_ok, verdict_in_file, verdict_now, differences}` |

Interactive docs at `/api/docs`.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `NEBIUS_API_KEY` | empty (AI off) | Nebius AI Studio key |
| `COURT_MODEL` | `Qwen/Qwen3-235B-A22B-Instruct-2507` | model name |
| `COURT_AI` | `on` | `off` forces the fallback |
| `COURT_TOKENS` | 8 large US stocks | Bitget symbols shown in the picker |
| `COURT_RATE_LIMIT` / `COURT_AI_LIMIT` | 60 / 20 | per visitor per 10 minutes |
| `COURT_TRUST_PROXY` | `on` | read visitor address from `X-Forwarded-For` |
| `BITGET_BASE_URL`, `COURT_SNAPSHOT_DIR` | Bitget, `data/snapshots` | data sources |

## Data

Hourly spot candles from Bitget's public API, up to 180 days, no key needed. If Bitget is unreachable the app falls back to the CSVs in `data/snapshots/` and says so on the ruling. Refresh them with:

```bash
python scripts/fetch_candles.py
```

## Deploy

[`render.yaml`](render.yaml) is a Render Blueprint: Docker web service, health check on `/api/markets`. In the Render dashboard choose **New → Blueprint**, pick this repo and `main`, set `NEBIUS_API_KEY` (or leave empty), Apply.

The `Dockerfile` and `Procfile` also work on Fly.io, Railway, Hugging Face Spaces or any Python host.

## Development

```bash
pip install -r requirements-dev.txt
pytest -q                                   # 129 tests
(cd frontend && npm run check)              # tsc typecheck (React + Vite + shadcn)
python scripts/calibrate.py --real --out docs/calibration.md
```

Calibration results on synthetic series are in [docs/calibration.md](docs/calibration.md).

## Not financial advice

A PASS means "not obviously luck on this history". It does not predict next month. Lotcouncil never places trades or holds money.
