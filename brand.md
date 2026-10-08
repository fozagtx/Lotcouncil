# Brand — Lotcouncil

_Status: active_

**Lotcouncil** — a courtroom for trading ideas: it tests whether an idea is real or luck and rules PASS or FAIL.

Direction: a professional trading terminal. Navy icon rail and white panels on cool gray (from an execution-inspector reference), burnt-orange actions and solid orange active tabs (from a trading-terminal reference), teal and red for verdicts and candles. Mood: premium, bold. Category: DeFi / trading tools.

The tokens live in `frontend/src/routes/layout.css` (light and dark are each chosen, not flipped). Every text pair below passes WCAG AA; contrast was computed from the hex values.

## Palette

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| background | `#f3f4f6` | `#0b1220` | page |
| card | `#ffffff` | `#111a2e` | panels |
| card-raised | `#f8fafc` | `#152038` | timeline cards, table stripes |
| foreground | `#0f172a` | `#e6eaf2` | body text |
| subtle | `#334155` | `#c4cbd8` | secondary text |
| muted-foreground | `#5b6577` (5.3:1 on gray) | `#94a3b8` (6.8:1) | labels, captions |
| border / strong | `#e5e7eb` / `#d1d5db` | `#1f2a44` / `#2c3a5a` | hairlines, inputs |
| primary | `#c2410c` (white text 5.2:1) | `#ff7a2e` (navy text 7.2:1) | buttons, active tabs |
| brand | `#ea580c` | `#ff7a2e` | wordmark, logo, tab underline (large or non-text only) |
| success | `#12957a` mark, `#0b7a63` text on `#e6f6f1` (4.7:1) | `#2fbf98`, `#34d3a8` on `#0e3b33` | PASS, up candles, wins |
| danger | `#e5383b` mark, `#c81e2c` text on `#fdecee` (5.0:1) | `#f0525a`, `#ff6b72` on `#3a1418` | FAIL, down candles, losses |
| info | `#1d4ed8` on `#eff6ff` (6.2:1) | `#6ea8ff` on `#13254a` | AI badge, "never seen", timings |
| warning | `#b45309` on `#fff4e5` (4.6:1) | `#fbbf5a` on `#3a2a0e` | practice / saved data |
| rail | `#0f1729`, icons `#94a3b8` (7.0:1) | `#070c18` | left navigation |
| ring | `#2563eb` | `#6ea8ff` | focus outline |

## Typography

- **Inter Variable** for all UI text; `tabular-nums` (`.num`) wherever numbers line up or change.
- **JetBrains Mono Variable** for identifiers: trade IDs, data fingerprints, rule codes, timings.
- Panel titles: 12.5px bold uppercase, 0.06em tracking. Labels: 11.5px semibold uppercase. Nothing below 11px; body 13–16px.
- Fonts are bundled from npm (`@fontsource-variable/*`), so the page makes no third-party requests.

## Shape and spacing

- Panels: 12px radius, 1px border, no shadow (border or shadow, never both). Controls: 8px radius, at least 40px tall.
- 4px spacing grid; 16px page gutter on phones, 24px on desktop.
- Motion: 100ms colour feedback, 50ms press, skeleton shimmer; all off under `prefers-reduced-motion`.

## Voice

Plain, specific and calm. Say what the court found and what to do next ("Try the 180-day window"), never hype. A PASS is always paired with "not a prediction". No jargon on the surface; terms like out-of-sample live in "How it works".

## Do / don't

- Do use primary orange for one main action per panel; use secondary buttons elsewhere.
- Do pair every status colour with a word or icon (PASSED, FAILED, ✓, ✕).
- Don't put small text in the bright brand orange; use `primary` for text.
- Don't add controls that do nothing: every button on the page works.
