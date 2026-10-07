"""The AI helper: it translates and it explains. It has no authority.

* ``understand(idea)`` turns one sentence into a rule. Only the three known rule
  types survive validation; anything else is rejected.
* ``explain(idea, ruling)`` writes four short sentences about a ruling the court
  already made. The text is checked before it is shown: it may only use numbers
  the court produced, and it may not contradict or doubt the verdict. If it
  fails a check, a template explanation is used instead.

The model runs on Nebius AI Studio through its OpenAI-compatible API. With no
key (or when the API is down) a built-in keyword reader and a template take
over, so the app keeps working.
"""

from __future__ import annotations

import json
import os
import re
from collections.abc import Callable

import requests

from .court import public_ruling
from .parse import UNSUPPORTED_HINT, ParseError, keyword_parse
from .rules import RuleError, describe_rule, validate_rule

DEFAULT_BASE_URL = "https://api.studio.nebius.com/v1"
DEFAULT_MODEL = "Qwen/Qwen3-235B-A22B-Instruct-2507"
MAX_IDEA_CHARS = 400


class AIUnavailable(RuntimeError):
    pass


UNDERSTAND_PROMPT = """You translate one plain-English trading idea into a rule for a testing court.
Candles are 1 hour long. Reply with one JSON object and nothing else.

Allowed rules. All are long-only. Lengths are whole numbers of hours: multiply days by 24 and weeks by 168.
1. {"type":"ma_cross","fast":F,"slow":S}
   Hold while the F-hour average price is above the S-hour average (F < S). If the idea compares the price itself with one average, use "fast":1.
2. {"type":"breakout","lookback":L,"exit_lookback":E}
   Buy when the price closes above the highest close of the previous L hours; sell when it closes below the lowest close of the previous E hours. Leave out exit_lookback if the idea gives no exit.
3. {"type":"dip_buy","lookback":L,"drop_pct":D,"max_hold":H}
   Buy when the price falls D percent below its L-hour average; sell when it gets back to the average or after H hours. Leave out lookback or max_hold if the idea does not give them.

If the idea cannot be written as exactly one of these rules (for example it uses RSI, MACD, volume, short selling, news, minutes, or several conditions), reply {"type":"unsupported","reason":"<one short sentence>"}.

Examples:
"buy when the 10 hour average crosses above the 40 hour average" -> {"type":"ma_cross","fast":10,"slow":40}
"buy 3-day highs" -> {"type":"breakout","lookback":72}
"buy when it drops 2% under the daily average, sell after 12 hours" -> {"type":"dip_buy","lookback":24,"drop_pct":2,"max_hold":12}
"buy when RSI is oversold" -> {"type":"unsupported","reason":"RSI is not one of the three rule types."}"""

EXPLAIN_PROMPT = """You explain rulings from Lotcouncil, a court that tests trading ideas on past prices.
The court has already ruled. You cannot change, soften or question the verdict.

Write exactly four short sentences in plain English for a beginner.
- Sentence 1: give the verdict word exactly as provided, in capitals (PASS or FAIL), and the main reason.
- Sentences 2 to 4: one sentence each for the unseen-data test, the random-timing test and the stress test. If the tests were skipped, explain instead why the court needs more trades and what would give it more.
- Use only numbers that appear in the facts, written as they appear there. Do not calculate, convert or invent numbers.
- No jargon: never say Sharpe, out-of-sample, permutation, p-value, backtest or overfit.
- No advice to buy, sell or invest, and no predictions.
- Plain text only: no lists, headings or markdown."""

_DOUBT_RE = re.compile(
    r"\b(wrong|mistaken|incorrect|unfair|overrul\w*|disagree\w*|should have (?:passed|failed)|"
    r"don't trust|do not trust|not reliable verdict|guarantee\w*|you should (?:buy|sell|invest)|"
    r"will (?:make|earn|profit))\b",
    re.I,
)
_NUMBER_RE = re.compile(r"(?<![A-Za-z0-9])-?\d+(?:\.\d+)?")


