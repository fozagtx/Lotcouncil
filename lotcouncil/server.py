"""The web app: a JSON API plus the Svelte site built into ``frontend/build``.

Run locally with ``uvicorn lotcouncil.server:app --reload`` (or ``python -m lotcouncil serve``)
after ``cd frontend && npm ci && npm run build``. For frontend work, run ``npm run dev`` in
``frontend/`` too: it proxies ``/api`` here. The Nebius key is read from the server's
environment and never sent to the page.
"""

from __future__ import annotations

import json
import os
import threading
import time
from collections import defaultdict, deque
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from . import __version__
from .audit import rerun_audit
from .court import CourtError
from .data import DataError
from .parse import ParseError
from .rules import RuleError
from .service import CourtService

WEB_DIR = Path(os.environ.get("COURT_WEB_DIR", Path(__file__).resolve().parent.parent / "frontend" / "build"))
NOT_BUILT = (
    "<!doctype html><title>Lotcouncil</title><p>The page has not been built yet. Run "
    "<code>cd frontend &amp;&amp; npm ci &amp;&amp; npm run build</code>, then restart the server. "
    "The API is up at <a href='/api/docs'>/api/docs</a>.</p>"
)
MAX_BODY = 6_000_000


class RateLimiter:
    """Sliding-window counter per visitor."""

    def __init__(self, limit: int, window_seconds: float):
        self.limit = limit
        self.window = window_seconds
        self.hits: dict[str, deque] = defaultdict(deque)
        self.lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        with self.lock:
            q = self.hits[key]
            while q and now - q[0] > self.window:
                q.popleft()
            if len(q) >= self.limit:
                return False
            q.append(now)
            if len(self.hits) > 50_000:  # forget idle visitors
                for k in [k for k, v in self.hits.items() if not v]:
                    del self.hits[k]
            return True


def create_app(service: CourtService | None = None) -> FastAPI:
    service = service or CourtService()
    app = FastAPI(title="Lotcouncil", version=__version__, docs_url="/api/docs", redoc_url=None)
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    window = float(os.environ.get("COURT_RATE_WINDOW_SECONDS", 600))
    court_limit = RateLimiter(int(os.environ.get("COURT_RATE_LIMIT", 60)), window)
    ai_limit = RateLimiter(int(os.environ.get("COURT_AI_LIMIT", 20)), window)

    def visitor(request: Request) -> str:
        fwd = request.headers.get("x-forwarded-for")
        if fwd and os.environ.get("COURT_TRUST_PROXY", "on") == "on":
            return fwd.split(",")[-1].strip()  # the hop our own proxy added
        return request.client.host if request.client else "unknown"

    def error(message: str, status: int = 400) -> JSONResponse:
        return JSONResponse({"error": message}, status_code=status)

    async def read_json(request: Request) -> dict:
        try:
            declared = int(request.headers.get("content-length") or 0)
        except ValueError:
            declared = 0
        if declared > MAX_BODY:
            raise CourtError("That file is too large.")
        chunks, size = [], 0
        async for chunk in request.stream():
            size += len(chunk)
            if size > MAX_BODY:
                raise CourtError("That file is too large.")
            chunks.append(chunk)
        body = b"".join(chunks)
        try:
            data = json.loads(body or b"{}")
        except ValueError:
            raise CourtError("That is not valid JSON.") from None
        if not isinstance(data, dict):
            raise CourtError("Expected a JSON object.")
        return data

    @app.middleware("http")
    async def headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    @app.exception_handler(CourtError)
    @app.exception_handler(DataError)
    @app.exception_handler(RuleError)
    @app.exception_handler(ParseError)
    async def plain_error(_request: Request, exc: Exception):
        return error(str(exc), 422)

    @app.get("/api/health")
    def health():
        return {"ok": True, "version": __version__, "ai": service.ai.enabled}

    @app.get("/api/markets")
    def markets():
        return service.markets()

    @app.get("/api/prices")
    def prices(symbol: str, days: int = 90):
        return service.prices(symbol, days)

    @app.post("/api/understand")
    async def understand(request: Request):
        data = await read_json(request)
        who = visitor(request)
        if not court_limit.allow(who):
            return error("Too many requests. Wait a few minutes and try again.", 429)
        return service.understand(str(data.get("idea", "")), allow_ai=ai_limit.allow(who))

    @app.post("/api/judge")
    async def judge(request: Request):
        data = await read_json(request)
        who = visitor(request)
        if not court_limit.allow(who):
            return error("Too many rulings. Wait a few minutes and try again.", 429)
        rule = data.get("rule")
        idea = str(data.get("idea", ""))[:400]
        # Asking for an AI explanation costs one AI call; reading the idea costs another.
        allow_ai = ai_limit.allow(who) and (rule is not None or ai_limit.allow(who))
        try:
            fee = float(data.get("fee_pct", 0.1)) / 100
            days = int(data.get("days", 90))
            end = int(data["end"]) * 1000 if data.get("end") else None
        except (TypeError, ValueError):
            return error("The fee, window and end time must be numbers.")
        events = service.judge_events(
            symbol=str(data.get("symbol", "")),
            days=days,
            rule=rule if isinstance(rule, dict) else None,
            idea=idea,
            fee=fee,
            end_ms=end,
            allow_ai=allow_ai,
            explain=bool(data.get("explain", True)),
        )

        def stream():
            for ev in events:
                yield json.dumps(ev, separators=(",", ":")) + "\n"

        return StreamingResponse(stream(), media_type="application/x-ndjson", headers={"Cache-Control": "no-store"})

    @app.post("/api/audit")
    async def audit(request: Request):
        data = await read_json(request)
        if not court_limit.allow(visitor(request)):
            return error("Too many requests. Wait a few minutes and try again.", 429)
        try:
            fee = float(data.get("fee_pct", 0.1)) / 100
            end = int(data["end"]) * 1000
            days = int(data.get("days", 90))
        except (KeyError, TypeError, ValueError):
            return error("The audit request needs a fee, a window and an end time.")
        explanation = data.get("explanation") if isinstance(data.get("explanation"), dict) else None
        file = service.audit(
            symbol=str(data.get("symbol", "")),
            days=days,
            end_ms=end,
            rule=data.get("rule"),
            fee=fee,
            idea=str(data.get("idea", ""))[:400],
            parsed_by=str(data.get("parsed_by", "user"))[:20],
            explanation=explanation,
        )
        name = f"lotcouncil-{file['market']['symbol'].removesuffix('USDT')}-{file['result']['verdict'].lower()}.json"
        return JSONResponse(file, headers={"Content-Disposition": f'attachment; filename="{name}"'})

    @app.post("/api/rerun")
    async def rerun(request: Request):
        data = await read_json(request)
        if not court_limit.allow(visitor(request)):
            return error("Too many requests. Wait a few minutes and try again.", 429)
        return rerun_audit(data)

    index_file = WEB_DIR / "index.html"
    if index_file.exists():

        @app.get("/")
        def index():
            return FileResponse(index_file, headers={"Cache-Control": "no-cache"})

        app.mount("/", StaticFiles(directory=WEB_DIR), name="web")
    else:

        @app.get("/")
        def not_built():
            return HTMLResponse(NOT_BUILT, status_code=503)

    return app


app = create_app()
