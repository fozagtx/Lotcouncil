# Research task walkthrough

What this proves: a trading question goes in, a ruling comes out, a human decides.
Nothing is traded and nothing is recommended.

- Generated: 2026-10-09 00:05:59 UTC
- Space: https://huggingface.co/spaces/pima5/lotcouncil
- MCP endpoint: https://pima5-lotcouncil.hf.space/gradio_api/mcp/sse
- `list_markets` answered in 0.8s: 8 tokens,
  windows [30, 60, 90, 180], fees [0.05, 0.1, 0.2].

## 1. The question

The user is a retail swing trader checking an idea before placing it:

> A trader wants to buy Tesla (rTSLAUSDT) whenever it drops 2% below its 24-hour average and sell when it recovers or after 12 hours. Is that edge or luck?

## 2. Ask the court

```json
{
  "tool": "lotcouncil_judge_strategy",
  "arguments": {
    "idea": "buy Tesla when it drops 2% below its 24 hour average, sell when it recovers or after 12 hours",
    "symbol": "rTSLAUSDT",
    "days": 90,
    "fee_pct": 0.1
  }
}
```

Answered in 0.29s:

```json
{
  "ok": true,
  "verdict": "FAIL",
  "headline": "It does not hold up on data it never saw.",
  "reasons": [
    "On the last 40% of the history, which it never saw, it scored only -6.74; it needs more than 0.5.",
    "Its timing beat only 2.2% of 500 random-timing copies; it needs at least 95%.",
    "With fees at 3x its score fell to -6.28, not above 0, and weekend candles did not lose money."
  ],
  "rule": {
    "type": "dip_buy",
    "lookback": 24,
    "drop_pct": 2.0,
    "max_hold": 12
  },
  "rule_text": "Buy when the price falls 2% below its 24-hour average; sell when it gets back to that average or after 12 hours, whichever comes first.",
  "trades": 17,
  "tests": {
    "A": {
      "name": "Unseen data",
      "passed": false,
      "sentence": "On the last 40% of the history, which it never saw, it scored only -6.74; it needs more than 0.5."
    },
    "B": {
      "name": "Random timing",
      "passed": false,
      "sentence": "Its timing beat only 2.2% of 500 random-timing copies; it needs at least 95%."
    },
    "C": {
      "name": "Stress",
      "passed": false,
      "sentence": "With fees at 3x its score fell to -6.28, not above 0, and weekend candles did not lose money."
    }
  },
  "market": {
    "symbol": "rTSLAUSDT",
    "source": "bitget",
    "candles": 2050,
    "start": 1783728000000,
    "end": 1791500400000,
    "hash": "sha256:6bcb02f3208b318392edfcf7c7760e331b070e479a5155e2d3b8bb744ee2f980"
  },
  "explanation": "This idea gets a FAIL: it does not hold up on data it never saw. On the last 40% of the history, which it never saw, it scored only -6.74; it needs more than 0.5. Its timing beat only 2.2% of 500 random-timing copies; it needs at least 95%. With fees at 3x its score fell to -6.28, not above 0, and weekend candles did not lose money.",
  "note": "The verdict is final and comes from fixed code. PASS means not obviously luck, not a prediction."
}
```

Reading: the court read the idea as `{"type": "dip_buy", "lookback": 24, "drop_pct": 2.0, "max_hold": 12}` ("Buy when the price falls 2% below its 24-hour average; sell when it gets back to that average or after 12 hours, whichever comes first.").
It ran on 2050 hourly candles from bitget (None).
The gate and tests:

- A. Unseen data: FAIL. On the last 40% of the history, which it never saw, it scored only -6.74; it needs more than 0.5.
- B. Random timing: FAIL. Its timing beat only 2.2% of 500 random-timing copies; it needs at least 95%.
- C. Stress: FAIL. With fees at 3x its score fell to -6.28, not above 0, and weekend candles did not lose money.

Verdict: **FAIL** - "It does not hold up on data it never saw.".

## 3. Follow-up with more history

Same rule, one disclosed variant: `days: 180` instead of 90. This is more history
to check whether the answer is stable, not a search through parameters.