def _numbers_in(obj) -> list[float]:
    out: list[float] = []
    if isinstance(obj, bool) or obj is None:
        return out
    if isinstance(obj, (int, float)):
        out.append(float(obj))
    elif isinstance(obj, str):
        out.extend(float(m) for m in _NUMBER_RE.findall(obj.replace(",", "")))
    elif isinstance(obj, dict):
        for v in obj.values():
            out.extend(_numbers_in(v))
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            out.extend(_numbers_in(v))
    return out


def ruling_facts(idea: str, ruling: dict, market: dict | None = None) -> dict:
    """The only facts the AI is allowed to see: display-ready numbers from the court."""
    r = public_ruling(ruling)
    tests = r.get("tests", {})
    facts: dict = {
        "idea": idea,
        "rule": r["rule_text"],
        "verdict": r["verdict"],
        "headline": r["headline"],
        "trades": r["gate"]["trades"],
        "min_trades_needed": r["gate"]["min_trades"],
        "tests_run": bool(tests),
    }
    if market:
        facts["market"] = (
            f"{market.get('label')}, {market.get('days_available')} days of hourly candles "
            f"({market.get('candles')} candles)"
        )
    if "A" in tests:
        a = tests["A"]
        facts["unseen_data_test"] = {
            "passed": a["passed"],
            "share_of_history_held_back_percent": a["unseen_share_pct"],
            "score_on_unseen_data": a["score_unseen"],
            "needs_score_above": a["threshold"],
        }
    if "B" in tests:
        b = tests["B"]
        facts["random_timing_test"] = {
            "passed": b["passed"],
            "copies": b["copies"],
            "block_hours": b["block_hours"],
            "beat_percent_of_copies": b["beat_share_pct"],
            "needs_percent": b["threshold_pct"],
        }
    if "C" in tests:
        c = tests["C"]
        facts["stress_test"] = {
            "passed": c["passed"],
            "fee_percent": c["fee_pct"],
            "stress_fee_percent": c["stress_fee_pct"],
            "fee_multiplier": c["stress_fee_mult"],
            "score_with_higher_fees": c["score_stress"],
            "total_result_percent": c["total_result_pct"],
            "weekend_result_percent": c["weekend_result_pct"],
            "weekend_loss_share_percent": c["weekend_loss_share_pct"],
            "max_weekend_loss_share_percent": c["weekend_loss_max_share_pct"],
        }
    facts["court_sentences"] = [r["gate"]["sentence"]] + [tests[k]["sentence"] for k in ("A", "B", "C") if k in tests]
    return facts


def template_explanation(ruling: dict) -> str:
    """Four plain sentences built only from the court's own numbers and sentences."""
    verdict = ruling["verdict"]
    gate = ruling["gate"]
    tests = ruling.get("tests") or {}
    if not gate["passed"]:
        made = "never traded here" if gate["trades"] == 0 else f"made only {gate['trades']} trades here"
        return " ".join(
            [
                f"This idea gets a {verdict} because it {made}, "
                f"and the court needs at least {gate['min_trades']} trades before it can tell skill from luck.",
                "With so few trades, one or two lucky moves would decide the whole result.",
                "So the three tests were not run.",
                "To get a real ruling, try a longer time window or shorter lengths so the rule trades more often.",
            ]
        )
    head = ruling["headline"]
    head = head[0].lower() + head[1:]
    if verdict == "PASS":
        first = "This idea gets a PASS: it cleared all three tests, so it is not obviously luck on this history, though that is no prediction."
    else:
        first = f"This idea gets a FAIL: {head}"
    return " ".join([first] + [tests[k]["sentence"] for k in ("A", "B", "C")])


def check_explanation(text: str, facts: dict) -> str | None:
    """Return a reason the AI text cannot be shown, or None when it is safe."""
    if not text or len(text) > 900:
        return "it was empty or too long"
    sentences = [s for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s]
    if not (3 <= len(sentences) <= 5):
        return "it was not four short sentences"
    verdict = facts["verdict"]
    other = "PASS" if verdict == "FAIL" else "FAIL"
    if verdict not in text or re.search(rf"\b{other}\b", text):
        return "it did not state the court's verdict"
    if _DOUBT_RE.search(text):
        return "it questioned the verdict or gave advice"
    allowed = _numbers_in(facts) + [1, 2, 3, 4]
    for raw in _NUMBER_RE.findall(re.sub(r"(?<=\d),(?=\d{3})", "", text)):
        x = float(raw)
        decimals = len(raw.split(".")[1]) if "." in raw else 0
        tol = 0.5 * 10 ** (-decimals) + 1e-9
        if not any(abs(abs(x) - abs(v)) <= tol for v in allowed):
            return f"it used a number ({raw}) the court did not produce"
    return None


