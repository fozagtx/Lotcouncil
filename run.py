#!/usr/bin/env python3
"""Start Lotcouncil on your computer with one command.

    python run.py              (Windows: py run.py)

It checks Python and Node.js, installs what is missing, builds the web page
the first time (or when it changed), loads settings from a .env file if you
made one, starts the server and opens your browser. Stop it with Ctrl+C.

Options:
    --port 8001        use another port if 8000 is busy
    --no-browser       don't open the browser
    --rebuild          rebuild the web page even if it looks up to date
    --skip-install     don't check or install Python packages
"""

from __future__ import annotations

import argparse
import os
import shutil
import socket
import subprocess
import sys
import threading
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT / "frontend"
BUILT_PAGE = FRONTEND / "build" / "index.html"
NEEDED_MODULES = ("fastapi", "uvicorn", "numpy", "pandas", "requests")


def step(text: str) -> None:
    print(f"\n==> {text}", flush=True)


def stop(problem: str, fix: str) -> None:
    print(f"\n[!] {problem}\n    {fix}\n", file=sys.stderr, flush=True)
    sys.exit(1)


def check_python() -> None:
    if sys.version_info < (3, 10):
        stop(
            f"Python {sys.version.split()[0]} is too old.",
            "Install Python 3.12 from https://www.python.org/downloads/ and run this again.",
        )


def node_major(node: str) -> int:
    out = subprocess.run([node, "--version"], capture_output=True, text=True).stdout.strip()  # e.g. v22.11.0
    try:
        return int(out.lstrip("v").split(".")[0])
    except ValueError:
        return 0


def load_env_file() -> list[str]:
    """Read KEY=VALUE lines from .env into the environment (values already set win)."""
    path = ROOT / ".env"
    loaded = []
    if not path.exists():
        return loaded
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if key and value and key not in os.environ:
            os.environ[key] = value
            loaded.append(key)
    return loaded


def install_python_packages() -> None:
    missing = []
    for name in NEEDED_MODULES:
        try:
            __import__(name)
        except ImportError:
            missing.append(name)
    if not missing:
        print("    Python packages are already installed.")
        return
    print(f"    Installing Python packages (missing: {', '.join(missing)})…")
    result = subprocess.run([sys.executable, "-m", "pip", "install", "-r", str(ROOT / "requirements.txt")])
    if result.returncode != 0:
        stop(
            "Installing the Python packages failed.",
            "Try in a virtual environment (python -m venv .venv), or run: "
            f"{Path(sys.executable).name} -m pip install -r requirements.txt",
        )


def newest_source_time() -> float:
    files = [FRONTEND / "package.json", FRONTEND / "package-lock.json", FRONTEND / "vite.config.ts"]
    files += [p for p in (FRONTEND / "src").rglob("*") if p.is_file()]
    files += [p for p in (FRONTEND / "static").rglob("*") if p.is_file()]
    return max((p.stat().st_mtime for p in files if p.exists()), default=0.0)


def packages_outdated() -> bool:
    """True when the web packages were never installed, or package-lock.json changed since (e.g. after git pull)."""
    installed = FRONTEND / "node_modules" / ".package-lock.json"
    lock = FRONTEND / "package-lock.json"
    if not installed.exists():
        return True
    return lock.exists() and lock.stat().st_mtime > installed.stat().st_mtime


def build_page(force: bool) -> None:
    if BUILT_PAGE.exists() and not force and BUILT_PAGE.stat().st_mtime >= newest_source_time():
        print("    The web page is already built and up to date.")
        return
    npm = shutil.which("npm")
    node = shutil.which("node")
    if not npm or not node:
        stop(
            "Node.js is not installed (it is needed once, to build the web page).",
            "Install the LTS version from https://nodejs.org/ and run this again.",
        )
    if node_major(node) < 20:
        stop("Your Node.js is too old.", "Install Node.js 20 or newer (the LTS version) from https://nodejs.org/.")
    if packages_outdated():
        print("    Installing the web page's packages (first time or after an update, about a minute)…")
        if subprocess.run([npm, "ci"], cwd=FRONTEND).returncode != 0:
            stop("Installing the web page's packages failed.", "Check your internet connection and run this again.")
    print("    Building the web page…")
    if subprocess.run([npm, "run", "build"], cwd=FRONTEND).returncode != 0:
        stop("Building the web page failed.", "Run 'npm run build' inside the frontend folder to see the full error.")


def port_is_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def main() -> int:
    ap = argparse.ArgumentParser(description="Start Lotcouncil on this computer.")
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--no-browser", action="store_true")
    ap.add_argument("--rebuild", action="store_true")
    ap.add_argument("--skip-install", action="store_true")
    args = ap.parse_args()
    os.chdir(ROOT)

    print("Lotcouncil: put your trading idea on trial")
    step("Checking Python")
    check_python()
    print(f"    Python {sys.version.split()[0]} OK.")

    if not args.skip_install:
        step("Checking Python packages")
        install_python_packages()

    step("Checking the web page")
    build_page(args.rebuild)

    step("Loading settings")
    loaded = load_env_file()
    if loaded:
        print(f"    Read from .env: {', '.join(loaded)}")
    else:
        print("    No .env file: the AI is off and a built-in keyword reader is used. (Optional, see docs.)")

    if not port_is_free(args.port):
        stop(
            f"Port {args.port} is already in use (maybe Lotcouncil is already running?).",
            f"Close the other window, or run: python run.py --port {args.port + 1}",
        )

    url = f"http://localhost:{args.port}"
    step(f"Starting Lotcouncil at {url}")
    print("    Press Ctrl+C in this window to stop it.\n", flush=True)
    if not args.no_browser:
        threading.Timer(2.0, webbrowser.open, [url]).start()
    try:
        return subprocess.call(
            [sys.executable, "-m", "uvicorn", "lotcouncil.server:app", "--host", "127.0.0.1", "--port", str(args.port)],
            env=os.environ.copy(),
        )
    except KeyboardInterrupt:
        print("\nStopped. Run 'python run.py' to start again.")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
