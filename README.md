# Lotcouncil

**Before your AI agent trades, put its idea on trial.**

Type a trading idea in plain English. Lotcouncil tests it on hourly prices of Bitget tokenized US stocks and rules **PASS** or **FAIL**. Fixed TypeScript code makes the ruling; the AI only translates your sentence and explains the result.

This is a full-stack Next.js app. The court logic lives in `web/lib/court/` and runs inside Next.js API routes.

## Run it on your computer

You need [Git](https://git-scm.com/downloads), [Node.js 20+ (LTS)](https://nodejs.org/) and a network connection to `api.bitget.com`.

```bash
git clone https://github.com/fozagtx/Lotcouncil.git
cd Lotcouncil
npm install
npm run dev
```

Open <http://localhost:3000>.

For production:

```bash
npm run build
npm start
```

## How the court rules

An idea passes only with at least **10 trades** and **all three tests** passed. The code is in `web/lib/court/court.ts` and never calls an AI.

| Test | Question | Passes when |
| --- | --- | --- |
| A. Unseen data | Does it work on data it never saw? | Score on the last 40% of the history is above 0.5 |
| B. Random timing | Is the timing better than chance? | It beats at least 95% of 500 copies with shuffled 24-hour blocks |
| C. Stress | Does it survive a worse world? | Score at 3× fees is above 0, and weekend losses are under half the total result |

The score is an annualised Sharpe ratio of hourly returns. Rules are long-only, decide at a candle's close and hold during the next, and pay the fee on every position change. The shuffles use a fixed seed, so the same input always gives the same ruling.

It reads three kinds of idea: an **average cross** ("buy when the 10 hour average crosses above the 40 hour average"), a **breakout** ("buy when the price breaks above its 48 hour high, sell at its 24 hour low") and a **dip buy** ("buy when the price drops 1.5% below its 24 hour average, sell after 24 hours").

Prices are finished hourly candles from Bitget's public spot API. If Bitget can't be reached, saved candles from `data/snapshots/` are used and labelled; the app never shows made-up prices.

## API routes

| Route | Method | Description |
| --- | --- | --- |
| `/api/health` | GET | status |
| `/api/markets` | GET | tokens, windows, fees |
| `/api/prices` | GET | thinned price series |
| `/api/judge` | POST | streaming NDJSON verdict |
| `/api/audit` | POST | download audit JSON |

## Settings

Set these in the environment before starting the dev server.

| Variable | Default | Meaning |
| --- | --- | --- |
| `COURT_TOKENS` | 8 large US stocks | Bitget symbols in the picker |
| `COURT_SNAPSHOT_DIR` | `data/snapshots` | fallback candle CSVs |
| `BITGET_BASE_URL` | `https://api.bitget.com` | Bitget API base |

## Development

```bash
npm run typecheck
npm run lint
npm run build
```

## Not financial advice

A PASS means "not obviously luck on this history", not that the idea will make money. Lotcouncil never places trades or holds money.
