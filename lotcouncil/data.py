"""Price data: Bitget hourly candles for tokenized US stocks, with fallbacks.

Sources, in order of preference for a real token:

1. Bitget's public spot candle endpoints (no API key needed).
2. A saved candle file in ``data/snapshots/<SYMBOL>.csv`` (written by
   ``scripts/fetch_candles.py``), used when Bitget cannot be reached.

Practice markets are made-up series (see ``synthetic.py``) and are always
labelled as such.

Only finished candles are used: the candle that is still forming is dropped,
because its price keeps changing and would make rulings unrepeatable.
"""

from __future__ import annotations

import hashlib
import logging
import os
import threading
import time as _time
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd
import requests

from . import synthetic

log = logging.getLogger("lotcouncil.data")

HOUR_MS = 3_600_000
DAY_MS = 24 * HOUR_MS
COLUMNS = ["time", "open", "high", "low", "close"]

BITGET_BASE = os.environ.get("BITGET_BASE_URL", "https://api.bitget.com").rstrip("/")
CANDLES_PATH = "/api/v2/spot/market/candles"
HISTORY_PATH = "/api/v2/spot/market/history-candles"
# Bitget's v2 spot API spells the hourly size "1h"; older docs use "1H".
GRANULARITIES = ("1h", "1H")
MAX_DAYS = 180
CACHE_SECONDS = 600

SNAPSHOT_DIR = Path(os.environ.get("COURT_SNAPSHOT_DIR", Path(__file__).resolve().parent.parent / "data" / "snapshots"))

TOKEN_NAMES = {
    "rAAPLUSDT": "Apple",
    "rTSLAUSDT": "Tesla",
    "rNVDAUSDT": "Nvidia",
    "rMSFTUSDT": "Microsoft",
    "rGOOGLUSDT": "Alphabet",
    "rAMZNUSDT": "Amazon",
    "rMETAUSDT": "Meta",
    "rCOINUSDT": "Coinbase",
    "rMSTRUSDT": "Strategy",
    "rHOODUSDT": "Robinhood",
}
DEFAULT_TOKENS = ["rAAPLUSDT", "rTSLAUSDT", "rNVDAUSDT", "rMSFTUSDT", "rGOOGLUSDT", "rAMZNUSDT", "rMETAUSDT", "rCOINUSDT"]

PRACTICE = {
    "PRACTICE-TREND": {
        "label": "Practice: trend",
        "name": "Made-up prices with a planted trend",
        "make": synthetic.trending,
    },
    "PRACTICE-RANDOM": {
        "label": "Practice: random",
        "name": "Made-up prices with no edge at all",
        "make": synthetic.random_walk,
    },
}

WINDOWS_DAYS = (30, 60, 90, 180)
DEFAULT_DAYS = 90


class DataError(ValueError):
    """Prices could not be loaded or are unusable. The message is shown to the user."""


def token_list() -> list[str]:
    raw = os.environ.get("COURT_TOKENS", "")
    tokens = [t.strip() for t in raw.split(",") if t.strip()] or list(DEFAULT_TOKENS)
    return tokens


def token_label(symbol: str) -> str:
    if symbol in PRACTICE:
        return PRACTICE[symbol]["label"]
    return symbol[:-4] if symbol.endswith("USDT") else symbol


def clean_candles(df: pd.DataFrame, now_ms: int | None = None, bar_ms: int = HOUR_MS) -> pd.DataFrame:
    """Validate and tidy candles: numeric, sorted, unique times, positive prices, finished only."""
    if not isinstance(df, pd.DataFrame) or df.empty:
        raise DataError("No candles came back for this token.")
    missing = [c for c in ("time", "close") if c not in df.columns]
    if missing:
        raise DataError(f"The price data is missing column(s): {', '.join(missing)}.")
    out = pd.DataFrame({"time": pd.to_numeric(df["time"], errors="coerce")})
    out["close"] = pd.to_numeric(df["close"], errors="coerce")
    for col in ("open", "high", "low"):
        out[col] = pd.to_numeric(df[col], errors="coerce") if col in df.columns else np.nan
    out = out.dropna(subset=["time", "close"])
    out = out[out["close"] > 0]
    if out.empty:
        raise DataError("The price data has no usable prices.")
    out["time"] = out["time"].astype(np.int64)
    out = out.drop_duplicates("time", keep="last").sort_values("time")
    for col in ("open", "high", "low"):
        out[col] = out[col].where(out[col] > 0, out["close"])
    if now_ms is not None:
        out = out[out["time"] + bar_ms <= now_ms]
    if out.empty:
        raise DataError("No finished candles are available yet for this token.")
    return out[COLUMNS].reset_index(drop=True)


