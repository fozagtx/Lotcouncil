"""Lotcouncil on Hugging Face: a Gradio app whose functions are exposed as MCP tools.

Run locally with ``python app.py`` (serves on :7860). The MCP endpoint is
``/gradio_api/mcp/sse``.
"""

from __future__ import annotations

import json

import gradio as gr

from lotcouncil import mcp_server


def judge_strategy(
    idea: str = "",
    symbol: str = "rAAPLUSDT",
    days: int = 90,
    fee_pct: float = 0.1,
    rule_json: str = "",
) -> dict:
    """Put a trading idea on trial and return the court's PASS or FAIL ruling.

    The verdict comes from fixed deterministic code, never from a model. PASS means
    "not obviously luck on this history", not a prediction. Lotcouncil never places
    or recommends trades.

    Give either `idea` in plain English (e.g. "buy when the 10 hour average crosses
    above the 40 hour average") or an exact `rule_json` — one of three shapes:
    `{"type":"ma_cross","fast":10,"slow":40}`,
    `{"type":"breakout","lookback":48,"exit_lookback":24}`,
    `{"type":"dip_buy","lookback":24,"drop_pct":2,"max_hold":48}`.

    Args:
        idea: The idea in plain English. Ignored when `rule_json` is given.
        symbol: A Bitget tokenized-stock symbol such as "rAAPLUSDT".
        days: Days of hourly candles to judge on: 30, 60, 90 or 180.
        fee_pct: Fee per position change in percent: 0.05, 0.1 or 0.2.
        rule_json: Optional exact rule as a JSON object (see shapes above).
    """
    rule = None
    if rule_json.strip():
        try:
            rule = json.loads(rule_json)
        except json.JSONDecodeError as e:
            return {"ok": False, "verdict": None, "error": f"rule_json is not valid JSON: {e}"}
    return mcp_server.judge_strategy(
        idea=idea, symbol=symbol, days=days, fee_pct=fee_pct, rule=rule
    )


def list_markets() -> dict:
    """List the tokens, time windows and fees the court accepts."""
    return mcp_server.list_markets()


with gr.Blocks(title="Lotcouncil") as demo:
    gr.Markdown("# Lotcouncil\nPut a trading idea on trial before anyone acts on it.")
    gr.Interface(
        judge_strategy,
        inputs=[
            gr.Textbox(label="Idea", value="buy when the 10 hour average crosses above the 40 hour average"),
            gr.Textbox(label="Symbol", value="rAAPLUSDT"),
            gr.Number(label="Days", value=90),
            gr.Number(label="Fee %", value=0.1),
            gr.Textbox(label="Rule JSON (optional)", value=""),
        ],
        outputs=gr.JSON(label="Ruling"),
    )
    gr.Interface(list_markets, inputs=[], outputs=gr.JSON(label="Markets"))


if __name__ == "__main__":
    demo.launch(mcp_server=True, server_name="0.0.0.0", server_port=7860)
