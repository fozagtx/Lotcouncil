# Lotcouncil

**Before your AI agent trades, put its idea on trial.**

Type a trading idea in plain English. Lotcouncil tests it on hourly prices of Bitget tokenized US stocks and rules **PASS** or **FAIL**. Fixed code makes the ruling; the AI only translates your sentence and explains the result.

## Run it on your computer

You need [Git](https://git-scm.com/downloads), [Python 3.10+](https://www.python.org/downloads/) and [Node.js 20+ (LTS)](https://nodejs.org/). On Windows, tick **"Add python.exe to PATH"** when installing Python.

```bash
git clone -b claude/dreamy-newton-1s7ov4 https://github.com/fozagtx/Lotcouncil.git
cd Lotcouncil
py run.py          # Mac/Linux: python3 run.py
```

The first run installs what's missing and builds the page (1–3 minutes), then opens <http://localhost:8000>. Keep the terminal open; press **Ctrl+C** to stop.

**Update:** stop it (Ctrl+C), then `git pull` and `py run.py --rebuild`. Press Ctrl+F5 in the browser.

**Turn on the AI (optional):** copy `.env.example` to `.env`, put your Nebius AI Studio key after `NEBIUS_API_KEY=`, restart. Without a key a built-in keyword reader and summary are used.

| Problem | Fix |
| --- | --- |
| `'python' is not recognized` | Use `py` (Windows) or `python3` (Mac/Linux). |
| `Port 8000 is already in use` | Lotcouncil is already running somewhere; close it, or `py run.py --port 8001`. |
| Old page still shows | Stop every running copy, `py run.py --rebuild`, then Ctrl+F5. |
| `Couldn't load rAAPL prices from Bitget` | Your network can't reach `api.bitget.com` (VPN, firewall or region). Try again later. |

## How the court rules

An idea passes only with at least **10 trades** and **all three tests** passed. The code is in [`lotcouncil/court.py`](lotcouncil/court.py) and never calls an AI.

| Test | Question | Passes when |
| --- | --- | --- |
| A. Unseen data | Does it work on data it never saw? | Score on the last 40% of the history is above 0.5 |
| B. Random timing | Is the timing better than chance? | It beats at least 95% of 500 copies with shuffled 24-hour blocks |
| C. Stress | Does it survive a worse world? | Score at 3× fees is above 0, and weekend losses are under half the total result |

The score is an annualised Sharpe ratio of hourly returns. Rules are long-only, decide at a candle's close and hold during the next, and pay the fee on every position change. The shuffles use a fixed seed, so the same input always gives the same ruling.

It reads three kinds of idea: an **average cross** ("buy when the 10 hour average crosses above the 40 hour average"), a **breakout** ("buy when the price breaks above its 48 hour high, sell at its 24 hour low") and a **dip buy** ("buy when the price drops 1.5% below its 24 hour average, sell after 24 hours").

Prices are finished hourly candles from Bitget's public spot API. If Bitget can't be reached, saved candles from `data/snapshots/` are used and labelled; the app never shows made-up prices. Saved candles for the eight default tokens are included; refresh them with `python scripts/fetch_candles.py`.

Each ruling can be shared as an image or a link, or downloaded as an audit file with the exact candles and their fingerprint. Re-check one with `python -m lotcouncil rerun file.json`.

## For AI agents (MCP)

`judge_strategy` lets an agent put its idea on trial before it trades. Add this to your MCP client, with your own folder path:

```json
{
  "mcpServers": {
    "lotcouncil": { "command": "python", "args": ["-m", "lotcouncil", "mcp"], "cwd": "/path/to/Lotcouncil" }
  }
}
```

## Settings

Put these in `.env` or the environment.

| Variable | Default | Meaning |
| --- | --- | --- |
| `NEBIUS_API_KEY` | empty (AI off) | Nebius AI Studio key |
| `COURT_MODEL` | `Qwen/Qwen3-235B-A22B-Instruct-2507` | model name |
| `COURT_TOKENS` | 8 large US stocks | Bitget symbols in the picker |
| `COURT_RATE_LIMIT` / `COURT_AI_LIMIT` | 60 / 20 | rulings / AI calls per visitor per 10 minutes |
| `COURT_PRACTICE` | `off` | `on` adds made-up practice markets (development only) |

## Development

```bash
pip install -r requirements-dev.txt && pytest -q      # Python tests
cd frontend && npm ci && npm run check                # types and accessibility
npm run dev                                           # page with hot reload; API on :8000
```

Other commands: `python -m lotcouncil judge "<idea>" --symbol rAAPLUSDT`, `python -m lotcouncil serve`. API docs are at `/api/docs`. The `Dockerfile` builds and runs everything for hosting; `render.yaml` deploys it on Render.

The page is SvelteKit with Svelte ports of [VengeanceUI](https://www.vengenceui.com) components (MIT, notice in `frontend/src/lib/components/ui/`).

## Not financial advice

A PASS means "not obviously luck on this history", not that the idea will make money. Lotcouncil never places trades or holds money.
