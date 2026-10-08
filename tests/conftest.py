import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lotcouncil import synthetic  # noqa: E402
from lotcouncil.ai import AIHelper  # noqa: E402
from lotcouncil.data import CandleStore, DataError  # noqa: E402
from lotcouncil.service import CourtService  # noqa: E402

TREND_IDEA = "buy when the 10 hour average crosses above the 40 hour average"


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    """Tests never call Bitget or Nebius."""
    monkeypatch.delenv("NEBIUS_API_KEY", raising=False)
    monkeypatch.delenv("COURT_TOKENS", raising=False)
    # Tests run offline on the made-up practice markets.
    monkeypatch.setenv("COURT_PRACTICE", "on")


@pytest.fixture
def trend_df():
    return synthetic.trending().tail(90 * 24).reset_index(drop=True)


@pytest.fixture
def random_df():
    return synthetic.random_walk().tail(90 * 24).reset_index(drop=True)


def offline_fetcher(symbol, days):
    raise DataError("network blocked in tests")


@pytest.fixture
def service(tmp_path, monkeypatch):
    monkeypatch.setattr("lotcouncil.data.SNAPSHOT_DIR", tmp_path)
    return CourtService(store=CandleStore(fetcher=offline_fetcher), ai=AIHelper(api_key=""))
