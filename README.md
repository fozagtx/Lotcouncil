# Lotcouncil

An agent skill that puts a trading idea on trial before anyone acts on it.

Give an agent a sentence like *"buy when the 10 hour average crosses above the 40 hour
average"*. With this skill it translates the sentence into one of three fixed rules,
pulls real Bitget hourly candles, runs a fixed four-check procedure and answers
**PASS** or **FAIL** in a set format. The agent never trades and never decides the
verdict; the procedure does.

## Install

```bash
npx skills add fozagtx/Lotcouncil
```

or clone this repo into your agent's skills directory (`~/.agents/skills/lotcouncil`,
`.devin/skills/lotcouncil`, `.claude/skills/lotcouncil`, ...). The skill is
`SKILL.md` plus `references/`; there is nothing to build or run.

## What the agent does

| Step | Reference |
| --- | --- |
| Translate the idea into `ma_cross`, `breakout` or `dip_buy`, or refuse | `references/rules.md` |
| Fetch and clean Bitget 1h candles, hash them | `references/data.md` |
| Gate (≥ 10 trades), A unseen data, B random timing, C stress | `references/court.md` |
| Report in a fixed 20-line format, disclose every attempt | `SKILL.md` |

A **PASS** means *not obviously luck on this history*. It is not a prediction and not
advice.

## Try it

> Put this on trial on Tesla over 90 days: buy when price breaks above its 3-day high,
> sell when it drops below its 1-day low.

The agent should restate the rule, fetch `rTSLAUSDT` candles, run the court with a real
tool, and return the ruling in the report format.
