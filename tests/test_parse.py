import pytest

from lotcouncil.parse import ParseError, keyword_parse

CASES = [
    ("buy when the 10 hour average crosses above the 40 hour average", {"type": "ma_cross", "fast": 10, "slow": 40}),
    ("Buy when the ten-hour average crosses above the forty-hour average", {"type": "ma_cross", "fast": 10, "slow": 40}),
    ("buy when the 10 hour average crosses above the 40", {"type": "ma_cross", "fast": 10, "slow": 40}),
    ("10/40 moving average cross", {"type": "ma_cross", "fast": 10, "slow": 40}),
    ("golden cross 50 200", {"type": "ma_cross", "fast": 50, "slow": 200}),
    ("buy when the 1 day average crosses the 5 day average", {"type": "ma_cross", "fast": 24, "slow": 120}),
    ("hold while the price is above its 3 day average", {"type": "ma_cross", "fast": 1, "slow": 72}),
    ("buy when the price breaks above its 48 hour high", {"type": "breakout", "lookback": 48, "exit_lookback": 24}),
    ("breakout of the 3 day high, sell at the 1 day low", {"type": "breakout", "lookback": 72, "exit_lookback": 24}),
    ("buy when the price drops 2% below its 24 hour average", {"type": "dip_buy", "lookback": 24, "drop_pct": 2.0, "max_hold": 48}),
    ("buy the dip: 1.5% under the 12h average, sell after 24 hours", {"type": "dip_buy", "lookback": 12, "drop_pct": 1.5, "max_hold": 24}),
    ("buy after a 3 percent drop", {"type": "dip_buy", "lookback": 24, "drop_pct": 3.0, "max_hold": 48}),
]


@pytest.mark.parametrize("idea, rule", CASES)
def test_reads_the_three_idea_types(idea, rule):
    assert keyword_parse(idea) == rule


@pytest.mark.parametrize(
    "idea, hint",
    [
        ("", "Type an idea"),
        ("make me rich", "couldn't find a rule"),
        ("buy when RSI is below 30", "RSI"),
        ("short when the 10 hour average crosses below the 40", "short selling"),
        ("buy when volume spikes", "volume"),
        ("buy when the 5 minute average crosses the 20 minute average", "hourly candles"),
        ("buy the dip", "needs a size"),
        ("buy when the average crosses", "two lengths"),
    ],
)
def test_refuses_what_it_cannot_read(idea, hint):
    with pytest.raises(ParseError, match=hint):
        keyword_parse(idea)
