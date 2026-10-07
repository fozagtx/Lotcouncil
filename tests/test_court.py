import numpy as np
import pandas as pd
import pytest

from lotcouncil.court import (
    CourtError,
    iter_court,
    market_from_frame,
    public_ruling,
    run_court,
    score,
    weekend_check,
    weekend_mask,
)

MA = {"type": "ma_cross", "fast": 10, "slow": 40}
RULES = [MA, {"type": "breakout", "lookback": 48}, {"type": "dip_buy", "drop_pct": 1.5, "max_hold": 24}]


def ruling(df, rule, **kw):
    return run_court(market_from_frame(df), rule, **kw)


def test_planted_trend_passes(trend_df):
    r = ruling(trend_df, MA)
    assert r["verdict"] == "PASS"
    assert all(t["passed"] for t in r["tests"].values())
    assert r["reasons"] == []


@pytest.mark.parametrize("rule", RULES)
def test_random_market_fails(random_df, rule):
    r = ruling(random_df, rule)
    assert r["verdict"] == "FAIL"
    assert r["reasons"]


def test_same_input_same_ruling(trend_df):
    a, b = ruling(trend_df, MA), ruling(trend_df, MA)
    assert public_ruling(a) == public_ruling(b)
    assert np.array_equal(a["series"]["copy_scores"], b["series"]["copy_scores"])


def test_stages_arrive_in_order(trend_df):
    stages = [s for s, _ in iter_court(market_from_frame(trend_df), MA)]
    assert stages == ["gate", "A", "B", "C", "verdict"]


def test_too_few_trades_fails_without_running_tests(random_df):
    stages = [s for s, _ in iter_court(market_from_frame(random_df), {"type": "dip_buy", "drop_pct": 8})]
    assert stages == ["gate", "verdict"]
    r = ruling(random_df, {"type": "dip_buy", "drop_pct": 8})
    assert r["verdict"] == "FAIL"
    assert r["headline"] == "Too few trades to judge."
    assert r["tests"] == {}


def test_fewer_than_500_candles_is_refused(trend_df):
    with pytest.raises(CourtError, match="at least 500"):
        ruling(trend_df.tail(499), MA)


def test_rule_longer_than_half_the_data_is_refused(trend_df):
    with pytest.raises(CourtError, match="more than half"):
        ruling(trend_df.tail(600), {"type": "ma_cross", "fast": 10, "slow": 400})


def test_bad_prices_are_refused(trend_df):
    bad = trend_df.copy()
    bad.loc[100, "close"] = np.nan
    with pytest.raises(CourtError):
        ruling(bad, MA)
    shuffled = trend_df.sample(frac=1, random_state=1)
    with pytest.raises(CourtError):
        ruling(shuffled, MA)


def test_unknown_rule_is_refused(trend_df):
    with pytest.raises(CourtError):
        ruling(trend_df, {"type": "rsi"})


def test_higher_fees_lower_the_stress_score(trend_df):
    low = ruling(trend_df, MA, fee=0.0005)["tests"]["C"]
    high = ruling(trend_df, MA, fee=0.002)["tests"]["C"]
    assert high["score_base"] < low["score_base"]
    assert high["score_stress"] < low["score_stress"]
    assert low["score_stress"] < low["score_base"]


def test_thresholds_decide_the_verdict(trend_df):
    strict = ruling(trend_df, MA, thresholds={"unseen_score_min": 100.0})
    assert strict["verdict"] == "FAIL"
    assert not strict["tests"]["A"]["passed"]
    assert strict["headline"] == "It does not hold up on data it never saw."


def test_score_is_zero_for_flat_returns():
    assert score(np.zeros(100), 8766) == 0.0


@pytest.mark.parametrize(
    "utc, weekend",
    [
        ("2026-10-02 23:00", False),  # Fri 19:00 New York (summer time)
        ("2026-10-03 00:00", True),  # Fri 20:00 New York: market shut
        ("2026-10-04 23:00", True),  # Sun 19:00 New York
        ("2026-10-05 00:00", False),  # Sun 20:00 New York: 24/5 session opens
        ("2026-12-05 00:00", False),  # Fri 19:00 New York (winter time)
        ("2026-12-05 01:00", True),  # Fri 20:00 New York
        ("2026-12-07 01:00", False),  # Sun 20:00 New York
        ("2026-10-07 12:00", False),  # a Wednesday
    ],
)
def test_weekend_follows_new_york_hours(utc, weekend):
    ms = int(pd.Timestamp(utc, tz="UTC").timestamp() * 1000)
    assert bool(weekend_mask(np.array([ms]))[0]) is weekend


@pytest.mark.parametrize(
    "total, weekend, ok",
    [
        (0.10, 0.02, True),  # weekend made money
        (0.10, -0.04, True),  # lost 40% of the result: under half
        (0.10, -0.05, False),  # exactly half is not under half
        (0.10, -0.08, False),
        (-0.02, -0.01, False),  # a weekend loss with no profit to absorb it
        (-0.02, 0.0, True),
    ],
)
def test_weekend_check(total, weekend, ok):
    assert weekend_check(total, weekend, 0.5)[0] is ok


def test_weekend_figures_are_reported(trend_df):
    c = ruling(trend_df, MA)["tests"]["C"]
    assert c["weekend_candles"] > 0
    assert c["weekend_loss_max_share_pct"] == 50
    assert isinstance(c["weekend_result_pct"], float)