```json
{
  "tool": "lotcouncil_judge_strategy",
  "arguments": {
    "idea": "buy Tesla when it drops 2% below its 24 hour average, sell when it recovers or after 12 hours",
    "symbol": "rTSLAUSDT",
    "days": 180,
    "fee_pct": 0.1
  }
}
```

Answered in 0.36s:

```json
{
  "ok": true,
  "verdict": "FAIL",
  "headline": "It does not hold up on data it never saw.",
  "reasons": [
    "On the last 40% of the history, which it never saw, it scored only -2.31; it needs more than 0.5.",
    "Its timing beat only 14% of 500 random-timing copies; it needs at least 95%.",
    "With fees at 3x its score fell to -4.59, not above 0, and weekend candles did not lose money."
  ],
  "rule": {
    "type": "dip_buy",
    "lookback": 24,
    "drop_pct": 2.0,
    "max_hold": 12
  },
  "rule_text": "Buy when the price falls 2% below its 24-hour average; sell when it gets back to that average or after 12 hours, whichever comes first.",
  "trades": 44,
  "tests": {
    "A": {
      "name": "Unseen data",
      "passed": false,
      "sentence": "On the last 40% of the history, which it never saw, it scored only -2.31; it needs more than 0.5."
    },
    "B": {
      "name": "Random timing",
      "passed": false,
      "sentence": "Its timing beat only 14% of 500 random-timing copies; it needs at least 95%."
    },
    "C": {
      "name": "Stress",
      "passed": false,
      "sentence": "With fees at 3x its score fell to -4.59, not above 0, and weekend candles did not lose money."
    }
  },
  "market": {
    "symbol": "rTSLAUSDT",
    "source": "bitget",
    "candles": 3721,
    "start": 1776038400000,
    "end": 1791500400000,
    "hash": "sha256:d84bab67d3e154eaa9bee70714ee1607e287484470603e73df9d53ca7e3392e0"
  },
  "explanation": "This idea gets a FAIL: it does not hold up on data it never saw. On the last 40% of the history, which it never saw, it scored only -2.31; it needs more than 0.5. Its timing beat only 14% of 500 random-timing copies; it needs at least 95%. With fees at 3x its score fell to -4.59, not above 0, and weekend candles did not lose money.",
  "note": "The verdict is final and comes from fixed code. PASS means not obviously luck, not a prediction."
}
```

Reading: on the longer window the verdict is FAIL with
44 trades. One disclosed variant, reported in full.

## 4. Reproduce it yourself

The CLI runs the same engine. The exact rule from step 2:

```
/Users/kaizen/Desktop/Lotc/lotcouncil/.venv/bin/python -m lotcouncil judge buy Tesla when it drops 2% below its 24 hour average, sell when it recovers or after 12 hours --symbol rTSLAUSDT --days 90 --fee 0.1 --json --audit /Users/kaizen/Desktop/Lotc/lotcouncil/docs/walkthrough-audit.json
```

Exit 0 in 7.64s. Re-check the audit file:

```
/Users/kaizen/Desktop/Lotc/lotcouncil/.venv/bin/python -m lotcouncil rerun /Users/kaizen/Desktop/Lotc/lotcouncil/docs/walkthrough-audit.json
```

```
Data hash:  matches (sha256:6bcb02f3208b3183...)
Verdict:    file FAIL, re-run FAIL
Same ruling.
```

Audit file: `docs/walkthrough-audit.json` (108565 bytes, committed with this document).

## 5. Actionable insight

This idea gets a FAIL: it does not hold up on data it never saw. On the last 40% of the history, which it never saw, it scored only -6.74; it needs more than 0.5. Its timing beat only 2.2% of 500 random-timing copies; it needs at least 95%. With fees at 3x its score fell to -6.28, not above 0, and weekend candles did not lose money.

PASS means not obviously luck on this history, not a prediction; a FAIL means the
court found no evidence the idea is better than chance here.

## Appendix: how it was generated

`python docs/walkthrough.py` with the repo `.venv`, using `mcp.client.sse` +
`ClientSession` against https://pima5-lotcouncil.hf.space/gradio_api/mcp/sse. Remote calls were `lotcouncil_list_markets`
and `lotcouncil_judge_strategy`; the local run used `python -m lotcouncil judge`
and `rerun`.
