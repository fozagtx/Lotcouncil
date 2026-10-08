import json

import pytest
from fastapi.testclient import TestClient

from lotcouncil.server import create_app

from .conftest import TREND_IDEA


@pytest.fixture
def client(service):
    return TestClient(create_app(service))


def events(resp):
    assert resp.status_code == 200
    return [json.loads(line) for line in resp.text.splitlines() if line.strip()]


def judge(client, **body):
    payload = {"symbol": "PRACTICE-TREND", "days": 90, "fee_pct": 0.1, "idea": TREND_IDEA}
    payload.update(body)
    return events(client.post("/api/judge", json=payload))


def test_page_and_markets(client):
    page = client.get("/")
    assert page.status_code in (200, 503) and "Lotcouncil" in page.text  # 503 until the Svelte app is built
    m = client.get("/api/markets").json()
    symbols = [t["symbol"] for t in m["tokens"]]
    assert "rAAPLUSDT" in symbols and "PRACTICE-TREND" in symbols
    assert m["fees_pct"] == [0.05, 0.1, 0.2] and m["ai_enabled"] is False


def test_judge_streams_each_stage_then_the_verdict(client):
    evs = judge(client)
    assert [e["stage"] for e in evs] == ["understood", "data", "gate", "A", "B", "C", "verdict", "explanation"]
    verdict = evs[6]
    assert verdict["ruling"]["verdict"] == "PASS"
    assert "series" not in verdict["ruling"]
    assert len(verdict["chart"]["copy_scores"]) == 500
    assert len(verdict["chart"]["time"]) <= 721
    assert evs[-1]["explanation"]["source"] == "template"


def test_rule_can_be_given_directly(client):
    evs = judge(client, rule={"type": "breakout", "lookback": 48}, idea="")
    assert evs[0]["stage"] == "data"
    assert evs[-2]["request"]["parsed_by"] == "user"


@pytest.mark.parametrize(
    "body, message",
    [
        ({"idea": "make me rich"}, "couldn't find a rule"),
        ({"symbol": "NOPE"}, "not one of the tokens"),
        ({"symbol": "rAAPLUSDT"}, "practice market"),
        ({"fee_pct": 1.5}, "fee"),
        ({"days": 10}, "at least 500"),
        ({"rule": {"type": "ma_cross", "fast": 50, "slow": 5}}, "shorter"),
    ],
)
def test_bad_input_becomes_one_plain_error(client, body, message):
    evs = judge(client, **body)
    assert evs[-1]["stage"] == "error"
    assert message in evs[-1]["message"]


def test_garbage_body_is_refused(client):
    r = client.post("/api/judge", content=b"{not json", headers={"content-type": "application/json"})
    assert r.status_code == 422 and "JSON" in r.json()["error"]
    r = client.post("/api/judge", json={"days": "ninety"})
    assert r.status_code == 400


def test_audit_round_trip(client):
    v = judge(client)[6]
    req = v["request"]
    audit = client.post(
        "/api/audit",
        json={"symbol": req["symbol"], "days": req["days"], "end": req["end"] // 1000, "rule": req["rule"], "fee_pct": 0.1, "idea": TREND_IDEA},
    )
    assert audit.status_code == 200
    assert "attachment" in audit.headers["content-disposition"]
    file = audit.json()
    assert file["result"]["verdict"] == v["ruling"]["verdict"]
    assert file["data_hash"] == v["market"]["hash"]
    again = client.post("/api/rerun", json=file).json()
    assert again["same"] is True

    file["candles"]["rows"][10][4] += 1
    tampered = client.post("/api/rerun", json=file).json()
    assert tampered["same"] is False and tampered["hash_ok"] is False


def test_share_link_end_time_reproduces_the_ruling(client):
    v = judge(client)[6]
    end = v["request"]["end"] // 1000
    again = judge(client, rule=v["request"]["rule"], end=end, idea="")
    assert again[-2]["ruling"]["tests"] == v["ruling"]["tests"]
    assert again[-2]["market"]["hash"] == v["market"]["hash"]


def test_rate_limit(service, monkeypatch):
    monkeypatch.setenv("COURT_RATE_LIMIT", "2")
    c = TestClient(create_app(service))
    assert c.post("/api/understand", json={"idea": TREND_IDEA}).status_code == 200
    assert c.post("/api/understand", json={"idea": TREND_IDEA}).status_code == 200
    r = c.post("/api/understand", json={"idea": TREND_IDEA})
    assert r.status_code == 429 and "Too many" in r.json()["error"]


def test_understand_errors_are_plain(client):
    r = client.post("/api/understand", json={"idea": "buy when RSI is low"})
    assert r.status_code == 422 and "RSI" in r.json()["error"]


def test_oversized_body_is_refused(client):
    r = client.post("/api/rerun", content=b"x" * 6_100_000, headers={"content-type": "application/json"})
    assert r.status_code == 422 and "too large" in r.json()["error"]


def test_unexpected_failure_still_ends_with_an_error_event(client, service, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("bug")

    monkeypatch.setattr(service.store, "window", boom)
    evs = judge(client)
    assert evs[-1]["stage"] == "error" and "went wrong" in evs[-1]["message"]


def test_serves_the_built_frontend(service, tmp_path, monkeypatch):
    (tmp_path / "_app").mkdir()
    (tmp_path / "index.html").write_text("<title>Lotcouncil</title>")
    (tmp_path / "_app" / "x.js").write_text("console.log(1)")
    monkeypatch.setattr("lotcouncil.server.WEB_DIR", tmp_path)
    c = TestClient(create_app(service))
    assert c.get("/").status_code == 200 and "Lotcouncil" in c.get("/").text
    assert c.get("/_app/x.js").status_code == 200
    assert c.get("/api/health").json()["ok"] is True


def test_trade_ledger_adds_up_to_the_total_result(client):
    v = judge(client)[6]
    trades = v["chart"]["trades"]
    assert len(trades) == v["ruling"]["gate"]["trades"]
    compounded = 1.0
    for t in trades:
        compounded *= 1 + t["return_pct"] / 100
        assert t["exit_time"] > t["entry_time"] and t["hours"] >= 1
        assert t["part"] in ("seen", "unseen")
    assert abs(100 * (compounded - 1) - v["ruling"]["stats"]["total_return_pct"]) < 0.05
    assert [t["open"] for t in trades].count(True) <= 1


def test_candles_are_merged_for_the_chart(client):
    c = judge(client)[6]["chart"]["candles"]
    assert c["hours"] in (1, 2, 4, 6, 12, 24) and len(c["time"]) <= 150
    for o, h, lo, cl in zip(c["open"], c["high"], c["low"], c["close"], strict=True):
        assert lo <= min(o, cl) and h >= max(o, cl)
