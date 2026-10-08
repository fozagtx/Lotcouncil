# DESIGN.md

Design contract for Lotcouncil. Written by design-promax. Agents read this first; do not re-ask the theme while this file exists.

## Theme
- HeroUI Pro theme: Default
- data-theme: light / dark (existing attribute on `<html>`, chosen per user, not flipped)
- CSS: tokens live in `frontend/src/index.css` (Tailwind 4 `@theme`, Maia preset overridden to brand.md); motion keyframes live in the same file
- Style preset: workstation_dense (surface F, trading desk / ops console)
- Routes: `/` is the desk. There is no landing route. One page, one job.
- Stack note: React + Vite + shadcn (Radix base, Maia preset) + Tailwind 4. The recipe, tokens and bans apply; HeroUI component props translate to the shadcn primitives in `frontend/src/components/ui` and the `.btn`, `.chip`, `.panel` patterns below.

## Colors
Brand colors from `brand.md` are kept. Primary is burnt orange, not HeroUI blue.
- Primary: `--primary` #c2410c light / #ff7a2e dark. Background `--background`. Foreground `--foreground`.
- Semantic: success / danger / warning / info from layout.css tokens only. Never raw Tailwind colors (`bg-gray-100`, `text-red-500`).
- Rail: `--rail` dark navy in both modes.
- Light and dark both supported; test every screen in both.

## Typography
- Display and body: Inter Variable. Mono: JetBrains Mono Variable.
- Scale (dense): tiny 11px uppercase tracking-wider labels; small 12.5px body in tables and timeline; medium 13.5px controls; h1 14px semibold; verdict word 24px semibold. Nothing larger than 24px anywhere.
- Numbers: `tabular-nums` in every column; `font-mono` for ids, hashes, timings, rule codes, verdict word.
- Every number carries its unit (ms, %, candles, days).

## Shell (h-screen, full bleed, no max-width, no footer)
```
flex row, h-screen, overflow-hidden
  icon rail     w-14, bg-rail, icons: trial, recent, how it works, audit, API, theme toggle at bottom
  nav column    w-56, border-r, hidden below lg. Two groups, labels tiny uppercase:
                MARKETS   one row per Bitget token: label left, symbol right in mono muted. Click sets the token.
                RECENT    one row per saved ruling: idea short label left, PASS/FAIL right in mono semantic color. Click re-runs it.
                Empty RECENT: one muted row "No rulings yet".
  main          flex-1, min-w-0, overflow-y-auto, p-4, flex col, gap-3
    header strip   h1 "Strategy court" 14px semibold + one tiny muted line: "Fixed code rules PASS or FAIL on hourly Bitget stock-token prices."
                   right: data chip (Live Bitget success / Saved Bitget warning / Waiting neutral; pulsing dot while running),
                   AI chip (AI on info / AI off neutral), "How it works" secondary button.
    command bar    one panel, one row on lg: idea input (single-line, grows to 2 lines) | token select | fee select | window segmented | Judge primary button.
                   No example chips row. No helper paragraph. Placeholder carries the example sentence.
                   Below lg: input full width, controls wrap on a second row, Judge full width.
    kpi strip      one panel, 4 stats in a row (2x2 below sm): Unseen score, Beat random, Score at 3x fees, Trades.
                   label tiny uppercase muted; value 20px semibold mono tabular; color success/danger by pass state; one tiny note line (threshold).
    grid           lg:grid-cols-[minmax(0,1fr)_380px] gap-3, xl:…_420px
      left         chart panel (compact head: symbol + "Bitget spot · 1H candles" + Candles/Result switch + window segmented) then
                   evidence panel with tabs Tests | Trades | Rule | Plain words.
                   Tests tab = three compact rows, not three cards: [A/B/C letter mono] [name + one-line question] [mini chart 160px wide] [value mono] [status chip]. Row height about 72px.
                   Trades tab = existing ledger table, compact rows 32px, header tiny uppercase.
      right        inspector panel:
                   verdict row: status chip size sm (PASSED / FAILED / NOT JUDGED) + verdict word 24px mono semibold + headline 14px semibold.
                   summary: idea in quotes 13px; one muted line market · days · fee; one line "Result after fees X · Just holding Y" mono.
                   notes (saved data, short history) as one warning line only when present.
                   court timeline: existing six rows, 12.5px, mono T+ stamp in primary, right status chip bordered sm.
                   footer: two buttons sm: Export audit (primary flat) + Copy link (bordered). Verdict card moves to a third bordered button only on xl and wider.
                   one tiny muted line under footer: "Not financial advice. A PASS means not obviously luck on this history."
```

