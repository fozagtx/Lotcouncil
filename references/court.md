# The court, step by step

Execute this with a real tool (any language with arrays and a seedable RNG). Inputs:
cleaned hourly candles `time[]` (ms, UTC, ascending) and `close[]`, a validated rule
(`rules.md`), and `fee` as a fraction (0.1% → 0.001). Fixed settings:

```
min_candles 500      min_trades 10        split 0.60
unseen_score_min 0.5 copies 500           block_hours 24
beat_share_min 0.95  stress_fee_mult 3.0  stress_score_min 0.0
weekend_loss_max_share 0.5                seed 20261007
```

Never change these. If a user wants different thresholds, you may run it as an
explicitly labelled "non-standard" ruling, never as the court's verdict.

## 0. Admissibility

Refuse (with the reason) if any holds:

- fewer than 500 candles, or more than 20 000;
- any close missing or ≤ 0; any time not strictly increasing;
- `warmup(rule) > n / 2` (see `rules.md`): "This rule needs W candles before its first
  decision, more than half of the N available."
- fee not in [0, 5%).

## 1. Positions and returns

```
n            = len(close)
ret[0]       = 0;  ret[i] = close[i] / close[i-1] − 1
sig[i]       = desired position (0/1) decided at the close of candle i   (rules.md)
pos[0]       = 0;  pos[i] = sig[i-1]            # held during candle i, no look-ahead
changes[i]   = |pos[i] − pos[i-1]|  with pos[-1] = 0
gross[i]     = pos[i] × ret[i]
net[i]       = gross[i] − fee × changes[i]
trades       = count of i where pos[i] > 0 and pos[i-1] == 0   (entries)
bar_seconds  = median(diff(time)) / 1000
bars_per_year= 365.25 × 86400 / bar_seconds
```

## 2. Score

```
score(r) = 0 if len(r) < 2 or stdev(r, ddof=1) < 1e-12
         else mean(r) / stdev(r, ddof=1) × sqrt(bars_per_year)
```

Sample standard deviation (ddof = 1). Report scores rounded to 3 decimals, show 2.

## 3. Gate

`gate_passed = trades ≥ 10`. If it fails, skip A, B, C; verdict is FAIL, headline
"Too few trades to judge."

Sentence: "It made {trades} trades, enough to judge (at least 10 are needed)." /
"It never traded; the court needs at least 10 trades to judge." /
"It made only {trades} trade(s); the court needs at least 10 to judge."

## 4. Test A — Unseen data

```
split        = floor(n × 0.60)
score_unseen = score(net[split:])
score_seen   = score(net[:split])        # reported only
A_passed     = score_unseen > 0.5
```

Also report `trades_unseen` (entries counted within `pos[split:]`) and
`return_unseen_pct = (prod(1 + net[split:]) − 1) × 100`.

Sentence: "On the last 40% of the history, which it never saw, it scored {s:.2f}, above
the 0.5 it needs." / "... it scored only {s:.2f}; it needs more than 0.5."

## 5. Test B — Random timing

Uses **gross** returns (fees are judged in C; shuffling adds position changes at block
edges that would unfairly charge the copies).

```
block   = max(1, round(24 × 3600 / bar_seconds))          # 24 candles for 1h data
blocks  = [indices 0..block-1], [block..2block-1], ... (last one may be short)
rng     = numpy default_rng(20261007)        # PCG64; use exactly this for reproducibility
for copy in 0..499:
    order   = rng.permutation(len(blocks))
    idx     = concatenate(blocks[k] for k in order)
    copy_r  = pos[idx] × ret                 # shuffled positions against real returns
    copy_scores[copy] = score(copy_r)
score_real = score(gross)
beat_share = mean(copy_scores < score_real)
B_passed   = beat_share ≥ 0.95
```

The permutations are drawn in copy order 0..499 from one RNG stream (the reference
implementation draws them in chunks of 100 but the stream order is identical). If your
language lacks numpy's PCG64, state that your copy scores are not bit-identical to the
reference; the pass/fail decision is still valid if you use 500 copies and a fixed seed.

Sentence: "Its timing beat {beat_share×100:.0f}% of 500 random copies, at least the 95%
it needs." / "Its timing beat only {..}% of 500 random copies; it needs at least 95%."

## 6. Test C — Stress

```
stress_net  = gross − fee × 3.0 × changes
score_stress= score(stress_net)
fee_passed  = score_stress > 0.0

total       = sum(net)
wk          = weekend_mask(time)             # below
wk_result   = sum(net[wk])
wk_loss     = max(0, −wk_result)
weekend_passed = wk_loss == 0
              or (total > 0 and wk_loss / total < 0.5)
C_passed    = fee_passed and weekend_passed
```

`weekend_mask`: convert each candle open time to America/New_York. A candle is "weekend"
if it opens on Saturday, or Friday at/after 20:00, or Sunday before 20:00 (the native US
session for tokenized stocks runs Sunday 20:00 → Friday 20:00 NY time; outside it prices
come from a market maker).

Sentence: "{fee_part}, and {wk_part}." where
fee_part = "With fees at 3x it still scored {s:.2f}" /
           "With fees at 3x its score fell to {s:.2f}, not above 0";
wk_part  = "weekend candles did not lose money" /
           "weekend candles lost {loss%}, under|more than half of the {total%} total result" /
           "weekend candles lost {loss%} with no overall profit to absorb it".

## 7. Verdict

```
PASS  iff gate_passed and A_passed and B_passed and C_passed
```

Headline, first match: gate failed → "Too few trades to judge."; A failed → "It does not
hold up on data it never saw."; B failed → "Its timing is no better than chance.";
fee_passed false → "It does not survive higher fees."; weekend failed → "Weekend prices
eat too much of the result."; PASS → "Not obviously luck on this history."

`reasons` = the gate sentence if it failed, then the sentence of each failed test in
order A, B, C.

Also report: `time_in_market_pct = mean(pos) × 100`, `total_return_pct =
(prod(1+net) − 1) × 100`, `buy_hold_return_pct = (close[-1]/close[0] − 1) × 100`,
`score = score(net)`, and the candle count, first/last time and data hash.

## 8. What the court does not do

- No shorting, no leverage, no partial positions, no slippage model beyond the fee.
- No parameter search. One rule in, one ruling out.
- No forecast. A PASS says the past did not look like luck; nothing more.
