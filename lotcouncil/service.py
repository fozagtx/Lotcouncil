"""Glue between the court, the data and the AI helper.

The web server, the MCP tool and the command line all go through this module,
so they share one path from idea to ruling. The verdict always comes from
``court.iter_court``; the AI only adds a rule reading and an explanation.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator

import numpy as np
import pandas as pd

from .ai import AIHelper
from .audit import _plain, build_audit
from .court import DEFAULT_FEE, FEE_CHOICES, TEST_INFO, CourtError, iter_court, market_from_frame, public_ruling
from .data import DEFAULT_DAYS, TOKEN_NAMES, WINDOWS_DAYS, CandleStore, DataError, token_label, token_list
from .parse import ParseError
from .rules import RuleError, describe_rule, validate_rule

log = logging.getLogger("lotcouncil.service")
MAX_POINTS = 720


def snap_fee(fee: float) -> float:
    """Match a requested fee to one of the allowed choices (or refuse it)."""
    for choice in FEE_CHOICES:
        if abs(float(fee) - choice) < 1e-9:
            return choice
    raise CourtError("Pick a fee of 0.05%, 0.10% or 0.20% per position change.")


def _thin(n: int, max_points: int = MAX_POINTS) -> np.ndarray:
    """Indices that keep a long series under max_points while keeping the last point."""
    step = max(1, int(np.ceil(n / max_points)))
    idx = np.arange(0, n, step)
    if idx[-1] != n - 1:
        idx = np.append(idx, n - 1)
    return idx


def _holding_spans(time_s: np.ndarray, pos: np.ndarray) -> list[list[int]]:
    """[[start, end], ...] times (seconds) of each stretch in which the rule held the token."""
    spans = []
    start = None
    for i, p in enumerate(pos):
        if p > 0 and start is None:
            start = i
        elif p == 0 and start is not None:
            spans.append([int(time_s[start - 1] if start else time_s[start]), int(time_s[i - 1])])
            start = None
    if start is not None:
        spans.append([int(time_s[start - 1] if start else time_s[start]), int(time_s[-1])])
    return spans


CANDLE_HOURS = (1, 2, 4, 6, 12, 24)
MAX_CANDLES = 150
HOUR_S = 3600


def candles_payload(df: pd.DataFrame) -> dict:
    """Hourly candles merged into wider ones (aligned to UTC clock hours) so a chart shows at most ~150."""
    n = len(df)
    hours = next((h for h in CANDLE_HOURS if n / h <= MAX_CANDLES), CANDLE_HOURS[-1])
    bucket = df["time"].to_numpy(dtype=np.int64) // (hours * HOUR_S * 1000)
    g = df.assign(bucket=bucket).groupby("bucket", sort=True)
    agg = g.agg(time=("time", "first"), open=("open", "first"), high=("high", "max"), low=("low", "min"), close=("close", "last"))
    return {
        "hours": hours,
        "time": (agg["time"].to_numpy(dtype=np.int64) // 1000).tolist(),
        "open": np.round(agg["open"].to_numpy(dtype=float), 4).tolist(),
        "high": np.round(agg["high"].to_numpy(dtype=float), 4).tolist(),
        "low": np.round(agg["low"].to_numpy(dtype=float), 4).tolist(),
        "close": np.round(agg["close"].to_numpy(dtype=float), 4).tolist(),
    }


def trade_list(ruling: dict) -> list[dict]:
    """Every round trip the rule made: bought at the close before its first held candle, sold at the
    close of its last one. The return includes both fees."""
    s = ruling["series"]
    pos, close, net = s["position"], s["close"], s["net"]
    time_s = np.asarray(s["time"]) // 1000
    n = len(pos)
    split = ruling["stats"]["split_index"]
    trades: list[dict] = []
    i = 0
    while i < n:
        if pos[i] > 0 and (i == 0 or pos[i - 1] == 0):
            j = i
            while j + 1 < n and pos[j + 1] > 0:
                j += 1
            last = j + 1 if j + 1 < n else j  # the candle after the last held one carries the exit fee
            ret = float(np.prod(1 + net[i : last + 1]) - 1)
            entry = i - 1 if i > 0 else i
            trades.append(
                {
                    "n": len(trades) + 1,
                    "entry_time": int(time_s[i]),
                    "exit_time": int(time_s[j] + HOUR_S),
                    "entry_price": round(float(close[entry]), 4),
                    "exit_price": round(float(close[j]), 4),
                    "hours": int(j - i + 1),
                    "return_pct": round(100 * ret, 3),
                    "open": bool(j == n - 1),
                    "part": "unseen" if i >= split else "seen",
                }
            )
            i = j + 1
        else:
            i += 1
    return trades


def chart_payload(ruling: dict, df: pd.DataFrame | None = None) -> dict:
    s = ruling["series"]
    time_s = (np.asarray(s["time"]) // 1000).astype(np.int64)
    idx = _thin(len(time_s))
    payload = {
        "time": time_s[idx].tolist(),
        "close": np.round(s["close"][idx], 4).tolist(),
        "equity_pct": np.round(100 * s["equity"][idx], 3).tolist(),
        "equity_stress_pct": np.round(100 * s["equity_stress"][idx], 3).tolist(),
        "holding": _holding_spans(time_s, s["position"]),
        "split_time": int(ruling["stats"]["split_time"] // 1000),
        "copy_scores": np.round(s["copy_scores"], 3).tolist(),
        "trades": trade_list(ruling),
    }
    if df is not None:
        payload["candles"] = candles_payload(df)
    return payload


class CourtService:
    def __init__(self, store: CandleStore | None = None, ai: AIHelper | None = None):
        self.store = store or CandleStore()
        self.ai = ai or AIHelper()

    # ---- listings -------------------------------------------------------
    def markets(self) -> dict:
        tokens = [{"symbol": s, "label": token_label(s), "name": TOKEN_NAMES.get(s, "")} for s in token_list()]
        return {
            "tokens": tokens,
            "windows_days": list(WINDOWS_DAYS),
            "default_days": DEFAULT_DAYS,
            "fees_pct": [round(100 * f, 3) for f in FEE_CHOICES],
            "default_fee_pct": round(100 * DEFAULT_FEE, 3),
            "tests": TEST_INFO,
            "ai_enabled": self.ai.enabled,
            "ai_model": self.ai.model if self.ai.enabled else None,
        }

    def prices(self, symbol: str, days: int) -> dict:
        df, info = self.store.window(symbol, days)
        time_s = (df["time"].to_numpy() // 1000).astype(np.int64)
        idx = _thin(len(time_s))
        return {"market": info, "time": time_s[idx].tolist(), "close": df["close"].to_numpy()[idx].round(4).tolist()}

    # ---- understanding --------------------------------------------------
    def understand(self, idea: str, allow_ai: bool = True) -> dict:
        return self.ai.understand(idea, allow_ai=allow_ai)

    # ---- judging --------------------------------------------------------
    def judge_events(
        self,
        *,
        symbol: str,
        days: int,
        rule: dict | None = None,
        idea: str = "",
        fee: float = DEFAULT_FEE,
        end_ms: int | None = None,
        allow_ai: bool = True,
        explain: bool = True,
    ) -> Iterator[dict]:
        """Yield progress events, ending with the verdict and (optionally) the explanation.

        Errors become a single {"stage": "error"} event with a plain message, so a
        bad idea or bad data never breaks the page.
        """
        try:
            fee = snap_fee(fee)
            parsed_by = "user"
            notice = None
            if rule is None:
                reading = self.understand(idea, allow_ai=allow_ai)
                rule, parsed_by, notice = reading["rule"], reading["source"], reading["notice"]
                yield {"stage": "understood", "rule": rule, "rule_text": reading["rule_text"], "source": parsed_by, "notice": notice}
            else:
                rule = validate_rule(rule)
            df, market = self.store.window(symbol, int(days), end_ms=end_ms)
            yield {"stage": "data", "market": market}

            ruling = None
            for stage, payload in iter_court(market_from_frame(df), rule, fee=fee):
                if stage == "verdict":
                    ruling = payload
                elif stage == "gate":
                    yield {"stage": "gate", "gate": _plain(payload)}
                else:
                    yield {"stage": stage, "test": _plain(payload)}

            public = _plain(public_ruling(ruling))
            yield {
                "stage": "verdict",
                "ruling": public,
                "chart": chart_payload(ruling, df),
                "market": market,
                "request": {
                    "symbol": symbol,
                    "days": int(days),
                    "end": market["end"],
                    "rule": rule,
                    "fee": fee,
                    "idea": idea,
                    "parsed_by": parsed_by,
                },
            }
            if explain:
                yield {"stage": "explanation", "explanation": self.ai.explain(idea or describe_rule(rule), ruling, market, allow_ai=allow_ai)}
        except (CourtError, DataError, ParseError, RuleError) as e:
            yield {"stage": "error", "message": str(e)}
        except Exception:  # never leave the page hanging on an unexpected failure
            log.exception("judge failed")
            yield {"stage": "error", "message": "Something went wrong on the court's server. Try again in a moment."}

    def judge(self, **kwargs) -> dict:
        """Run to completion and return one result dict (used by the agent tool and CLI)."""
        result: dict = {}
        for ev in self.judge_events(**kwargs):
            stage = ev["stage"]
            if stage == "error":
                return {"ok": False, "error": ev["message"]}
            if stage == "understood":
                result["understood"] = {k: ev[k] for k in ("rule", "rule_text", "source", "notice")}
            elif stage == "verdict":
                result.update({"ok": True, "ruling": ev["ruling"], "market": ev["market"], "request": ev["request"]})
            elif stage == "explanation":
                result["explanation"] = ev["explanation"]
        return result

    def audit(
        self,
        *,
        symbol: str,
        days: int,
        end_ms: int,
        rule: dict,
        fee: float,
        idea: str = "",
        parsed_by: str = "user",
        explanation: dict | None = None,
    ) -> dict:
        fee = snap_fee(fee)
        rule = validate_rule(rule)
        df, market = self.store.window(symbol, int(days), end_ms=end_ms)
        ruling = None
        for stage, payload in iter_court(market_from_frame(df), rule, fee=fee):
            if stage == "verdict":
                ruling = payload
        return build_audit(
            idea=idea, rule=rule, parsed_by=parsed_by, market=market, candles=df, ruling=ruling, explanation=explanation
        )
