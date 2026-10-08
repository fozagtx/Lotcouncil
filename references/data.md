# Getting the candles

Source: Bitget public spot API, no key needed. Hourly candles only.

```
GET https://api.bitget.com/api/v2/spot/market/candles
    ?symbol=rAAPLUSDT&granularity=1h&limit=1000
GET https://api.bitget.com/api/v2/spot/market/candles
    ?symbol=rAAPLUSDT&granularity=1h&endTime=<earliest ms seen>&limit=200   # page back
```

Response `data` is a list of rows `[time_ms, open, high, low, close, base_vol, quote_vol,
...]` as strings. If `granularity=1h` is rejected, try `1H`. The history endpoint
`/api/v2/spot/market/history-candles` takes the same params if the first one caps out.

## Window

`days` ∈ {30, 60, 90, 180}. Target `end` = now (or a past time for monitoring).
`start = end − days × 86400 × 1000`. Page backwards with `endTime` until the earliest row
is ≤ start or the API returns nothing new. If fewer days came back than asked, say so
("short history: N days available of D requested").

## Cleaning (do all of these)

1. Parse `time` and `close` as numbers; drop rows where either is missing.
2. Drop rows with `close ≤ 0`.
3. Drop candles that have not finished: keep only `time + 3_600_000 ≤ now_ms`.
4. Sort by `time` ascending; drop duplicate times keeping the last.
5. Keep only rows with `start ≤ time ≤ end`.
6. Require ≥ 500 candles; otherwise stop and report.

## Hash

```
sha256 over UTF-8 text: one line per candle, "{time_ms},{open},{high},{low},{close}\n"
with each price as a shortest-round-trip float (Python repr), e.g. "1720000000000,230.5,231.0,229.8,230.9\n"
```

Report it as `sha256:<hex>`; the first 12 hex characters are enough in the summary. Two
agents with the same hash ran on the same prices.

## What to tell the user about the data

- "Live hourly candles from Bitget" plus symbol, candle count, first and last candle
  time in UTC.
- Tokenized stocks trade 24/5 natively (Sun 20:00 → Fri 20:00 New York); outside that a
  market maker sets the price. That is why test C checks weekend candles.
- Never fill gaps, interpolate, or mix sources. If Bitget is down, stop: "I can't reach
  Bitget right now, so there is no ruling."
