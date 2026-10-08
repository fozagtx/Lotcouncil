"""The three rule types the court understands, and how they turn prices into positions.

A rule is a small dict: ``{"type": ..., <numbers>}``. Every rule is long-only:
the position is 1 (holding the token) or 0 (in cash). Lengths are counted in
candles, which are hours in this app.

Positions never look ahead: the decision made at the close of candle ``t`` is
held during candle ``t + 1``.
"""

from __future__ import annotations

import math

import numpy as np

RULE_TYPES = ("ma_cross", "breakout", "dip_buy")

# name -> (kind, min, max, default). A default of None means "required".
PARAMS: dict[str, dict[str, tuple[type, float, float, float | None]]] = {
    "ma_cross": {
        "fast": (int, 1, 2000, None),  # 1 = the price itself
        "slow": (int, 3, 4000, None),
    },
    "breakout": {
        "lookback": (int, 3, 4000, None),
        "exit_lookback": (int, 2, 4000, -1),  # -1: half of lookback
    },
    "dip_buy": {
        "lookback": (int, 3, 4000, 24),
        "drop_pct": (float, 0.1, 50.0, None),
        "max_hold": (int, 1, 4000, 48),
    },
}

TYPE_LABELS = {
    "ma_cross": "Average cross",
    "breakout": "Breakout",
    "dip_buy": "Dip buy",
}


class RuleError(ValueError):
    """The rule is not one the court can run. The message is shown to the user."""


def _hours(n: int) -> str:
    if n % 24 == 0 and n >= 48:
        return f"{n // 24}-day"
    return f"{n}-hour"


def validate_rule(raw: object) -> dict:
    """Check a rule and return a clean copy with defaults filled in.

    Unknown types, unknown fields, and out-of-range numbers are rejected.
    """
    if not isinstance(raw, dict):
        raise RuleError("A rule must be an object with a type and its numbers.")
    rtype = raw.get("type")
    if rtype not in PARAMS:
        raise RuleError(
            "The court only knows three kinds of idea: an average cross, a breakout, or a dip buy."
        )
    spec = PARAMS[rtype]
    extra = set(raw) - set(spec) - {"type"}
    if extra:
        raise RuleError(f"Unknown setting for a {TYPE_LABELS[rtype].lower()}: {', '.join(sorted(extra))}.")

    rule: dict = {"type": rtype}
    for name, (kind, lo, hi, default) in spec.items():
        value = raw.get(name)
        if value is None:
            if default is None:
                raise RuleError(f"A {TYPE_LABELS[rtype].lower()} needs a value for {name.replace('_', ' ')}.")
            value = default
        if isinstance(value, bool):
            raise RuleError(f"{name.replace('_', ' ').capitalize()} must be a number.")
        try:
            num = float(value)
        except (TypeError, ValueError):
            raise RuleError(f"{name.replace('_', ' ').capitalize()} must be a number.") from None
        if not math.isfinite(num):
            raise RuleError(f"{name.replace('_', ' ').capitalize()} must be a real number.")
        if kind is int:
            if abs(num - round(num)) > 1e-9:
                raise RuleError(f"{name.replace('_', ' ').capitalize()} must be a whole number of hours.")
            num = int(round(num))
        else:
            num = round(num, 4)
        if name == "exit_lookback" and num == -1:
            num = max(2, int(rule["lookback"]) // 2)
        if not (lo <= num <= hi):
            raise RuleError(
                f"{name.replace('_', ' ').capitalize()} must be between {lo:g} and {hi:g}, not {num:g}."
            )
        rule[name] = num

    if rtype == "ma_cross" and rule["fast"] >= rule["slow"]:
        raise RuleError("The fast average must be shorter than the slow average.")
    return rule


def describe_rule(rule: dict) -> str:
    """One plain sentence describing what the rule does."""
    t = rule["type"]
    if t == "ma_cross":
        fast = "price" if rule["fast"] == 1 else f"{_hours(rule['fast'])} average price"
        return (
            f"Hold the token while its {fast} is above its {_hours(rule['slow'])} average; "
            "otherwise stay in cash."
        )
    if t == "breakout":
        return (
            f"Buy when the price closes above its highest close of the previous {_hours(rule['lookback'])} "
            f"window; sell when it closes below the lowest close of the previous {_hours(rule['exit_lookback'])} window."
        )
    if t == "dip_buy":
        return (
            f"Buy when the price falls {rule['drop_pct']:g}% below its {_hours(rule['lookback'])} average; "
            f"sell when it gets back to that average or after {rule['max_hold']} hours, whichever comes first."
        )
    raise RuleError("Unknown rule type.")


def warmup(rule: dict) -> int:
    """Candles a rule needs before it can make its first decision."""
    t = rule["type"]
    if t == "ma_cross":
        return rule["slow"]
    if t == "breakout":
        return max(rule["lookback"], rule["exit_lookback"]) + 1
    return rule["lookback"]


def _sma(x: np.ndarray, n: int) -> np.ndarray:
    out = np.full(len(x), np.nan)
    if n <= len(x):
        c = np.cumsum(np.insert(x, 0, 0.0))
        out[n - 1 :] = (c[n:] - c[:-n]) / n
    return out


def _prev_extreme(x: np.ndarray, n: int, fn) -> np.ndarray:
    """fn (max/min) over the n candles before each candle (not including it)."""
    out = np.full(len(x), np.nan)
    if n < len(x):
        windows = np.lib.stride_tricks.sliding_window_view(x[:-1], n)
        out[n:] = fn(windows, axis=1)
    return out


def signals(rule: dict, close: np.ndarray) -> np.ndarray:
    """Desired position (0 or 1) decided at the close of each candle."""
    close = np.asarray(close, dtype=float)
    n = len(close)
    t = rule["type"]
    sig = np.zeros(n, dtype=np.int8)

    if t == "ma_cross":
        fast = _sma(close, rule["fast"])
        slow = _sma(close, rule["slow"])
        ok = ~np.isnan(slow)
        sig[ok] = (fast[ok] > slow[ok]).astype(np.int8)
        return sig

    if t == "breakout":
        hi = _prev_extreme(close, rule["lookback"], np.max)
        lo = _prev_extreme(close, rule["exit_lookback"], np.min)
        holding = 0
        for i in range(n):
            if np.isnan(hi[i]) or np.isnan(lo[i]):
                continue
            if not holding and close[i] > hi[i]:
                holding = 1
            elif holding and close[i] < lo[i]:
                holding = 0
            sig[i] = holding
        return sig

    if t == "dip_buy":
        avg = _sma(close, rule["lookback"])
        trigger = 1.0 - rule["drop_pct"] / 100.0
        holding = 0
        held = 0
        for i in range(n):
            if np.isnan(avg[i]):
                continue
            if not holding:
                if close[i] <= avg[i] * trigger:
                    holding, held = 1, 0
            else:
                held += 1
                if close[i] >= avg[i] or held >= rule["max_hold"]:
                    holding = 0
            sig[i] = holding
        return sig

    raise RuleError("Unknown rule type.")


def positions(rule: dict, close: np.ndarray) -> np.ndarray:
    """Position held during each candle: yesterday's signal, so there is no look-ahead."""
    sig = signals(rule, close)
    pos = np.zeros(len(sig), dtype=float)
    pos[1:] = sig[:-1]
    return pos
