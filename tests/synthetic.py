"""Made-up price series for the tests only (the app never uses them).

Both series are fully determined by their seed.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

HOUR_MS = 3_600_000
# Fixed so test rulings never change: candles end 2026-10-01 00:00 UTC.
END_MS = 1_790_812_800_000
SERIES_DAYS = 180


def _frame(time_ms: np.ndarray, close: np.ndarray, rng: np.random.Generator, vol: float) -> pd.DataFrame:
    open_ = np.concatenate(([close[0]], close[:-1]))
    wiggle = np.abs(rng.normal(0, vol / 2, size=(2, len(close))))
    high = np.maximum(open_, close) * (1 + wiggle[0])
    low = np.minimum(open_, close) * (1 - wiggle[1])
    return pd.DataFrame(
        {
            "time": time_ms.astype(np.int64),
            "open": np.round(open_, 4),
            "high": np.round(high, 4),
            "low": np.round(low, 4),
            "close": np.round(close, 4),
        }
    )


def random_walk(
    n: int = SERIES_DAYS * 24,
    seed: int = 12,
    vol: float = 0.0035,
    start_price: float = 180.0,
    end_ms: int = END_MS,
) -> pd.DataFrame:
    """Hourly prices with no edge at all: independent returns, zero drift."""
    rng = np.random.default_rng(seed)
    r = rng.normal(0.0, vol, n)
    close = start_price * np.exp(np.cumsum(r) - 0.5 * vol**2 * np.arange(1, n + 1))
    time_ms = end_ms - HOUR_MS * np.arange(n, 0, -1)
    return _frame(time_ms, close, rng, vol)


def trending(
    n: int = SERIES_DAYS * 24,
    seed: int = 23,
    vol: float = 0.0035,
    persistence: float = 0.995,
    drift_vol: float = 0.00005,
    start_price: float = 240.0,
    end_ms: int = END_MS,
) -> pd.DataFrame:
    """Hourly prices with a planted edge: the drift wanders slowly, so trends persist.

    A trend-following rule has a real (made-up) advantage here.
    """
    rng = np.random.default_rng(seed)
    drift = np.zeros(n)
    shocks = rng.normal(0.0, drift_vol, n)
    for i in range(1, n):
        drift[i] = persistence * drift[i - 1] + shocks[i]
    r = drift + rng.normal(0.0, vol, n)
    close = start_price * np.exp(np.cumsum(r))
    time_ms = end_ms - HOUR_MS * np.arange(n, 0, -1)
    return _frame(time_ms, close, rng, vol)


def clustered_walk(
    n: int = SERIES_DAYS * 24,
    seed: int = 1,
    vol: float = 0.0035,
    start_price: float = 180.0,
    end_ms: int = END_MS,
) -> pd.DataFrame:
    """No-edge prices that look more like real ones: fat tails and calm/busy spells.

    Returns are unpredictable (zero drift), but their size clusters, as it does in
    real markets. Used to check that the court is not fooled by volatility alone.
    """
    rng = np.random.default_rng(seed)
    omega, alpha, beta = vol**2 * 0.05, 0.08, 0.87
    shocks = rng.standard_t(4, n) / np.sqrt(2.0)  # unit variance
    var = np.full(n, vol**2)
    r = np.zeros(n)
    for i in range(n):
        if i:
            var[i] = omega + alpha * r[i - 1] ** 2 + beta * var[i - 1]
        r[i] = np.sqrt(var[i]) * shocks[i]
    close = start_price * np.exp(np.cumsum(r - r.mean()))
    time_ms = end_ms - HOUR_MS * np.arange(n, 0, -1)
    return _frame(time_ms, close, rng, vol)
