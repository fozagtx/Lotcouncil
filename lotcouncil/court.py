"""The court: three fixed tests and a ruling.

This module is the only place a verdict is set. It is plain, deterministic code:
the same candles, rule, fee and settings always give the same ruling. Nothing
in here calls an AI model.

Tests (an idea must pass all three, after the trade-count gate):

* A. Unseen data   - split 60/40; the score on the last 40% must be above 0.5.
* B. Random timing - 500 copies hold the same positions in shuffled 24-hour
                     blocks; the real result must beat at least 95% of them.
* C. Stress        - the score with fees tripled must be above 0, and losses on
                     weekend candles must be under half the total result.

"Score" is the mean candle return divided by its standard deviation, scaled to
a year (an annualised Sharpe ratio with no risk-free rate).
"""

from __future__ import annotations

import math
from collections.abc import Iterator
from dataclasses import dataclass

import numpy as np
import pandas as pd

from . import COURT_VERSION
from .rules import RuleError, describe_rule, positions, validate_rule, warmup

SEED = 20261007

DEFAULT_THRESHOLDS: dict[str, float] = {
    "min_candles": 500,
    "min_trades": 10,
    "split": 0.60,
    "unseen_score_min": 0.5,
    "copies": 500,
    "block_hours": 24,
    "beat_share_min": 0.95,
    "stress_fee_mult": 3.0,
    "stress_score_min": 0.0,
    "weekend_loss_max_share": 0.5,
}

# Allowed range for each setting, so a hand-edited audit file cannot ask for
# absurd work (a billion shuffles) or a meaningless test.
THRESHOLD_BOUNDS: dict[str, tuple[float, float]] = {
    "min_candles": (100, 100_000),
    "min_trades": (1, 10_000),
    "split": (0.3, 0.9),
    "unseen_score_min": (-100, 100),
    "copies": (20, 5_000),
    "block_hours": (1, 24 * 14),
    "beat_share_min": (0.5, 0.999),
    "stress_fee_mult": (1, 20),
    "stress_score_min": (-100, 100),
    "weekend_loss_max_share": (0, 1),
}
MAX_CANDLES = 20_000

DEFAULT_FEE = 0.001
FEE_CHOICES = (0.0005, 0.001, 0.002)

TEST_INFO = {
    "A": {"name": "Unseen data", "question": "Does it work on data it never saw?"},
    "B": {"name": "Random timing", "question": "Is the timing better than chance?"},
    "C": {"name": "Stress", "question": "Does it survive a worse world?"},
}


class CourtError(ValueError):
    """The court cannot rule on this input. The message is shown to the user."""


@dataclass(frozen=True)
class Market:
    """Cleaned candles the court runs on. Times are candle open times in ms (UTC)."""

    time: np.ndarray
    close: np.ndarray

    @property
    def bar_seconds(self) -> float:
        return float(np.median(np.diff(self.time))) / 1000.0

    @property
    def bars_per_year(self) -> float:
        return 365.25 * 86400.0 / self.bar_seconds


def market_from_frame(df: pd.DataFrame) -> Market:
    if "time" not in df or "close" not in df:
        raise CourtError("The price data is missing its time or close column.")
    return Market(time=df["time"].to_numpy(dtype=np.int64), close=df["close"].to_numpy(dtype=float))


def score(returns: np.ndarray, bars_per_year: float) -> float:
    """Annualised mean/stdev of candle returns. 0 when there is no movement."""
    r = np.asarray(returns, dtype=float)
    if r.size < 2:
        return 0.0
    sd = r.std(ddof=1)
    if not np.isfinite(sd) or sd < 1e-12:
        return 0.0
    return float(r.mean() / sd * math.sqrt(bars_per_year))


def _score_rows(r: np.ndarray, bars_per_year: float) -> np.ndarray:
    """score() for every row of a 2-D array."""
    sd = r.std(axis=1, ddof=1)
    mean = r.mean(axis=1)
    out = np.zeros(r.shape[0])
    ok = sd > 1e-12
    out[ok] = mean[ok] / sd[ok] * math.sqrt(bars_per_year)
    return out


