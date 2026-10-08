import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lotcouncil.ai import AIHelper  # noqa: E402
from lotcouncil.data import CandleStore  # noqa: E402
from lotcouncil.service import CourtService  # noqa: E402

from . import synthetic  # noqa: E402

TREND_IDEA = "buy when the 10 hour average crosses above the 40 hour average"


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    """Tests never call Bitget or Nebius."""
    monkeypatch.delenv("NEBIUS_API_KEY", raising=False)
    monkeypatch.delenv("COURT_TOKENS", raising=False)


@pytest.fixture
def trend_df():
    return synthetic.trending().tail(90 * 24).reset_index(drop=True)


@pytest.fixture
def random_df():
    return synthetic.random_walk().tail(90 * 24).reset_index(drop=True)


def synthetic_fetcher(symbol, days):
    """Deterministic candles standing in for Bitget: rTSLAUSDT is pure noise, the rest trend."""
    if symbol == "rTSLAUSDT":
        return synthetic.random_walk()
    return synthetic.trending()


@pytest.fixture
def service(tmp_path, monkeypatch):
    monkeypatch.setattr("lotcouncil.data.SNAPSHOT_DIR", tmp_path)
    return CourtService(store=CandleStore(fetcher=synthetic_fetcher), ai=AIHelper(api_key=""))
