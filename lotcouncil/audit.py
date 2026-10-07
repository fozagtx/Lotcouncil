"""Audit files: everything needed to re-run a ruling and get the same answer.

An audit file holds the idea, the rule, the exact candles that were judged
(with their hash), the fee, the court's settings and seed, and the result.
``rerun_audit`` checks the hash and runs the court again from the file alone.
"""

from __future__ import annotations

import datetime as dt

import numpy as np
import pandas as pd

from . import COURT_VERSION, __version__
from .court import DEFAULT_THRESHOLDS, CourtError, market_from_frame, public_ruling, run_court
from .data import COLUMNS, DataError, clean_candles, data_hash

AUDIT_FORMAT = "lotcouncil-audit/1"


def _plain(obj):
    """JSON-safe copy (numpy numbers -> Python numbers)."""
    if isinstance(obj, dict):
        return {k: _plain(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_plain(v) for v in obj]
    if isinstance(obj, np.generic):
        return obj.item()
    return obj


def result_summary(ruling: dict) -> dict:
    r = public_ruling(ruling)
    return _plain({k: r[k] for k in ("verdict", "headline", "reasons", "gate", "tests", "stats")})


def build_audit(
    *,
    idea: str,
    rule: dict,
    parsed_by: str,
    market: dict,
    candles: pd.DataFrame,
    ruling: dict,
    explanation: dict | None = None,
) -> dict:
    return _plain(
        {
            "format": AUDIT_FORMAT,
            "created_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "app_version": __version__,
            "court_version": COURT_VERSION,
            "numpy_version": np.__version__,
            "idea": idea,
            "parsed_by": parsed_by,
            "rule": ruling["rule"],
            "rule_text": ruling["rule_text"],
            "market": {k: market[k] for k in ("symbol", "label", "source", "granularity", "candles", "start", "end")},
            "settings": ruling["settings"],
            "data_hash": data_hash(candles),
            "candles": {"columns": COLUMNS, "rows": candles[COLUMNS].values.tolist()},
            "result": result_summary(ruling),
            "explanation": explanation,
            "how_to_rerun": "python -m lotcouncil rerun <this file>",
        }
    )


def _compare(a, b, path: str, out: list[str], tol: float = 1e-9) -> None:
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            _compare(a.get(k), b.get(k), f"{path}.{k}" if path else k, out, tol)
    elif isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool):
        if abs(float(a) - float(b)) > tol:
            out.append(f"{path}: file says {a}, re-run gives {b}")
    elif a != b:
        out.append(f"{path}: file says {a!r}, re-run gives {b!r}")


def rerun_audit(audit: dict) -> dict:
    """Re-run a ruling from an audit file. Raises CourtError if the file is unusable."""
    if not isinstance(audit, dict) or audit.get("format") != AUDIT_FORMAT:
        raise CourtError("This is not a Lotcouncil audit file.")
    try:
        cols = audit["candles"]["columns"]
        rows = audit["candles"]["rows"]
        settings = audit["settings"]
        rule = audit["rule"]
    except (KeyError, TypeError):
        raise CourtError("The audit file is missing its candles, rule or settings.") from None

    try:
        df = clean_candles(pd.DataFrame(rows, columns=cols))
        thresholds = settings.get("thresholds") or {}
        fee, seed = float(settings["fee"]), int(settings["seed"])
    except (DataError, ValueError, TypeError, KeyError, AttributeError) as e:
        raise CourtError(f"The audit file's candles or settings are unreadable ({e}).") from None
    hash_now = data_hash(df)
    hash_ok = hash_now == audit.get("data_hash")
    ruling = run_court(market_from_frame(df), rule, fee=fee, thresholds=thresholds, seed=seed)
    now = result_summary(ruling)
    differences: list[str] = []
    _compare(audit.get("result", {}), now, "", differences)
    current = {k: v for k, v in DEFAULT_THRESHOLDS.items() if thresholds.get(k) != v}
    return {
        "same": hash_ok and not differences,
        "hash_ok": hash_ok,
        "data_hash": hash_now,
        "verdict_in_file": audit.get("result", {}).get("verdict"),
        "verdict_now": now["verdict"],
        "differences": differences[:20],
        "court_version_in_file": audit.get("court_version"),
        "court_version_now": COURT_VERSION,
        "thresholds_differ_from_today": sorted(current),
        "ruling": now,
    }
