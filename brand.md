# Brand — Lotcouncil

_Status: active_

**Lotcouncil** — a courtroom for trading ideas: it tests whether an idea is real or luck and rules PASS or FAIL.

Direction: built on [VengeanceUI](https://www.vengenceui.com) ([source](https://github.com/Ashutoshx7/VengeanceUI), MIT). The page uses its zinc neutrals, a black-and-white primary, 4/6/8px radii and 150ms transitions, and Svelte 5 ports of its components (in `frontend/src/lib/components/ui/`, with the MIT notice in `LICENSE-VengeanceUI.txt`). Green and red are kept for verdicts and candles. Mood: premium, bold. Category: DeFi / trading tools.

The tokens live in `frontend/src/routes/layout.css`; light and dark are each chosen, not flipped. Every text pair below passes WCAG AA (contrast computed from the hex values).

## Components (VengeanceUI ports)

| Port | Used for |
| --- | --- |
| Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter | every panel |
| Button (default, outline, secondary, ghost, link, destructive) | all actions |
| RadialGlowButton | the one main action, "Put it on trial" |
| SpotlightNavbar (as `SpotlightTabs`) | the Tests / Trades / Plain words / Rule tabs |
| Tabs list styling (as `ToggleTabs`, a radio group) | history window, chart view |
| BorderBeam | the Ruling card while the court runs, and around the verdict |
| StatsCounter | key numbers and test results count up when they appear |
| Badge (+ soft status variants) | statuses, sources, verdicts |
| Alert (+ warning variant) | errors and data notes |
| CopyButton | copying the data fingerprint |
| Textarea, Kbd, Skeleton, Spinner, Empty, Label/Input styling | form, loading and empty states |

Icons are [Lucide](https://lucide.dev) (`@lucide/svelte`), the set VengeanceUI uses.

## Palette

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| background | `#fafafa` | `#09090b` | page |
| card | `#ffffff` | `#0f0f11` | panels |
| card-raised / muted | `#fafafa` / `#f4f4f5` | `#18181b` / `#27272a` | inset areas, tab tracks, skeletons |
| foreground | `#09090b` | `#fafafa` | body text |
| subtle | `#3f3f46` | `#d4d4d8` | secondary text |
| muted-foreground | `#63636b` (5.4:1 on muted) | `#a1a1aa` (5.8:1 on muted) | labels, captions |
| border / strong | `#e4e4e7` / `#d4d4d8` | `#27272a` / `#3f3f46` | hairlines, inputs |
| primary | `#09090b` on white text | `#fafafa` with black text | default buttons, logo tile, focus ring (at 50%) |
| success | `#16a34a` mark, `#15803d` text on `#f0fdf4` (4.8:1) | `#22c55e`, `#4ade80` on `#052e16` | PASS, up candles, wins |
| danger | `#dc2626` mark, `#b91c1c` text on `#fef2f2` (5.9:1) | `#ef4444`, `#f87171` on `#450a0a` | FAIL, down candles, losses |
| info | `#1d4ed8` on `#eff6ff` (6.2:1) | `#60a5fa` on `#172554` | AI badge, "never seen", running |
| warning | `#a16207` on `#fefce8` (4.8:1) | `#facc15` on `#422006` | practice / saved data |
| brand accent | `#ea580c` | `#fb923c` | the rule's holding periods on charts, BorderBeam light (with `#9c40ff`) |

## Typography

- **IBM Plex Sans** (variable) for all UI text; `tabular-nums` wherever numbers line up or change.
- **IBM Plex Mono** for identifiers only: trade IDs, data fingerprints, rule codes.
- Sentence case everywhere. Card titles 16px semibold with tight tracking; labels 14px medium. Nothing below 11px; body 13–16px.
- Fonts are bundled from npm (`@fontsource*/ibm-plex-*`), so the page makes no third-party requests.

## Shape and spacing

- Cards: 12px radius, 1px border, small shadow (VengeanceUI Card). Controls: 6px radius, 36px tall (40px on touch screens).
- Focus: a 3px ring in the primary colour at 50%.
- 16px page gutter on phones, 24px on desktop; 24px between cards on desktop.
- Motion: 150ms colour transitions, counters, the spotlight and the border beam. All of it stops under `prefers-reduced-motion`; counters then show the final number at once.

## Voice

Plain, specific and calm. Say what the court found and what to do next ("Try the 180-day window"), never hype. A PASS is always paired with "not a prediction". No jargon on the surface; terms like out-of-sample live in "How it works".

## Do / don't

- Do use the radial glow button only for the main action; use outline buttons elsewhere.
- Do pair every status colour with a word or icon (Passed, Failed, ✓, ✕).
- Don't add controls that do nothing: every button on the page works. No sidebar for decoration.
- Don't show made-up data to users. Practice markets are developer-only (`COURT_PRACTICE=on`) and always labelled.
- Don't let a counter rest on a number that isn't the result: off-screen counters show the real value straight away.