class AIHelper:
    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
        timeout: float = 20.0,
        post: Callable | None = None,
    ):
        self.api_key = api_key if api_key is not None else os.environ.get("NEBIUS_API_KEY", "")
        self.base_url = (base_url or os.environ.get("NEBIUS_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
        self.model = model or os.environ.get("COURT_MODEL") or DEFAULT_MODEL
        self.timeout = timeout
        self._post = post or requests.post

    @property
    def enabled(self) -> bool:
        return bool(self.api_key) and os.environ.get("COURT_AI", "on").lower() != "off"

    def _chat(self, system: str, user: str, max_tokens: int) -> str:
        if not self.enabled:
            raise AIUnavailable("no key")
        try:
            resp = self._post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                json={
                    "model": self.model,
                    "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                    "temperature": 0,
                    "max_tokens": max_tokens,
                },
                timeout=self.timeout,
            )
        except requests.RequestException as e:
            raise AIUnavailable(f"network: {e.__class__.__name__}") from None
        if resp.status_code != 200:
            raise AIUnavailable(f"HTTP {resp.status_code}")
        try:
            content = resp.json()["choices"][0]["message"]["content"] or ""
        except (ValueError, KeyError, IndexError, TypeError):
            raise AIUnavailable("unreadable reply") from None
        return re.sub(r"<think>.*?</think>", "", content, flags=re.S).strip()

    def understand(self, idea: str, allow_ai: bool = True) -> dict:
        """Read an idea into a rule. Raises ParseError when it cannot be read."""
        idea = (idea or "").strip()
        if not idea:
            raise ParseError("Type an idea first. " + UNSUPPORTED_HINT)
        if len(idea) > MAX_IDEA_CHARS:
            raise ParseError(f"Keep the idea under {MAX_IDEA_CHARS} characters: one sentence is enough.")

        notice = None
        if self.enabled and allow_ai:
            try:
                raw = self._chat(UNDERSTAND_PROMPT, idea, max_tokens=150)
                match = re.search(r"\{.*\}", raw, flags=re.S)
                if not match:
                    raise AIUnavailable("no JSON")
                data = json.loads(match.group(0))
                if isinstance(data, dict) and data.get("type") == "unsupported":
                    raise ParseError("The court can't judge that idea. " + UNSUPPORTED_HINT)
                rule = validate_rule(data)
                return {"rule": rule, "rule_text": describe_rule(rule), "source": "ai", "notice": None}
            except ParseError:
                raise
            except (AIUnavailable, ValueError, RuleError):
                notice = "The AI couldn't read this one, so the built-in keyword reader did."
        elif not self.enabled:
            notice = "AI is off: the built-in keyword reader read your idea."
        else:
            notice = "AI limit reached for now: the built-in keyword reader read your idea."

        rule = keyword_parse(idea)
        return {"rule": rule, "rule_text": describe_rule(rule), "source": "keywords", "notice": notice}

    def explain(self, idea: str, ruling: dict, market: dict | None = None, allow_ai: bool = True) -> dict:
        """Four plain sentences about the ruling. Never changes the verdict."""
        template = template_explanation(ruling)
        if not (self.enabled and allow_ai):
            note = "AI is off: this is the built-in summary." if not self.enabled else "AI limit reached: this is the built-in summary."
            return {"text": template, "source": "template", "notice": note}
        facts = ruling_facts(idea, ruling, market)
        try:
            text = self._chat(EXPLAIN_PROMPT, json.dumps(facts, ensure_ascii=False), max_tokens=260)
        except AIUnavailable:
            return {"text": template, "source": "template", "notice": "The AI is unreachable: this is the built-in summary."}
        text = re.sub(r"\s+", " ", text.replace("*", "")).strip()
        problem = check_explanation(text, facts)
        if problem:
            return {
                "text": template,
                "source": "template",
                "notice": f"The AI's explanation was not shown because {problem}; this is the built-in summary.",
            }
        return {"text": text, "source": "ai", "notice": None}