def data_hash(df: pd.DataFrame) -> str:
    """Fingerprint of the exact candles judged. Same candles -> same hash, on any machine."""
    h = hashlib.sha256()
    for row in df[COLUMNS].itertuples(index=False):
        h.update(f"{int(row[0])},{float(row[1])!r},{float(row[2])!r},{float(row[3])!r},{float(row[4])!r}\n".encode())
    return "sha256:" + h.hexdigest()


def parse_bitget_rows(rows: list) -> pd.DataFrame:
    """Bitget rows are [time, open, high, low, close, base volume, quote volume, ...] as strings."""
    if not isinstance(rows, list):
        raise DataError("Bitget sent candles in an unexpected format.")
    clean = [r[:5] for r in rows if isinstance(r, (list, tuple)) and len(r) >= 5]
    if not clean:
        return pd.DataFrame(columns=COLUMNS)
    return pd.DataFrame(clean, columns=COLUMNS)


def _get(session: requests.Session, path: str, params: dict, timeout: float) -> list:
    resp = session.get(BITGET_BASE + path, params=params, timeout=timeout)
    try:
        body = resp.json()
    except ValueError:
        raise DataError(f"Bitget answered with HTTP {resp.status_code} and no readable data.") from None
    if not isinstance(body, dict):
        raise DataError("Bitget sent data in an unexpected format.")
    if resp.status_code != 200 or str(body.get("code")) != "00000":
        msg = body.get("msg") or f"HTTP {resp.status_code}"
        raise DataError(f"Bitget refused the request: {msg}")
    return body.get("data") or []


def fetch_bitget(
    symbol: str,
    days: int = MAX_DAYS,
    session: requests.Session | None = None,
    now_ms: int | None = None,
    timeout: float = 10.0,
    max_pages: int = 40,
) -> pd.DataFrame:
    """Download finished hourly candles covering the last ``days`` days (or as many as exist)."""
    session = session or requests.Session()
    now_ms = now_ms if now_ms is not None else int(_time.time() * 1000)
    want_from = now_ms - days * DAY_MS

    last_err: Exception | None = None
    frames: list[pd.DataFrame] = []
    gran = None
    for g in GRANULARITIES:
        try:
            rows = _get(session, CANDLES_PATH, {"symbol": symbol, "granularity": g, "limit": 1000}, timeout)
            frames.append(parse_bitget_rows(rows))
            gran = g
            break
        except DataError as e:
            last_err = e
    if gran is None:
        raise last_err or DataError("Bitget returned no candles.")

    # Page backwards through older candles until the window is covered or history runs out.
    for _ in range(max_pages):
        known = pd.concat(frames)
        if known.empty:
            break
        earliest = int(pd.to_numeric(known["time"]).min())
        if earliest <= want_from:
            break
        rows = _get(
            session,
            HISTORY_PATH,
            {"symbol": symbol, "granularity": gran, "endTime": earliest, "limit": 200},
            timeout,
        )
        older = parse_bitget_rows(rows)
        if older.empty or int(pd.to_numeric(older["time"]).min()) >= earliest:
            break
        frames.append(older)

    df = clean_candles(pd.concat(frames, ignore_index=True), now_ms=now_ms)
    return df[df["time"] >= want_from].reset_index(drop=True)


def snapshot_path(symbol: str) -> Path:
    return SNAPSHOT_DIR / f"{symbol}.csv"


def load_snapshot(symbol: str) -> pd.DataFrame | None:
    path = snapshot_path(symbol)
    if not path.exists():
        return None
    return clean_candles(pd.read_csv(path))


def save_snapshot(symbol: str, df: pd.DataFrame) -> Path:
    path = snapshot_path(symbol)
    path.parent.mkdir(parents=True, exist_ok=True)
    df[COLUMNS].to_csv(path, index=False)
    return path


@dataclass
class _Entry:
    df: pd.DataFrame
    source: str
    note: str
    loaded_at: float


