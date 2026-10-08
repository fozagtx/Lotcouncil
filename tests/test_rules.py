import numpy as np
import pytest

from lotcouncil.rules import RuleError, describe_rule, positions, validate_rule

RULES = [
    {"type": "ma_cross", "fast": 10, "slow": 40},
    {"type": "ma_cross", "fast": 1, "slow": 24},
    {"type": "breakout", "lookback": 48, "exit_lookback": 24},
    {"type": "dip_buy", "drop_pct": 1.0, "lookback": 24, "max_hold": 12},
]


def test_defaults_are_filled():
    assert validate_rule({"type": "breakout", "lookback": 48}) == {"type": "breakout", "lookback": 48, "exit_lookback": 24}
    assert validate_rule({"type": "dip_buy", "drop_pct": 2}) == {"type": "dip_buy", "lookback": 24, "drop_pct": 2.0, "max_hold": 48}


def test_whole_numbers_are_coerced():
    assert validate_rule({"type": "ma_cross", "fast": 10.0, "slow": "40"}) == {"type": "ma_cross", "fast": 10, "slow": 40}


@pytest.mark.parametrize(
    "bad",
    [
        None,
        "ma_cross",
        {"type": "rsi", "level": 30},
        {"type": "ma_cross", "fast": 40, "slow": 10},
        {"type": "ma_cross", "fast": 10},
        {"type": "ma_cross", "fast": 10, "slow": 40, "short": True},
        {"type": "ma_cross", "fast": 10.5, "slow": 40},
        {"type": "ma_cross", "fast": True, "slow": 40},
        {"type": "ma_cross", "fast": float("nan"), "slow": 40},
        {"type": "dip_buy", "drop_pct": 90},
        {"type": "breakout", "lookback": 0},
    ],
)
def test_bad_rules_are_rejected(bad):
    with pytest.raises(RuleError):
        validate_rule(bad)


@pytest.mark.parametrize("rule", RULES)
def test_positions_never_look_ahead(rule):
    rng = np.random.default_rng(0)
    close = 100 * np.exp(np.cumsum(rng.normal(0, 0.01, 800)))
    base = positions(validate_rule(rule), close)
    assert set(np.unique(base)) <= {0.0, 1.0}
    for k in (200, 400, 650):
        bumped = close.copy()
        bumped[k:] *= 1.2  # change the future from candle k on
        pos = positions(validate_rule(rule), bumped)
        # The position held during candle k was decided at the close of k-1.
        assert np.array_equal(pos[: k + 1], base[: k + 1])


def test_ma_cross_holds_when_fast_above_slow():
    close = np.concatenate([np.full(60, 100.0), np.linspace(100, 150, 60)])
    pos = positions({"type": "ma_cross", "fast": 5, "slow": 20}, close)
    assert pos[:61].sum() == 0
    assert pos[-1] == 1


def test_dip_buy_exits_after_max_hold():
    close = np.concatenate([np.full(30, 100.0), np.full(60, 90.0)])
    pos = positions({"type": "dip_buy", "drop_pct": 5.0, "lookback": 24, "max_hold": 6}, close)
    held = np.flatnonzero(pos)
    assert held[0] == 31  # bought at the close of candle 30, held from 31
    assert len(held) >= 6


@pytest.mark.parametrize("rule", RULES)
def test_rules_describe_themselves(rule):
    text = describe_rule(validate_rule(rule))
    assert text.endswith(".") and len(text) < 220
