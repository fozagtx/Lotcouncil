# Rules the court can run

Every rule is long-only: the signal is 0 (cash) or 1 (holding), decided at the close of a
candle and held during the next one. All lengths are counts of hourly candles (integers).
`sma(x, n)` is the simple moving average of the last n closes including the current one;
it is undefined (NaN) for the first n−1 candles.

## ma_cross — Average cross

```
{"type":"ma_cross","fast":F,"slow":S}      1 ≤ F ≤ 2000,  3 ≤ S ≤ 4000,  F < S
sig[i] = 1 if sma(close,F)[i] > sma(close,S)[i] else 0     (0 while sma_S is NaN)
warmup = S
```

`fast: 1` means the price itself versus one average ("buy when price is above its
200-hour average").

Words: "hold while the F-hour average is above the S-hour average".

## breakout — Breakout

```
{"type":"breakout","lookback":L,"exit_lookback":E}   3 ≤ L ≤ 4000, 2 ≤ E ≤ 4000
E default = max(2, L // 2) when omitted
hi[i] = max(close[i−L .. i−1])    (previous L closes, excluding i; NaN if i < L)
lo[i] = min(close[i−E .. i−1])
holding = 0
for each i with hi[i], lo[i] defined:
    if not holding and close[i] > hi[i]: holding = 1
    elif holding and close[i] < lo[i]:   holding = 0
    sig[i] = holding
warmup = max(L, E) + 1
```

Words: "buy on a close above the highest close of the last L hours; sell on a close
below the lowest close of the last E hours".

## dip_buy — Dip buy

```
{"type":"dip_buy","lookback":L,"drop_pct":D,"max_hold":H}
3 ≤ L ≤ 4000 (default 24),  0.1 ≤ D ≤ 50,  1 ≤ H ≤ 4000 (default 48)
avg = sma(close, L);  trigger = 1 − D/100
holding = 0; held = 0
for each i with avg[i] defined:
    if not holding:
        if close[i] ≤ avg[i] × trigger: holding = 1; held = 0
    else:
        held += 1
        if close[i] ≥ avg[i] or held ≥ H: holding = 0
    sig[i] = holding
warmup = L
```

Words: "buy when the price is D% below its L-hour average; sell when it is back at the
average or after H hours".

## Translating a sentence

- Convert units to hours: "2 days" → 48, "1 week" → 168, "a month" → 720.
- "Golden cross", "moving average crossover", "price above the X average" → ma_cross.
- "New high", "breaks out", "highest in N hours/days" → breakout.
- "Buy the dip", "drops X% below average", "mean reversion" → dip_buy.
- Anything needing RSI, MACD, Bollinger, volume, order flow, news, sentiment, options,
  shorting, minutes, multiple simultaneous conditions, stop-losses or take-profits that
  aren't the rule's own exit → unsupported. Say what is unsupported in one sentence.
- Non-integer lengths, F ≥ S, or values outside the bounds → ask, don't round silently.
- Always restate the parsed rule in words to the user before judging.