def weekend_mask(time_ms: np.ndarray) -> np.ndarray:
    """True for candles that open while the US stock market is shut for the weekend.

    The native US session runs 24/5 from Sunday 20:00 to Friday 20:00 New York
    time. Outside that window, tokenized-stock prices come from a market maker.
    """
    ts = pd.to_datetime(time_ms, unit="ms", utc=True).tz_convert("America/New_York")
    dow = np.asarray(ts.dayofweek)  # Monday=0
    hour = np.asarray(ts.hour)
    return (dow == 5) | ((dow == 4) & (hour >= 20)) | ((dow == 6) & (hour < 20))


def weekend_check(total: float, weekend_result: float, max_share: float) -> tuple[bool, float]:
    """Is the weekend loss under max_share of the total result? Returns (ok, loss share).

    A weekend gain always passes. A weekend loss with no overall profit fails
    (its share is reported as infinity).
    """
    loss = max(0.0, -weekend_result)
    if loss == 0:
        return True, 0.0
    if total > 0:
        return loss / total < max_share, loss / total
    return False, float("inf")


def count_trades(pos: np.ndarray) -> int:
    """Number of entries (cash -> holding)."""
    prev = np.concatenate(([0.0], pos[:-1]))
    return int(np.sum((pos > 0) & (prev == 0)))


def _r(x: float, nd: int = 3) -> float:
    return float(round(x, nd)) if np.isfinite(x) else 0.0


def _pct(x: float, nd: int = 2) -> float:
    return _r(100.0 * x, nd)


def _fmt_score(x: float) -> str:
    return f"{x:.2f}"


def _fmt_pct(x: float) -> str:
    """Percent with enough digits to be honest about small numbers."""
    if abs(x) >= 10:
        return f"{x:.0f}%"
    if abs(x) >= 1:
        return f"{x:.1f}%"
    return f"{x:.2f}%"


def _resolve(thresholds: dict | None) -> dict:
    th = dict(DEFAULT_THRESHOLDS)
    if thresholds:
        unknown = set(thresholds) - set(th)
        if unknown:
            raise CourtError(f"Unknown court setting: {', '.join(sorted(unknown))}.")
        for k, v in thresholds.items():
            try:
                val = float(v)
            except (TypeError, ValueError):
                raise CourtError(f"Court setting {k} must be a number.") from None
            lo, hi = THRESHOLD_BOUNDS[k]
            if not (lo <= val <= hi):
                raise CourtError(f"Court setting {k} must be between {lo:g} and {hi:g}.")
            th[k] = val
    return th


