# Run Lotcouncil on your computer

This guide takes you from nothing to Lotcouncil running in your browser. It takes about 10 minutes the first time. After that, starting it is one command.

You don't need to know how to code. You will copy a few commands into a terminal window.

---

## 1. Install three free tools (one time only)

| Tool | Why | Get it |
| --- | --- | --- |
| **Git** | Downloads the code | <https://git-scm.com/downloads> |
| **Python 3.12** (3.10 or newer works) | Runs the court | <https://www.python.org/downloads/> |
| **Node.js LTS** (20 or newer) | Builds the web page, once | <https://nodejs.org/> (pick "LTS") |

**Windows:** when the Python installer opens, tick **"Add python.exe to PATH"** at the bottom of the first screen before you click Install.

**Mac:** you can also install all three with [Homebrew](https://brew.sh): `brew install git python@3.12 node`.

### Check they're installed

Open a terminal:

- **Windows:** press the Windows key, type `PowerShell`, press Enter.
- **Mac:** press Cmd+Space, type `Terminal`, press Enter.
- **Linux:** open your Terminal app.

Then paste these one at a time. Each should print a version number.

```bash
git --version
python --version      # Windows: py --version   Mac/Linux: python3 --version
node --version
```

If one says "not recognized" or "command not found", install that tool again (and on Windows, restart PowerShell afterwards).

---

## 2. Download Lotcouncil

In the same terminal, go to where you want the folder (your home folder is fine) and run:

```bash
git clone -b claude/dreamy-newton-1s7ov4 https://github.com/fozagtx/Lotcouncil.git
cd Lotcouncil
```

The `-b claude/dreamy-newton-1s7ov4` part matters: that branch is where the app lives until it is merged into `main`.

<details>
<summary>No Git? Download a ZIP instead</summary>

Open <https://github.com/fozagtx/Lotcouncil/archive/refs/heads/claude/dreamy-newton-1s7ov4.zip>, unzip it, then in the terminal `cd` into the unzipped folder.
</details>

---

## 3. Start it

From inside the `Lotcouncil` folder:

**Windows (PowerShell)**

```powershell
py run.py
```

**Mac / Linux**

```bash
python3 run.py
```

The first time, it installs what it needs and builds the web page. That takes 1 to 3 minutes. Then your browser opens **<http://localhost:8000>** with Lotcouncil in it. If the browser doesn't open, type that address in yourself.

Keep the terminal window open while you use the app. To stop it, click the terminal and press **Ctrl+C**.

Next time, just run `py run.py` (Windows) or `python3 run.py` (Mac/Linux) again. It starts in a few seconds.

<details>
<summary>Optional: use a virtual environment (keeps Lotcouncil's Python packages separate)</summary>

Do this once, inside the `Lotcouncil` folder, before step 3:

**Windows (PowerShell)**

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
```

If PowerShell refuses to run the activate script, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, answer `Y`, and try again.

**Mac / Linux**

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Your prompt now starts with `(.venv)`. Run `python run.py` (inside a virtual environment, `python` works on every system). Each time you open a new terminal, activate it again with the same activate command.
</details>

---

## 4. Use it

1. Type a trading idea in **Your idea**, for example `buy when the 10 hour average crosses above the 40 hour average`, or click one of the **Examples**.
2. Pick a **Token** (a Bitget stock token such as rAAPL, or a practice market), a **Fee** and a **History** window.
3. Press **Put it on trial**. The **Ruling inspector** on the right shows PASS or FAIL and each step of the court as it runs.
4. Below the chart, the tabs show the three **Tests**, every **Trade** the rule made, the ruling in **Plain words**, and the **Rule** (where you can change the numbers and run again).
5. In the inspector, **Verdict card** copies an image you can post, **Copy link** copies a link that re-runs the same ruling, and **Export audit** saves a file anyone can re-check.

### Real Bitget prices vs practice prices

The stock tokens (rAAPL, rTSLA, …) load live hourly prices from Bitget. If your internet connection can't reach Bitget, the app tells you and offers a **practice market** instead. Practice markets are made-up prices, clearly labelled, and always work.

To check that your computer can reach Bitget (and save a backup copy of the prices), run in a second terminal, from the `Lotcouncil` folder:

```bash
python3 scripts/fetch_candles.py rAAPLUSDT     # Windows: py scripts/fetch_candles.py rAAPLUSDT
```

It prints how many days of history the token has. The saved copy in `data/snapshots/` is used automatically whenever Bitget can't be reached.

---

## 5. Turn on the AI (optional)

Without an AI key, Lotcouncil still works: a built-in reader understands your idea and a built-in summary explains the ruling. With a key, a Qwen model on Nebius AI Studio reads freer sentences and writes the explanation. It can never change the verdict.

1. Get an API key from Nebius AI Studio.
2. In the `Lotcouncil` folder, copy the example settings file:
   - Windows: `copy .env.example .env`
   - Mac/Linux: `cp .env.example .env`
3. Open `.env` in any text editor (Notepad is fine) and put your key after `NEBIUS_API_KEY=`, with no spaces:
   ```
   NEBIUS_API_KEY=your-key-here
   ```
4. Save, stop Lotcouncil (Ctrl+C) and start it again. The header now shows **AI · Qwen…** instead of **AI off**.

Keep `.env` private. It is already excluded from Git, so it won't be uploaded.

---

## 6. Update to the newest version

```bash
git pull
python3 run.py --rebuild       # Windows: py run.py --rebuild
```

---

## 7. Connect an AI agent (optional)

Lotcouncil includes an MCP tool called `judge_strategy`, so an AI agent can put its own idea on trial before it trades. Add this to your MCP-compatible AI app's server settings, changing the folder path to where you put Lotcouncil:

```json
{
  "mcpServers": {
    "lotcouncil": {
      "command": "python",
      "args": ["-m", "lotcouncil", "mcp"],
      "cwd": "C:\\Users\\you\\Lotcouncil"
    }
  }
}
```

On Mac/Linux use `"command": "python3"` and a path like `"/Users/you/Lotcouncil"`. If you made a virtual environment, use its Python instead: `C:\\Users\\you\\Lotcouncil\\.venv\\Scripts\\python.exe` or `/Users/you/Lotcouncil/.venv/bin/python`.

### Bitget Agent Hub (trading access, optional)

Bitget's own agent tools let an AI agent trade on your Bitget account. **Only set this up if you want an agent to place real orders**; Lotcouncil itself only reads public prices and never needs it. You need Node.js 20 or newer.

```bash
npx @bitget-ai/bitget-agent-skill --target all --skill agentic
npm i -g @bitget-ai/bitget-agent-mcp
```

Then add a server to your AI app with the command `npx -y @bitget-ai/bitget-agent-mcp` (no API key variables), restart the app, and ask the agent to run `authorize_start`. Sign in to Bitget in the browser window that opens, choose the account, press **Allow** and finish device verification. Ask the agent to run `get_auth_status` to confirm. Full guide: [Bitget Agentic Account Connection Guide](https://www.bitget.com/support/articles/12560603894122).

---

## Troubleshooting

| What you see | What to do |
| --- | --- |
| `'python' is not recognized` (Windows) | Use `py` instead of `python`. If that fails too, reinstall Python and tick **Add python.exe to PATH**, then reopen PowerShell. |
| `command not found: python` (Mac/Linux) | Use `python3`. |
| `Node.js is not installed` or `too old` | Install the LTS version from <https://nodejs.org/>, reopen the terminal, run again. |
| `Port 8000 is already in use` | Lotcouncil (or another app) is already running. Close it, or run `py run.py --port 8001` and open <http://localhost:8001>. |
| The page says it "has not been built yet" | Run `py run.py --rebuild` (Mac/Linux: `python3 run.py --rebuild`). |
| `Couldn't load rAAPL prices from Bitget` | Your network can't reach Bitget right now. Click **Try it on a practice market**, or try again later. Run `scripts/fetch_candles.py` (section 4) to test the connection. |
| `Too many rulings for now` | You hit the limit of 60 rulings per 10 minutes. Wait a few minutes, or add `COURT_RATE_LIMIT=500` to your `.env` and restart. |
| Errors while installing Python packages | Use a virtual environment (step 3, optional box), then run again. |
| Anything else | Run `py run.py --rebuild` once. If it still fails, copy the last lines of the terminal output into an issue on GitHub. |

---

## Command cheat sheet

| Task | Windows | Mac / Linux |
| --- | --- | --- |
| Start | `py run.py` | `python3 run.py` |
| Start on another port | `py run.py --port 8001` | `python3 run.py --port 8001` |
| Start without opening the browser | `py run.py --no-browser` | `python3 run.py --no-browser` |
| Rebuild the page | `py run.py --rebuild` | `python3 run.py --rebuild` |
| Judge an idea in the terminal | `py -m lotcouncil judge "buy when the 10 hour average crosses above the 40 hour average" --symbol PRACTICE-TREND` | same, with `python3` |
| Re-check an audit file | `py -m lotcouncil rerun my-audit.json` | `python3 -m lotcouncil rerun my-audit.json` |
| Stop | Ctrl+C | Ctrl+C |

Not financial advice. A PASS means "not obviously luck on this history", not that an idea will make money.
