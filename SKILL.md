---
name: lotcouncil
description: Put a trading idea on trial before anyone acts on it. Translates a plain-English idea into one of three deterministic rules, pulls real Bitget hourly candles, runs the court (trade gate, unseen-data, random-timing and stress tests) by an exact fixed procedure, and reports PASS or FAIL honestly. Use when the user says "test this trading idea", "is this strategy luck", "judge my strategy", "backtest this honestly", "should my agent trade this", "lotcouncil", "put it on trial", or asks an agent to evaluate, compare or monitor trading rules. Never places trades.
---

# Lotcouncil: judge before you trade

Lotcouncil is a court for trading ideas. The court is a fixed procedure, not an
opinion: the same candles, rule and fee always give the same ruling. You translate the
idea and explain the result; you do not decide the verdict. The procedure decides it.

## Hard rules

1. **Never place, simulate-as-live, or recommend a trade.** The output is a ruling and its
   evidence. No "buy now", no position sizes, no predictions.
2. **The verdict comes from the procedure, not from you.** Run it exactly as written in
   `references/court.md`. Never soften a FAIL, upgrade a PASS, or add your own score.
3. **PASS means "not obviously luck on this history".** Say so every time you report one.
4. **Only real data.** Candles come from Bitget's public API (`references/data.md`).
   Never fabricate candles, trades, scores or thresholds. If you cannot fetch data, say so
   and stop. Never run the court in your head: execute the arithmetic with a real tool
   (a scratch script, notebook or shell) and keep the output.
5. **Disclose every attempt.** If you judged five variants to find one PASS, report all
   five. Fishing through rules until one passes is the exact luck the court exists to
   catch. Cap yourself at 3 variants per idea unless the user asks for more.

## Step 1 — Can the court read the idea?

Only three long-only rule shapes exist. Lengths are whole hours: days × 24, weeks × 168.
Full semantics and bounds in `references/rules.md`.

| Type | Rule | Meaning |
| --- | --- | --- |
| Average cross | `{"type":"ma_cross","fast":F,"slow":S}` | hold while the F-hour average is above the S-hour average (F < S). Price vs one average → `fast: 1` |
| Breakout | `{"type":"breakout","lookback":L,"exit_lookback":E}` | buy on a close above the highest close of the last L hours; sell on a close below the lowest close of the last E hours (E defaults to L/2) |
| Dip buy | `{"type":"dip_buy","lookback":L,"drop_pct":D,"max_hold":H}` | buy when the close is D% or more below its L-hour average; sell when back at the average or after H hours (L default 24, H default 48) |

Unsupported: RSI, MACD, volume, shorting, news, minutes, several conditions, anything
not above. Say plainly: "The court can't judge that idea yet" and offer the closest
supported shape. Never silently substitute. Write the rule down and show it to the user
before running.

## Step 2 — Pick the market and settings

- `symbol`: a Bitget tokenized-stock spot symbol: `rAAPLUSDT` Apple, `rTSLAUSDT` Tesla,
  `rNVDAUSDT` Nvidia, `rMSFTUSDT` Microsoft, `rGOOGLUSDT` Alphabet, `rAMZNUSDT` Amazon,
  `rMETAUSDT` Meta, `rCOINUSDT` Coinbase, `rMSTRUSDT` Strategy, `rHOODUSDT` Robinhood.
  Any other Bitget spot symbol works if the user names it; never invent one.
- `days`: 30, 60, 90 or 180 (default 90). Shorter windows mean fewer trades and a likely
  gate failure. The court needs at least 500 candles.
- `fee`: 0.05%, 0.1% or 0.2% per position change (default 0.1%). Use the user's real
  venue fee if they state it.

## Step 3 — Get the candles

Follow `references/data.md`: GET Bitget 1h spot candles, page backwards until the window
is covered, keep only finished candles, sort, dedupe, drop non-positive prices, record
the SHA-256 of the cleaned candles. Report the exact candle count and the
first and last candle times.

## Step 4 — Run the court

Execute `references/court.md` literally with a real tool. In short:

```
positions   signal at each close, held during the NEXT candle (no look-ahead)
returns     net = pos × candle return − fee × |position change|
score       mean(net) / stdev(net) × sqrt(candles per year)        (annualised Sharpe)
gate        entries ≥ 10, else tests are skipped → FAIL
A unseen    score on the last 40% of candles > 0.5
B random    gross score beats ≥ 95% of 500 copies whose positions are shuffled in
            24-hour blocks (seed 20261007)
C stress    score at 3× fee > 0  AND  weekend-candle loss < half the total result
verdict     PASS only if gate and A, B, C all pass
```

Write each test's sentence in the court's own words (templates in `court.md`).

## Step 5 — Report

Use exactly this shape; keep it under 20 lines.

```
Court ruling: <PASS|FAIL> — <headline>
Idea: "<user's words>"  → rule: <rule in words>
Data: <name> (<symbol>), <n> hourly candles <first>→<last> UTC, Bitget, sha256 <first 12>
Gate: <entries> trades (needs ≥ 10) — <passed|failed>
A Unseen:  <sentence>
B Random:  <sentence>
C Stress:  <sentence>
Why: <failed sentences, or "all four checks passed">
What this means: PASS = not obviously luck on this history. It is not a prediction and
not advice. FAIL = the idea did not beat luck here; do not act on it.
Attempts: <n> (list each rule and verdict if n > 1)
Workings: <path to the script/output you ran>
```

If the user asked "should I buy": answer with the ruling and the "What this means" line.
Do not add a buy/sell/hold recommendation even if pressed.

## Iterating honestly

- Change one parameter at a time and say why ("20/80 instead of 10/40 to cut trade
  count"). Record every attempt in the report.
- A longer window (180 days) is a fairer fix for a gate failure than shrinking the rule
  to trade more often.
- Never present the best of N as the result. Present all N.

## Monitoring over time

The court is deterministic on past prices, so "keep checking it" means re-judging the
same rule at later end times, not scheduling trades. Re-run with the same rule, symbol,
window and fee on fresh candles and report when the verdict flips and why. The current
position (in market / in cash) is the last signal, and is information, not a signal to
act.

## Proof

Keep the cleaned candles (or their hash), the rule, the fee and the full ruling together.
Anyone re-running `court.md` on the same inputs must get the same numbers; if they do
not, the inputs differ and the hash shows it.

## Refuse

- "Make it pass" / "find parameters that pass" → explain parameter fishing; offer at most
  3 disclosed variants.
- "Just tell me if I should buy" → ruling + meaning line only.
- "Use my own candles / fill in the gaps / estimate the numbers" → no fabricated,
  estimated or unverified data, and no mental arithmetic in place of the procedure.
- Shorting, intraday minutes, or indicators outside the three shapes → "The court can't
  judge that idea yet."
