import asyncio
import json

import pytest

from lotcouncil import __main__ as cli
from lotcouncil import mcp_server
from lotcouncil.audit import rerun_audit
from lotcouncil.court import CourtError

from .conftest import TREND_IDEA


@pytest.fixture
def audit(service):
    out = service.judge(symbol="PRACTICE-TREND", days=90, idea=TREND_IDEA, fee=0.001)
    req = out["request"]
    return service.audit(
        symbol=req["symbol"], days=req["days"], end_ms=req["end"], rule=req["rule"], fee=req["fee"], idea=TREND_IDEA, parsed_by=req["parsed_by"]
    )


def test_audit_file_reruns_from_json_alone(audit):
    text = json.dumps(audit)  # survives a trip through a file
    res = rerun_audit(json.loads(text))
    assert res["same"] and res["hash_ok"] and res["verdict_now"] == audit["result"]["verdict"]
    for key in ("idea", "rule", "data_hash", "settings", "candles", "result"):
        assert key in audit


def test_audit_keeps_its_own_thresholds(audit):
    audit["settings"]["thresholds"]["unseen_score_min"] = 99.0
    audit["result"]["verdict"] = "FAIL"
    res = rerun_audit(audit)
    assert res["verdict_now"] == "FAIL"
    assert "unseen_score_min" in res["thresholds_differ_from_today"]


def test_not_an_audit_file():
    with pytest.raises(CourtError):
        rerun_audit({"hello": "world"})


@pytest.mark.parametrize(
    "edit",
    [
        lambda a: a["settings"]["thresholds"].update(copies=1e9),  # would hang the server
        lambda a: a["settings"]["thresholds"].update(split=0.01),
        lambda a: a["settings"]["thresholds"].update(nonsense=1),
        lambda a: a["settings"].update(seed="abc"),
        lambda a: a["candles"].update(rows=[[1, 2]]),
    ],
)
def test_hand_edited_audit_files_are_refused(audit, edit):
    edit(audit)
    with pytest.raises(CourtError):
        rerun_audit(audit)


def test_cli_rerun(audit, tmp_path, capsys):
    path = tmp_path / "a.json"
    path.write_text(json.dumps(audit))
    assert cli.main(["rerun", str(path)]) == 0
    assert "Same ruling." in capsys.readouterr().out
    audit["candles"]["rows"][3][4] *= 2
    path.write_text(json.dumps(audit))
    assert cli.main(["rerun", str(path)]) == 1


def test_cli_judge(service, monkeypatch, capsys):
    monkeypatch.setattr("lotcouncil.service.CourtService", lambda: service)
    assert cli.main(["judge", TREND_IDEA, "--symbol", "PRACTICE-TREND"]) == 0
    assert capsys.readouterr().out.startswith("PASS")


def test_mcp_tool_returns_the_courts_verdict(service, monkeypatch):
    monkeypatch.setattr(mcp_server, "_service", service)
    out = mcp_server.judge_strategy(idea=TREND_IDEA, symbol="PRACTICE-TREND", days=90)
    assert out["ok"] and out["verdict"] == "PASS" and set(out["tests"]) == {"A", "B", "C"}
    out = mcp_server.judge_strategy(rule={"type": "ma_cross", "fast": 10, "slow": 40}, symbol="PRACTICE-RANDOM")
    assert out["verdict"] == "FAIL"
    bad = mcp_server.judge_strategy(idea="buy when RSI is low", symbol="PRACTICE-TREND")
    assert bad["ok"] is False and bad["verdict"] is None and "RSI" in bad["error"]


def test_mcp_server_lists_its_tools():
    server = mcp_server.build_server()
    tools = asyncio.run(server.list_tools())
    names = {t.name for t in tools}
    assert {"judge_strategy", "list_markets"} <= names
