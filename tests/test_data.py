import pandas as pd
import pytest

from lotcouncil import data
from lotcouncil.data import HOUR_MS, CandleStore, DataError, clean_candles, data_hash, fetch_bitget

NOW = 1_790_812_800_000  # 2026-10-01 00:00 UTC


def bitget_rows(start_ms, n, price=100.0):
    rows = []
    for i in range(n):
        t = start_ms + i * HOUR_MS
        p = price + i * 0.01
        rows.append([str(t), f"{p:.2f}", f"{p + 0.5:.2f}", f"{p - 0.5:.2f}", f"{p + 0.1:.2f}", "10", "1000", "1000"])
    return rows


class FakeResp:
    def __init__(self, body, status=200):
        self.status_code = status
        self.body = body

    def json(self):
        return self.body


class FakeBitget:
    """Serves `total` hourly candles ending just before NOW, like Bitget's two endpoints."""

    def __init__(self, total=3000, reject_lowercase=False):
        self.first = NOW - total * HOUR_MS
        self.total = total
        self.reject_lowercase = reject_lowercase
        self.calls = []

    def get(self, url, params=None, timeout=None):
        self.calls.append((url.rsplit("/", 1)[-1], dict(params)))
        if self.reject_lowercase and params["granularity"] == "1h":
            return FakeResp({"code": "40034", "msg": "Parameter granularity error"}, 400)
        if url.endswith("/history-candles"):
            end = int(params["endTime"])
            n = min(int(params["limit"]), (end - self.first) // HOUR_MS)
            return FakeResp({"code": "00000", "data": bitget_rows(end - n * HOUR_MS, n) if n > 0 else []})
        # newest 1000, including the candle that is still forming
        n = min(int(params["limit"]), self.total + 1)
        start = NOW - (n - 1) * HOUR_MS
        return FakeResp({"code": "00000", "data": bitget_rows(start, n)})


def test_fetch_pages_back_and_drops_the_open_candle():
    fake = FakeBitget(total=3000)
    df = fetch_bitget("rAAPLUSDT", days=100, session=fake, now_ms=NOW)
    assert df["time"].is_monotonic_increasing and df["time"].is_unique
    assert int(df["time"].iloc[-1]) == NOW - HOUR_MS  # the forming candle is gone
    assert int(df["time"].iloc[0]) >= NOW - 100 * 24 * HOUR_MS
    assert len(df) == 100 * 24
    assert [c[0] for c in fake.calls][0] == "candles"
    assert all(c[0] == "history-candles" for c in fake.calls[1:])


def test_fetch_stops_when_history_runs_out():
    fake = FakeBitget(total=1500)
    df = fetch_bitget("rAAPLUSDT", days=180, session=fake, now_ms=NOW)
    assert len(df) == 1500
    assert len(fake.calls) < 20


def test_fetch_tries_the_other_granularity_spelling():
    fake = FakeBitget(total=1200, reject_lowercase=True)
    df = fetch_bitget("rAAPLUSDT", days=30, session=fake, now_ms=NOW)
    assert len(df) == 30 * 24
    assert fake.calls[1][1]["granularity"] == "1H"


def test_bitget_refusal_is_a_data_error():
    class Refuse:
        def get(self, url, params=None, timeout=None):
            return FakeResp({"code": "40404", "msg": "symbol not whitelisted"}, 400)

    with pytest.raises(DataError, match="whitelisted"):
        fetch_bitget("rAAPLUSDT", session=Refuse(), now_ms=NOW)


def test_clean_candles_tidies_and_validates():
    raw = pd.DataFrame({"time": [3, 1, 2, 2, 4], "close": [10, 11, None, 12, -1]})
    out = clean_candles(raw)
    assert out["time"].tolist() == [1, 2, 3]
    assert out["close"].tolist() == [11, 12, 10]
    assert (out["open"] == out["close"]).all()
    with pytest.raises(DataError, match="missing"):
        clean_candles(pd.DataFrame({"time": [1], "open": [1]}))
    with pytest.raises(DataError):
        clean_candles(pd.DataFrame())


def test_hash_is_stable_and_sensitive(trend_df):
    assert data_hash(trend_df) == data_hash(trend_df.copy())
    bumped = trend_df.copy()
    bumped.loc[5, "close"] += 0.0001
    assert data_hash(bumped) != data_hash(trend_df)


def test_saved_file_is_used_when_bitget_is_down(tmp_path, monkeypatch, trend_df):
    monkeypatch.setattr(data, "SNAPSHOT_DIR", tmp_path)
    data.save_snapshot("rAAPLUSDT", trend_df)

    def down(symbol, days):
        raise DataError("blocked")

    df, info = CandleStore(fetcher=down).window("rAAPLUSDT", 30)
    assert info["source"] == "saved" and "saved Bitget candles" in info["source_note"]
    assert len(df) == 30 * 24
    assert info["hash"] == data_hash(df)


def test_no_data_at_all_gives_a_plain_message(tmp_path, monkeypatch):
    monkeypatch.setattr(data, "SNAPSHOT_DIR", tmp_path)
    calls = []

    def down(symbol, days):
        calls.append(symbol)
        raise DataError("blocked")

    store = CandleStore(fetcher=down)
    with pytest.raises(DataError, match="api.bitget.com"):
        store.window("rAAPLUSDT", 30)
    with pytest.raises(DataError):
        store.window("rAAPLUSDT", 30)
    assert len(calls) == 1  # the failure is remembered briefly


def test_windows_and_end_times(trend_df):
    store = CandleStore(fetcher=lambda s, d: trend_df)
    df, info = store.window("rAAPLUSDT", 30)
    assert info["source"] == "bitget" and len(df) == 720 and not info["short_history"]
    end = int(trend_df["time"].iloc[-100])
    df2, info2 = store.window("rAAPLUSDT", 30, end_ms=end)
    assert int(df2["time"].iloc[-1]) == end and len(df2) == 720
    _, short = store.window("rAAPLUSDT", 180)
    assert short["short_history"]


def test_unknown_symbols_are_refused():
    with pytest.raises(DataError, match="not one of the tokens"):
        CandleStore().window("DOGEUSDT", 30)


def test_practice_markets_never_change():
    a, ia = CandleStore().window("PRACTICE-TREND", 90)
    b, ib = CandleStore().window("PRACTICE-TREND", 90)
    assert ia["hash"] == ib["hash"] and ia["source"] == "practice"


def test_practice_markets_are_off_unless_switched_on(monkeypatch, service):
    monkeypatch.setenv("COURT_PRACTICE", "off")
    with pytest.raises(DataError, match="turned off"):
        CandleStore().window("PRACTICE-TREND", 90)
    assert not any(t["practice"] for t in service.markets()["tokens"])
    monkeypatch.setenv("COURT_PRACTICE", "on")
    assert any(t["practice"] for t in service.markets()["tokens"])
