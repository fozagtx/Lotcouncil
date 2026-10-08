"""The built-in keyword reader: turns a plain-English idea into a rule without any AI.

It is the fallback when the AI is off or down, so it handles the three idea
types the court knows and politely refuses everything else.
"""

from __future__ import annotations

import re

from .rules import RuleError, validate_rule

UNSUPPORTED_HINT = (
    "The court can read three kinds of idea: an average cross "
    "(\"buy when the 10 hour average crosses above the 40 hour average\"), a breakout "
    "(\"buy when the price breaks above its 48 hour high\"), or a dip buy "
    "(\"buy when the price drops 2% below its 24 hour average\")."
)

_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8,
    "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "fifteen": 15, "twenty": 20,
    "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80,
    "ninety": 90, "hundred": 100, "a hundred": 100, "two hundred": 200,
}
_UNITS = {
    "h": 1, "hr": 1, "hrs": 1, "hour": 1, "hours": 1, "hourly": 1,
    "bar": 1, "bars": 1, "candle": 1, "candles": 1, "period": 1, "periods": 1,
    "d": 24, "day": 24, "days": 24, "daily": 24,
    "w": 168, "wk": 168, "wks": 168, "week": 168, "weeks": 168, "weekly": 168,
}
_NUM = r"\d+(?:\.\d+)?"
_LEN_RE = re.compile(
    rf"({_NUM})\s*-?\s*(hours?|hrs?|hourly|h|bars?|candles?|periods?|days?|daily|d|weeks?|weekly|wks?|w)\b"
)
_PCT_RE = re.compile(rf"({_NUM})\s*(?:%|percent\b|pct\b|per cent\b)")
_HOLD_RE = re.compile(
    rf"(?:after|for|within|hold(?:ing)?(?: it)?(?: for)?|max(?:imum)?(?: of)?)\s+(?:up to\s+)?"
    rf"({_NUM})\s*-?\s*(hours?|hrs?|h|days?|d|bars?|candles?)\b"
)
_MINUTES_RE = re.compile(rf"{_NUM}\s*-?\s*(?:m|min|mins|minutes?)\b")

_UNSUPPORTED = [
    (r"\brsi\b|relative strength", "RSI rules"),
    (r"\bmacd\b", "MACD rules"),
    (r"bollinger", "Bollinger band rules"),
    (r"\bvolume\b", "volume rules, because Bitget's volume data for these tokens is incomplete"),
    (r"\bshort(?:ing|s)?\b(?!er|est)|sell short", "short selling (rules here only buy or hold cash)"),
    (r"\bnews\b|tweet|earnings|sentiment", "news or sentiment rules"),
]


class ParseError(RuleError):
    """The idea could not be read as one of the three rule types."""


def _normalise(text: str) -> str:
    t = " " + text.lower().replace("‑", "-").replace("–", "-").replace("—", "-") + " "
    t = re.sub(r"(?<=\d),(?=\d{3}\b)", "", t)
    for word, num in sorted(_WORDS.items(), key=lambda kv: -len(kv[0])):
        t = re.sub(rf"\b{word}\b", str(num), t)
    return t


def _lengths(t: str) -> list[tuple[int, int, int]]:
    """(hours, start, end) for every length with a unit, in order of appearance."""
    out = []
    for m in _LEN_RE.finditer(t):
        hours = float(m.group(1)) * _UNITS[m.group(2)]
        if hours.is_integer() and hours >= 1:
            out.append((int(hours), m.start(), m.end()))
    return out


def _bare_numbers(t: str) -> list[int]:
    """Whole numbers with no unit and no percent sign (treated as hours)."""
    covered = [(m.start(), m.end()) for m in _LEN_RE.finditer(t)] + [(m.start(), m.end()) for m in _PCT_RE.finditer(t)]
    nums = []
    for m in re.finditer(rf"(?<![\w.]){_NUM}(?![\w.%])", t):
        if any(a <= m.start() < b for a, b in covered):
            continue
        val = float(m.group(0))
        if val.is_integer() and val >= 1:
            nums.append(int(val))
    return nums


def _ordered_lengths(t: str) -> list[int]:
    """Every length in order. A bare number borrows the unit of the length before it (default hours)."""
    with_units = [(m.start(), float(m.group(1)), _UNITS[m.group(2)]) for m in _LEN_RE.finditer(t)]
    covered = [(m.start(), m.end()) for m in _LEN_RE.finditer(t)] + [(m.start(), m.end()) for m in _PCT_RE.finditer(t)]
    items = list(with_units)
    for m in re.finditer(rf"(?<![\w.]){_NUM}(?![\w.%])", t):
        if not any(a <= m.start() < b for a, b in covered):
            items.append((m.start(), float(m.group(0)), None))
    items.sort()
    out, unit = [], 1
    for _, value, mult in items:
        if mult is not None:
            unit = mult
        hours = value * unit
        if hours.is_integer() and hours >= 1:
            out.append(int(hours))
    return out