## Spacing and shape
- Gap 12px (`gap-3`) everywhere. Panel padding 12px, 16px on lg.
- Radius: panels 8px (`rounded-lg`), controls and chips 6px (`rounded-md`). Never `rounded-full` on this surface, including status dots' containers (the dot itself may be round).
- Borders: 1px `--border`. No shadows on panels.
- Controls: `size sm` = min-h 32px, 13px text, px 10px. Judge button min-h 36px.

## Buttons (workstation_dense matrix)
- Primary: `.btn .btn-primary` flat fill primary, rounded-md, sm.
- Secondary: `.btn .btn-secondary` bordered, rounded-md, sm.
- Danger: not used. There is no destructive action on this surface.
- Ghost: rail icons only.

## States
- No ruling yet (first load): KPI strip shows "–" values with muted notes; chart panel shows "Pick a token and press Judge" in muted text at panel height 280px; inspector shows "No ruling yet" muted + timeline rows all "Waiting". Nothing runs automatically on load. A share URL with a rule still re-runs that ruling.
- Running: skeleton rows matching final row heights inside KPI, chart, tests, inspector. Never a spinner over the whole screen. Judge button shows "Ruling…" and is disabled.
- Error: one ErrorBox card inside the inspector with a Retry button only. No practice fallback.
- Data offline: header data chip turns danger "Bitget offline" when the fetch fails and no snapshot exists.

## Removed
- PRACTICE markets and every reference (picker optgroup, tryPractice, isPractice, practice badges, API practice flag, server-side practice series). `synthetic.py` stays for `scripts/calibrate.py` only.
- Auto-run example ruling on first load (`session.example`).
- Example chips row, helper copy, page footer, "One sentence in, one ruling out".
- KPI "Result after fees" and "Just holding" as stats (they move to the inspector summary line).

## Motion
- Tokens: `frontend/src/index.css` (`.reveal`, `.swap`, `.pop` classes built from design-promax motion/_root.css).
- Moments on this screen (cap 3):
  1. Skeleton reveal (snippet 14) when a result replaces skeletons: opacity + 2px blur, var(--duration-slow), var(--ease-in-out).
  2. Text swap (snippet 04) on the verdict word and status chips when state changes: 4px y + 2px blur, var(--duration-quick).
  3. Number pop-in (snippet 02) on the four KPI values: 8px y, var(--digit-dur), stagger var(--digit-stagger).
- hover var(--duration-quick) ease-out; press scale .98 var(--duration-micro). Open slower than close.
- All of it off under prefers-reduced-motion (fade only, no transform/blur).
- No Rare UI atoms on this surface.

## Copy
- Human product language. No eng jargon in UI (no "NDJSON", "fingerprint", "seed" on the surface; they live in the audit file and How it works).
- No em dashes. Sentence case. Buttons are verbs: Judge, Export audit, Copy link, Retry.
- Labels max 3 words.

## Hard bans
- Pills (`rounded-full`) on controls or chips; hero blocks; marketing subtitles; a page footer.
- Fake metrics, sample data, demo rulings, practice markets.
- Spinner overlay; invented KPIs; fake "all systems operational" chips without a data source.