def iter_court(
    market: Market,
    rule: dict,
    fee: float = DEFAULT_FEE,
    thresholds: dict | None = None,
    seed: int = SEED,
) -> Iterator[tuple[str, dict]]:
    """Run the court step by step, yielding (stage, payload) as each part finishes.

    Stages, in order: "gate", "A", "B", "C", "verdict". When the gate fails the
    tests are skipped and the next stage is "verdict". The "verdict" payload is
    the full ruling (see run_court).
    """
    th = _resolve(thresholds)
    try:
        rule = validate_rule(rule)
    except RuleError as e:
        raise CourtError(str(e)) from None
    if not (0 <= fee < 0.05):
        raise CourtError("The fee must be between 0% and 5% per position change.")

    close = np.asarray(market.close, dtype=float)
    time = np.asarray(market.time, dtype=np.int64)
    n = len(close)
    if n > MAX_CANDLES:
        raise CourtError(f"That is {n} candles; the court judges at most {MAX_CANDLES} at a time.")
    if n < th["min_candles"]:
        raise CourtError(
            f"Only {n} candles are available here; the court needs at least {int(th['min_candles'])} to judge. "
            "Pick a longer time window or another token."
        )
    if not np.all(np.isfinite(close)) or np.any(close <= 0):
        raise CourtError("The price data has missing or non-positive prices, so the court cannot use it.")
    if np.any(np.diff(time) <= 0):
        raise CourtError("The candles are out of order or repeated, so the court cannot use them.")
    if warmup(rule) > n // 2:
        raise CourtError(
            f"This rule needs {warmup(rule)} candles before its first decision, which is more than half "
            f"of the {n} candles available. Use shorter lengths or a longer window."
        )

    bpy = market.bars_per_year
    ret = np.zeros(n)
    ret[1:] = close[1:] / close[:-1] - 1.0
    pos = positions(rule, close)
    changes = np.abs(np.diff(np.concatenate(([0.0], pos))))
    gross = pos * ret
    net = gross - fee * changes
    trades = count_trades(pos)

    # Gate
    min_trades = int(th["min_trades"])
    gate_ok = trades >= min_trades
    gate = {
        "passed": gate_ok,
        "trades": trades,
        "min_trades": min_trades,
        "sentence": (
            f"It made {trades} trades, enough to judge (at least {min_trades} are needed)."
            if gate_ok
            else f"It never traded; the court needs at least {min_trades} trades to judge."
            if trades == 0
            else f"It made only {trades} trade{'s' if trades != 1 else ''}; the court needs at least {min_trades} to judge."
        ),
    }
    yield "gate", gate

    tests: dict[str, dict] = {}
    copy_scores = np.zeros(0)
    split = int(n * th["split"])
    stress_net = gross - fee * th["stress_fee_mult"] * changes

    if gate_ok:
        # A. Unseen data
        s_unseen = score(net[split:], bpy)
        s_seen = score(net[:split], bpy)
        a_ok = s_unseen > th["unseen_score_min"]
        unseen_pct = 100 * (1 - th["split"])
        tests["A"] = {
            **TEST_INFO["A"],
            "passed": bool(a_ok),
            "score_unseen": _r(s_unseen),
            "score_seen": _r(s_seen),
            "threshold": th["unseen_score_min"],
            "trades_unseen": count_trades(pos[split:]),
            "return_unseen_pct": _pct(np.prod(1 + net[split:]) - 1),
            "unseen_share_pct": _r(unseen_pct, 0),
            "sentence": (
                f"On the last {unseen_pct:.0f}% of the history, which it never saw, it scored "
                f"{_fmt_score(s_unseen)}, above the {th['unseen_score_min']:g} it needs."
                if a_ok
                else f"On the last {unseen_pct:.0f}% of the history, which it never saw, it scored only "
                f"{_fmt_score(s_unseen)}; it needs more than {th['unseen_score_min']:g}."
            ),
        }
        yield "A", tests["A"]

        # B. Random timing (gross returns: fees are judged in test C, and shuffling
        # adds trades at block edges that would unfairly charge the copies more).
        block = max(1, int(round(th["block_hours"] * 3600 / market.bar_seconds)))
        starts = np.arange(0, n, block)
        blocks = [np.arange(s, min(s + block, n)) for s in starts]
        rng = np.random.default_rng(seed)
        copies = int(th["copies"])
        copy_scores = np.empty(copies)
        chunk = 100
        for c0 in range(0, copies, chunk):
            rows = min(chunk, copies - c0)
            idx = np.empty((rows, n), dtype=np.int64)
            for j in range(rows):
                idx[j] = np.concatenate([blocks[k] for k in rng.permutation(len(blocks))])
            copy_scores[c0 : c0 + rows] = _score_rows(pos[idx] * ret, bpy)
        s_real = score(gross, bpy)
        beat = float(np.mean(copy_scores < s_real))
        b_ok = beat >= th["beat_share_min"]
        tests["B"] = {
            **TEST_INFO["B"],
            "passed": bool(b_ok),
            "score_real": _r(s_real),
            "beat_share_pct": _r(100 * beat, 1),
            "threshold_pct": _r(100 * th["beat_share_min"], 1),
            "copies": copies,
            "block_hours": _r(th["block_hours"], 0),
            "copy_score_median": _r(float(np.median(copy_scores))),
            "copy_score_p95": _r(float(np.quantile(copy_scores, th["beat_share_min"]))),
            "sentence": (
                f"Its timing beat {_fmt_pct(100 * beat)} of {copies} random-timing copies; "
                f"it needed {_fmt_pct(100 * th['beat_share_min'])}."
                if b_ok
                else f"Its timing beat only {_fmt_pct(100 * beat)} of {copies} random-timing copies; "
                f"it needs at least {_fmt_pct(100 * th['beat_share_min'])}."
            ),
        }
        yield "B", tests["B"]

        # C. Stress: tripled fees, and weekend candles on their own.
        s_stress = score(stress_net, bpy)
        fee_ok = s_stress > th["stress_score_min"]
        wk = weekend_mask(time)
        total = float(net.sum())
        wk_result = float(net[wk].sum())
        wk_loss = max(0.0, -wk_result)
        wk_ok, wk_share = weekend_check(total, wk_result, th["weekend_loss_max_share"])
        c_ok = fee_ok and wk_ok
        mult = th["stress_fee_mult"]
        if fee_ok:
            fee_part = f"With fees at {mult:g}x it still scored {_fmt_score(s_stress)}"
        else:
            fee_part = f"With fees at {mult:g}x its score fell to {_fmt_score(s_stress)}, not above {th['stress_score_min']:g}"
        if wk_loss == 0:
            wk_part = "weekend candles did not lose money"
        elif total > 0:
            wk_part = (
                f"weekend candles lost {_fmt_pct(100 * wk_loss)}, "
                f"{'under' if wk_ok else 'more than'} half of the {_fmt_pct(100 * total)} total result"
            )
        else:
            wk_part = f"weekend candles lost {_fmt_pct(100 * wk_loss)} with no overall profit to absorb it"
        tests["C"] = {
            **TEST_INFO["C"],
            "passed": bool(c_ok),
            "fee_passed": bool(fee_ok),
            "weekend_passed": bool(wk_ok),
            "score_base": _r(score(net, bpy)),
            "score_stress": _r(s_stress),
            "fee_pct": _r(100 * fee, 3),
            "stress_fee_pct": _r(100 * fee * mult, 3),
            "stress_fee_mult": mult,
            "total_result_pct": _pct(total),
            "weekend_result_pct": _pct(wk_result),
            "weekend_loss_share_pct": _r(100 * wk_share, 1) if np.isfinite(wk_share) else None,
            "weekend_loss_max_share_pct": _r(100 * th["weekend_loss_max_share"], 0),
            "weekend_candles": int(wk.sum()),
            "sentence": f"{fee_part}, and {wk_part}.",
        }
        yield "C", tests["C"]

    passed = gate_ok and all(t["passed"] for t in tests.values())
    reasons = []
    if not gate_ok:
        reasons.append(gate["sentence"])
    for key in ("A", "B", "C"):
        if key in tests and not tests[key]["passed"]:
            reasons.append(tests[key]["sentence"])

    if passed:
        headline = "Not obviously luck on this history."
    elif not gate_ok:
        headline = "Too few trades to judge."
    elif not tests["A"]["passed"]:
        headline = "It does not hold up on data it never saw."
    elif not tests["B"]["passed"]:
        headline = "Its timing is no better than chance."
    elif not tests["C"]["fee_passed"]:
        headline = "It does not survive higher fees."
    else:
        headline = "Weekend prices eat too much of the result."

    buy_hold = close[-1] / close[0] - 1
    ruling = {
        "verdict": "PASS" if passed else "FAIL",
        "headline": headline,
        "reasons": reasons,
        "rule": rule,
        "rule_text": describe_rule(rule),
        "gate": gate,
        "tests": tests,
        "stats": {
            "candles": n,
            "start": int(time[0]),
            "end": int(time[-1]),
            "trades": trades,
            "time_in_market_pct": _r(100 * float(pos.mean()), 1),
            "total_return_pct": _pct(np.prod(1 + net) - 1),
            "buy_hold_return_pct": _pct(buy_hold),
            "score": _r(score(net, bpy)),
            "split_index": split,
            "split_time": int(time[split]),
        },
        "settings": {
            "fee": fee,
            "thresholds": th,
            "seed": seed,
            "court_version": COURT_VERSION,
        },
        "series": {
            "time": time,
            "close": close,
            "position": pos,
            "equity": np.cumprod(1 + net) - 1,
            "equity_stress": np.cumprod(1 + stress_net) - 1,
            "copy_scores": copy_scores,
            "weekend": weekend_mask(time) if gate_ok else None,
        },
    }
    yield "verdict", ruling


def run_court(
    market: Market,
    rule: dict,
    fee: float = DEFAULT_FEE,
    thresholds: dict | None = None,
    seed: int = SEED,
) -> dict:
    """Run every stage and return the full ruling."""
    ruling: dict = {}
    for stage, payload in iter_court(market, rule, fee=fee, thresholds=thresholds, seed=seed):
        if stage == "verdict":
            ruling = payload
    return ruling


def public_ruling(ruling: dict) -> dict:
    """The ruling without its heavy chart series (safe to log, hash, or hand to an agent)."""
    return {k: v for k, v in ruling.items() if k != "series"}