@dataclass
class CandleStore:
    """Caches candles per token so a burst of rulings does not hammer Bitget."""

    cache_seconds: float = CACHE_SECONDS
    fetcher: object = None  # callable(symbol, days) -> DataFrame; defaults to fetch_bitget
    retry_seconds: float = 60
    _cache: dict[str, _Entry] = field(default_factory=dict)
    _failures: dict[str, tuple[float, str]] = field(default_factory=dict)
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def _load(self, symbol: str) -> _Entry:
        if symbol in PRACTICE:
            df = clean_candles(PRACTICE[symbol]["make"]())
            return _Entry(df, "practice", "Made-up practice prices, not real market data.", _time.time())
        fetch = self.fetcher or fetch_bitget
        try:
            df = fetch(symbol, MAX_DAYS)
            return _Entry(df, "bitget", "Live hourly candles from Bitget.", _time.time())
        except Exception as live_err:  # any failure of the live feed falls back to saved files
            if not isinstance(live_err, (DataError, requests.RequestException)):
                log.warning("Bitget fetch for %s failed unexpectedly: %r", symbol, live_err)
            snap = None
            try:
                snap = load_snapshot(symbol)
            except (DataError, OSError, ValueError):
                snap = None
            if snap is not None and not snap.empty:
                last = pd.to_datetime(int(snap["time"].iloc[-1]), unit="ms", utc=True).strftime("%b %d, %Y %H:%M UTC")
                return _Entry(
                    snap,
                    "saved",
                    f"Bitget could not be reached, so these are saved Bitget candles up to {last}.",
                    _time.time(),
                )
            raise DataError(
                f"Couldn't load {token_label(symbol)} prices from Bitget right now ({_short(live_err)}). "
                "Try again in a minute, or pick a practice market."
            ) from None

    def get_all(self, symbol: str) -> _Entry:
        with self._lock:
            entry = self._cache.get(symbol)
            fresh = entry and (entry.source == "practice" or _time.time() - entry.loaded_at < self.cache_seconds)
        if fresh:
            return entry
        failed = self._failures.get(symbol)
        if failed and _time.time() - failed[0] < self.retry_seconds:
            raise DataError(failed[1])
        try:
            entry = self._load(symbol)
        except DataError as e:
            # Remember the failure briefly so every visitor does not wait on a dead connection.
            self._failures[symbol] = (_time.time(), str(e))
            raise
        with self._lock:
            self._cache[symbol] = entry
            self._failures.pop(symbol, None)
        return entry

    def window(self, symbol: str, days: int, end_ms: int | None = None) -> tuple[pd.DataFrame, dict]:
        """Candles for the ``days`` days ending at ``end_ms`` (default: the latest candle)."""
        if symbol not in PRACTICE and symbol not in token_list():
            raise DataError(f"{symbol} is not one of the tokens this court can judge.")
        if not (1 <= int(days) <= MAX_DAYS):
            raise DataError(f"The time window must be between 1 and {MAX_DAYS} days.")
        entry = self.get_all(symbol)
        df = entry.df
        if end_ms is not None:
            df = df[df["time"] <= int(end_ms)]
            if df.empty:
                raise DataError("No candles exist before the requested end time.")
        last = int(df["time"].iloc[-1])
        df = df[df["time"] > last - int(days) * DAY_MS].reset_index(drop=True)
        span_days = (int(df["time"].iloc[-1]) - int(df["time"].iloc[0]) + HOUR_MS) / DAY_MS
        info = {
            "symbol": symbol,
            "label": token_label(symbol),
            "name": PRACTICE[symbol]["name"] if symbol in PRACTICE else TOKEN_NAMES.get(symbol, ""),
            "source": entry.source,
            "source_note": entry.note,
            "granularity": "1h",
            "days_requested": int(days),
            "days_available": round(span_days, 1),
            "short_history": span_days < int(days) - 1,
            "candles": len(df),
            "start": int(df["time"].iloc[0]),
            "end": int(df["time"].iloc[-1]),
            "hash": data_hash(df),
        }
        return df, info


def _short(err: Exception) -> str:
    text = str(err).strip() or err.__class__.__name__
    if isinstance(err, requests.RequestException):
        text = "network error"
    return text[:120]
