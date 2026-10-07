import json

import pytest
import requests

from lotcouncil.ai import AIHelper, check_explanation, ruling_facts, template_explanation
from lotcouncil.court import market_from_frame, run_court
from lotcouncil.parse import ParseError

MA = {"type": "ma_cross", "fast": 10, "slow": 40}


class FakeResponse:
    def __init__(self, content, status=200):
        self.status_code = status
        self._content = content

    def json(self):
        return {"choices": [{"message": {"content": self._content}}]}


def fake_post(*replies):
    calls = []
    queue = list(replies)

    def post(url, headers=None, json=None, timeout=None):
        calls.append({"url": url, "headers": headers, "json": json})
        reply = queue.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply if isinstance(reply, FakeResponse) else FakeResponse(reply)

    post.calls = calls
    return post


def helper(*replies):
    return AIHelper(api_key="test-key", base_url="https://example.invalid/v1", model="m", post=fake_post(*replies))


@pytest.fixture
def fail_ruling(random_df):
    return run_court(market_from_frame(random_df), MA)


@pytest.fixture
def pass_ruling(trend_df):
    return run_court(market_from_frame(trend_df), MA)


def test_without_a_key_the_keyword_reader_takes_over():
    ai = AIHelper(api_key="")
    out = ai.understand("buy when the 10 hour average crosses above the 40 hour average")
    assert out["rule"] == MA and out["source"] == "keywords" and "AI is off" in out["notice"]


def test_ai_reading_is_validated_and_used():
    ai = helper('```json\n{"type":"breakout","lookback":72}\n```')
    out = ai.understand("buy 3-day highs")
    assert out == {"rule": {"type": "breakout", "lookback": 72, "exit_lookback": 36}, "rule_text": out["rule_text"], "source": "ai", "notice": None}
    call = ai._post.calls[0]
    assert call["url"] == "https://example.invalid/v1/chat/completions"
    assert call["headers"]["Authorization"] == "Bearer test-key"
    assert call["json"]["temperature"] == 0


def test_ai_saying_unsupported_is_a_clear_refusal():
    ai = helper('{"type":"unsupported","reason":"RSI"}')
    with pytest.raises(ParseError, match="can't judge"):
        ai.understand("buy when RSI is oversold")


@pytest.mark.parametrize(
    "reply",
    [
        '{"type":"rsi","level":30}',
        "Sure! Here is your rule.",
        '{"type":"ma_cross","fast":40,"slow":10}',
        FakeResponse("", status=500),
        requests.ConnectionError("down"),
    ],
)
def test_bad_or_missing_ai_falls_back_to_keywords(reply):
    out = helper(reply).understand("buy when the 10 hour average crosses above the 40 hour average")
    assert out["rule"] == MA and out["source"] == "keywords" and out["notice"]


def test_overlong_idea_is_refused():
    with pytest.raises(ParseError, match="under 400"):
        AIHelper(api_key="").understand("buy " * 200)


def test_template_explanation_has_four_sentences_and_passes_its_own_check(pass_ruling, fail_ruling):
    for r in (pass_ruling, fail_ruling):
        text = template_explanation(r)
        assert check_explanation(text, ruling_facts("idea", r)) is None
        assert r["verdict"] in text


def test_good_ai_explanation_is_shown(fail_ruling):
    b = fail_ruling["tests"]["B"]
    text = (
        "This idea gets a FAIL because its results look like luck. "
        f"On the part of the history it never saw, it scored {fail_ruling['tests']['A']['score_unseen']:.2f}, below the 0.5 it needs. "
        f"Its timing beat {b['beat_share_pct']:.0f}% of {b['copies']} shuffled copies, short of the {b['threshold_pct']:.0f}% needed. "
        "With higher fees and the weekend check, the stress test adds more doubt."
    )
    out = helper(text).explain("idea", fail_ruling)
    assert out["source"] == "ai" and out["text"] == text


@pytest.mark.parametrize(
    "text, why",
    [
        ("This idea gets a FAIL. It scored 7.77 on unseen data. It beat few copies. Fees hurt it.", "number"),
        ("This idea gets a PASS. It looks fine. Timing is good. Fees are fine.", "verdict"),
        ("This idea gets a FAIL. But the verdict is wrong. Timing is good. Fees are fine.", "questioned"),
        ("FAIL.", "four short sentences"),
    ],
)
def test_unsafe_ai_explanations_are_replaced(fail_ruling, text, why):
    out = helper(text).explain("idea", fail_ruling)
    assert out["source"] == "template"
    assert why in out["notice"]
    assert out["text"] == template_explanation(fail_ruling)


def test_explanation_never_touches_the_verdict(fail_ruling):
    before = json.dumps({k: v for k, v in fail_ruling.items() if k != "series"}, sort_keys=True, default=str)
    helper("This idea gets a PASS. It is great. Buy it now. It will make money.").explain("idea", fail_ruling)
    after = json.dumps({k: v for k, v in fail_ruling.items() if k != "series"}, sort_keys=True, default=str)
    assert before == after and fail_ruling["verdict"] == "FAIL"


def test_ai_only_sees_court_numbers(fail_ruling):
    facts = ruling_facts("my idea", fail_ruling, {"label": "rAAPL", "days_available": 90, "candles": 2160})
    text = json.dumps(facts)
    assert "series" not in text and "copy_scores" not in text
    assert facts["verdict"] == "FAIL"