def _near(lengths: list[tuple[int, int, int]], t: str, word_re: str) -> int | None:
    """The length that sits just before (or just after) a keyword like 'high' or 'low'."""
    for m in re.finditer(word_re, t):
        before = [h for h, s, e in lengths if e <= m.start() and m.start() - e <= 25]
        if before:
            return before[-1]
        after = [h for h, s, e in lengths if s >= m.end() and s - m.end() <= 25]
        if after:
            return after[0]
    return None


def keyword_parse(idea: str) -> dict:
    """Read an idea with simple keyword rules. Returns a validated rule or raises ParseError."""
    if not isinstance(idea, str) or not idea.strip():
        raise ParseError("Type an idea first. " + UNSUPPORTED_HINT)
    t = _normalise(idea)

    for pattern, what in _UNSUPPORTED:
        if re.search(pattern, t):
            raise ParseError(f"The court can't judge {what} yet. " + UNSUPPORTED_HINT)
    if _MINUTES_RE.search(t) and not _LEN_RE.search(t):
        raise ParseError("Rules run on hourly candles, so give lengths in hours, days or weeks. " + UNSUPPORTED_HINT)

    lengths = _lengths(t)
    pcts = [float(m.group(1)) for m in _PCT_RE.finditer(t)]

    is_dip = bool(re.search(r"\b(dips?|drops?|dropped|falls?|fell|falling|pull ?backs?|sell-?offs?|oversold|declines?|down)\b", t))
    is_breakout = bool(
        re.search(r"break ?outs?|breaks? (?:above|out|through|over)|new (?:\S+ ){0,3}highs?|highest|donchian|\bhighs?\b", t)
    )
    is_cross = bool(re.search(r"\bcross(?:es|ed|ing|over)?\b|averages?|\bmas?\b|\bsma\b|\bema\b|golden", t))

    try:
        if is_dip and pcts:
            rule = {"type": "dip_buy", "drop_pct": pcts[0]}
            avg_len = _near(lengths, t, r"averages?|\bmean\b|\bma\b|\bsma\b")
            hold = None
            m = _HOLD_RE.search(t)
            if m:
                hold = int(float(m.group(1)) * _UNITS[m.group(2)])
            if avg_len is None:
                others = [h for h, _, _ in lengths if h != hold]
                avg_len = others[0] if others else None
            if avg_len is not None:
                rule["lookback"] = avg_len
            if hold is not None:
                rule["max_hold"] = hold
            return validate_rule(rule)

        if is_breakout and not (is_cross and not re.search(r"\bhighs?\b|highest|break", t)):
            look = _near(lengths, t, r"\bhighs?\b|highest") or (lengths[0][0] if lengths else None)
            if look is None:
                bare = _bare_numbers(t)
                look = bare[0] if bare else None
            if look is None:
                raise ParseError("A breakout needs a length, like \"its 48 hour high\". " + UNSUPPORTED_HINT)
            rule = {"type": "breakout", "lookback": look}
            exit_len = _near(lengths, t, r"\blows?\b|lowest")
            if exit_len is not None and exit_len != look:
                rule["exit_lookback"] = exit_len
            return validate_rule(rule)

        if is_cross:
            nums = _ordered_lengths(t)
            if len(nums) >= 2:
                fast, slow = sorted(nums[:2])
                if fast == slow:
                    raise ParseError("The two averages need different lengths.")
                return validate_rule({"type": "ma_cross", "fast": fast, "slow": slow})
            if len(nums) == 1 and re.search(r"\bprice\b|closes?\b", t):
                return validate_rule({"type": "ma_cross", "fast": 1, "slow": nums[0]})
            raise ParseError(
                "An average cross needs two lengths, like \"the 10 hour average crosses above the 40 hour average\"."
            )

        if is_dip:
            raise ParseError("A dip buy needs a size, like \"drops 2% below its 24 hour average\".")
    except RuleError as e:
        if isinstance(e, ParseError):
            raise
        raise ParseError(str(e)) from None

    raise ParseError("I couldn't find a rule in that. " + UNSUPPORTED_HINT)
