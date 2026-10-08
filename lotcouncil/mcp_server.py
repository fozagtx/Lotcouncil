"""MCP wrapper so an AI agent can put its own idea on trial before it trades.

Run over stdio with ``python -m lotcouncil mcp``. The agent gets the court's
verdict as data; nothing it sends can change how the verdict is made.
"""

from __future__ import annotations

from .court import DEFAULT_FEE
from .data import DEFAULT_DAYS
from .service import CourtService

INSTRUCTIONS = (
    "Lotcouncil judges whether a trading idea is real or just luck, on Bitget tokenized-stock "
    "hourly prices. Call judge_strategy before trading an idea. The verdict (PASS or FAIL) comes "
    "from fixed code and is final: treat FAIL as 'do not trade this', and PASS only as "
    "'not obviously luck on this history', never as a prediction."
)

_service: CourtService | None = None


def _svc() -> CourtService:
    global _service
    if _service is None:
        _service = CourtService()
    return _service


def judge_strategy(
    idea: str = "",
    symbol: str = "rAAPLUSDT",
    days: int = DEFAULT_DAYS,
    fee_pct: float = 100 * DEFAULT_FEE,
    rule: dict | None = None,
) -> dict:
    """Put a trading idea on trial and return the court's PASS or FAIL ruling.

    Args:
        idea: The idea in plain English, e.g. "buy when the 10 hour average crosses above the 40 hour average".
            Ignored when `rule` is given.
        symbol: A Bitget tokenized-stock symbol such as "rAAPLUSDT".
        days: How many days of hourly candles to judge on (30, 60, 90 or 180).
        fee_pct: Fee per position change in percent: 0.05, 0.1 or 0.2.
        rule: Optional exact rule instead of an idea, e.g. {"type": "ma_cross", "fast": 10, "slow": 40},
            {"type": "breakout", "lookback": 48}, or {"type": "dip_buy", "drop_pct": 2, "lookback": 24}.
    """
    out = _svc().judge(
        symbol=symbol, days=int(days), rule=rule, idea=idea, fee=float(fee_pct) / 100, explain=True
    )
    if not out.get("ok"):
        return {"ok": False, "verdict": None, "error": out.get("error")}
    ruling = out["ruling"]
    return {
        "ok": True,
        "verdict": ruling["verdict"],
        "headline": ruling["headline"],
        "reasons": ruling["reasons"],
        "rule": ruling["rule"],
        "rule_text": ruling["rule_text"],
        "trades": ruling["gate"]["trades"],
        "tests": {
            k: {"name": v["name"], "passed": v["passed"], "sentence": v["sentence"]}
            for k, v in ruling["tests"].items()
        },
        "market": {k: out["market"][k] for k in ("symbol", "source", "candles", "start", "end", "hash")},
        "explanation": out.get("explanation", {}).get("text"),
        "note": "The verdict is final and comes from fixed code. PASS means not obviously luck, not a prediction.",
    }


def list_markets() -> dict:
    """List the tokens, time windows and fees the court accepts."""
    m = _svc().markets()
    return {k: m[k] for k in ("tokens", "windows_days", "fees_pct")}


def build_server():
    try:  # MCP Python SDK 2.x
        from mcp.server.mcpserver import MCPServer as Server
    except ImportError:  # 1.x
        from mcp.server.fastmcp import FastMCP as Server
    server = Server("lotcouncil", instructions=INSTRUCTIONS)
    server.tool()(judge_strategy)
    server.tool()(list_markets)
    return server


def main() -> None:
    build_server().run()


if __name__ == "__main__":
    main()
