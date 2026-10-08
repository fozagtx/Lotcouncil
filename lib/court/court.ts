import type { Candles, ChartData, DataFrame, Gate, Market, MarketInfo, Ruling, Rule, TestA, TestB, TestC, Trade } from './types';
import { describe_rule, positions, validate_rule, warmup } from './rules';

export class CourtError extends Error {}

const SEED = 20261007;
export const COURT_VERSION = '1.0.0';

const DEFAULT_THRESHOLDS: Record<string, number> = {
  min_candles: 500,
  min_trades: 10,
  split: 0.6,
  unseen_score_min: 0.5,
  copies: 500,
  block_hours: 24,
  beat_share_min: 0.95,
  stress_fee_mult: 3.0,
  stress_score_min: 0.0,
  weekend_loss_max_share: 0.5,
};

const THRESHOLD_BOUNDS: Record<string, [number, number]> = {
  min_candles: [100, 100_000],
  min_trades: [1, 10_000],
  split: [0.3, 0.9],
  unseen_score_min: [-100, 100],
  copies: [20, 5_000],
  block_hours: [1, 24 * 14],
  beat_share_min: [0.5, 0.999],
  stress_fee_mult: [1, 20],
  stress_score_min: [-100, 100],
  weekend_loss_max_share: [0, 1],
};

export const MAX_CANDLES = 20_000;
export const DEFAULT_FEE = 0.001;
export const FEE_CHOICES = [0.0005, 0.001, 0.002];

export const TEST_INFO: Record<string, { name: string; question: string }> = {
  A: { name: 'Unseen data', question: 'Does it work on data it never saw?' },
  B: { name: 'Random timing', question: 'Is the timing better than chance?' },
  C: { name: 'Stress', question: 'Does it survive a worse world?' },
};

export function marketFromFrame(df: DataFrame): Market {
  if (!df.time || !df.close) throw new CourtError('The price data is missing its time or close column.');
  return { time: df.time, close: df.close };
}

function score(returns: number[], barsPerYear: number): number {
  const n = returns.length;
  if (n < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / n;
  const varSum = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0);
  const sd = Math.sqrt(varSum / (n - 1));
  if (!Number.isFinite(sd) || sd < 1e-12) return 0;
  return (mean / sd) * Math.sqrt(barsPerYear);
}

function scoreRows(rows: number[][], barsPerYear: number): number[] {
  return rows.map((r) => score(r, barsPerYear));
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function weekendMask(timeMs: number[]): boolean[] {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  });
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return timeMs.map((ms) => {
    const parts = fmt.formatToParts(new Date(ms));
    const weekday = parts.find((p) => p.type === 'weekday')?.value || '';
    const hourStr = parts.find((p) => p.type === 'hour')?.value || '0';
    const hour = Number(hourStr);
    const dow = dayMap[weekday];
    if (dow === undefined) return false;
    return dow === 5 || (dow === 4 && hour >= 20) || (dow === 6 && hour < 20);
  });
}

function weekendCheck(total: number, weekendResult: number, maxShare: number): [boolean, number] {
  const loss = Math.max(0, -weekendResult);
  if (loss === 0) return [true, 0];
  if (total > 0) return [loss / total < maxShare, loss / total];
  return [false, Infinity];
}

function countTrades(pos: number[]): number {
  let count = 0;
  for (let i = 0; i < pos.length; i++) {
    const prev = i === 0 ? 0 : pos[i - 1];
    if (pos[i] > 0 && prev === 0) count++;
  }
  return count;
}

function r(x: number, nd = 3): number {
  return Number.isFinite(x) ? Math.round(x * 10 ** nd) / 10 ** nd : 0;
}

function pct(x: number, nd = 2): number {
  return r(100 * x, nd);
}

function fmtScore(x: number): string {
  return `${x.toFixed(2)}`;
}

function fmtPct(x: number): string {
  const a = Math.abs(x);
  if (a >= 10) return `${Math.round(x)}%`;
  if (a >= 1) return `${x.toFixed(1)}%`;
  return `${x.toFixed(2)}%`;
}

function resolve(thresholds?: Record<string, number> | null): Record<string, number> {
  const th = { ...DEFAULT_THRESHOLDS };
  if (thresholds) {
    const unknown = Object.keys(thresholds).filter((k) => !(k in th));
    if (unknown.length) throw new CourtError(`Unknown court setting: ${unknown.sort().join(', ')}.`);
    for (const [k, v] of Object.entries(thresholds)) {
      const val = Number(v);
      if (!Number.isFinite(val)) throw new CourtError(`Court setting ${k} must be a number.`);
      const [lo, hi] = THRESHOLD_BOUNDS[k];
      if (!(lo <= val && val <= hi)) throw new CourtError(`Court setting ${k} must be between ${lo} and ${hi}.`);
      th[k] = val;
    }
  }
  return th;
}

// Seeded RNG: mulberry32
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cumprod(x: number[]): number[] {
  const out = new Array(x.length);
  let prod = 1;
  for (let i = 0; i < x.length; i++) {
    prod *= 1 + x[i];
    out[i] = prod - 1;
  }
  return out;
}

export function* iterCourt(
  market: Market,
  rule: Rule,
  fee = DEFAULT_FEE,
  thresholds?: Record<string, number> | null,
  seed = SEED
): Generator<{ stage: string; payload: unknown }> {
  const th = resolve(thresholds);
  try {
    validate_rule(rule);
  } catch (e) {
    throw new CourtError((e as Error).message);
  }
  if (!(0 <= fee && fee < 0.05)) throw new CourtError('The fee must be between 0% and 5% per position change.');

  const close = market.close;
  const time = market.time;
  const n = close.length;
  if (n > MAX_CANDLES) throw new CourtError(`That is ${n} candles; the court judges at most ${MAX_CANDLES} at a time.`);
  if (n < th.min_candles) {
    throw new CourtError(
      `Only ${n} candles are available here; the court needs at least ${th.min_candles} to judge. ` +
      'Pick a longer time window or another token.'
    );
  }
  if (!close.every((c) => Number.isFinite(c) && c > 0)) throw new CourtError('The price data has missing or non-positive prices, so the court cannot use it.');
  for (let i = 1; i < n; i++) {
    if (time[i] <= time[i - 1]) throw new CourtError('The candles are out of order or repeated, so the court cannot use them.');
  }
  if (warmup(rule) > n / 2) {
    throw new CourtError(
      `This rule needs ${warmup(rule)} candles before its first decision, which is more than half ` +
      `of the ${n} candles available. Use shorter lengths or a longer window.`
    );
  }

  const diffs: number[] = [];
  for (let i = 1; i < n; i++) diffs.push(time[i] - time[i - 1]);
  const sortedDiffs = diffs.slice().sort((a, b) => a - b);
  const medianDiff = sortedDiffs[Math.floor(sortedDiffs.length / 2)];
  const barSeconds = medianDiff / 1000;
  const barsPerYear = (365.25 * 86400) / barSeconds;

  const ret = new Array(n).fill(0);
  for (let i = 1; i < n; i++) ret[i] = close[i] / close[i - 1] - 1;
  const pos = positions(rule, close);
  const changes = new Array(n).fill(0);
  changes[0] = Math.abs(pos[0] - 0);
  for (let i = 1; i < n; i++) changes[i] = Math.abs(pos[i] - pos[i - 1]);
  const gross = pos.map((p, i) => p * ret[i]);
  const net = gross.map((g, i) => g - fee * changes[i]);
  const trades = countTrades(pos);

  const minTrades = Math.floor(th.min_trades);
  const gateOk = trades >= minTrades;
  const gate: Gate = {
    passed: gateOk,
    trades,
    min_trades: minTrades,
    sentence: gateOk
      ? `It made ${trades} trades, enough to judge (at least ${minTrades} are needed).`
      : trades === 0
        ? `It never traded; the court needs at least ${minTrades} trades to judge.`
        : `It made only ${trades} trade${trades !== 1 ? 's' : ''}; the court needs at least ${minTrades} to judge.`,
  };
  yield { stage: 'gate', payload: gate };

  const tests: { A?: TestA; B?: TestB; C?: TestC } = {};
  let copyScores: number[] = [];
  const split = Math.floor(n * th.split);
  const stressNet = gross.map((g, i) => g - fee * th.stress_fee_mult * changes[i]);

  if (gateOk) {
    // A. Unseen data
    const sUnseen = score(net.slice(split), barsPerYear);
    const sSeen = score(net.slice(0, split), barsPerYear);
    const aOk = sUnseen > th.unseen_score_min;
    const unseenPct = 100 * (1 - th.split);
    const testA: TestA = {
      name: TEST_INFO.A.name,
      question: TEST_INFO.A.question,
      passed: aOk,
      score_unseen: r(sUnseen),
      score_seen: r(sSeen),
      threshold: th.unseen_score_min,
      trades_unseen: countTrades(pos.slice(split)),
      return_unseen_pct: pct(net.slice(split).reduce((a, b) => a + b, 0)),
      unseen_share_pct: r(unseenPct, 0),
      sentence: aOk
        ? `On the last ${unseenPct.toFixed(0)}% of the history, which it never saw, it scored ${fmtScore(sUnseen)}, above the ${th.unseen_score_min} it needs.`
        : `On the last ${unseenPct.toFixed(0)}% of the history, which it never saw, it scored only ${fmtScore(sUnseen)}; it needs more than ${th.unseen_score_min}.`,
    };
    tests.A = testA;
    yield { stage: 'A', payload: testA };

    // B. Random timing
    const block = Math.max(1, Math.round((th.block_hours * 3600) / barSeconds));
    const blocks: number[][] = [];
    for (let s = 0; s < n; s += block) {
      blocks.push(Array.from({ length: Math.min(s + block, n) - s }, (_, i) => s + i));
    }
    const rng = mulberry32(seed);
    const copies = Math.floor(th.copies);
    copyScores = new Array(copies).fill(0);
    const chunk = 100;
    for (let c0 = 0; c0 < copies; c0 += chunk) {
      const rows = Math.min(chunk, copies - c0);
      const rowReturns: number[][] = [];
      for (let j = 0; j < rows; j++) {
        const shuffled = shuffle(blocks, rng);
        const idx = shuffled.flat();
        const arr = new Array(n);
        for (let k = 0; k < n; k++) arr[k] = pos[idx[k]] * ret[k];
        rowReturns.push(arr);
      }
      const scored = scoreRows(rowReturns, barsPerYear);
      for (let j = 0; j < rows; j++) copyScores[c0 + j] = scored[j];
    }
    const sReal = score(gross, barsPerYear);
    const beat = copyScores.filter((s) => s < sReal).length / copies;
    const bOk = beat >= th.beat_share_min;
    const sortedCopy = copyScores.slice().sort((a, b) => a - b);
    const testB: TestB = {
      name: TEST_INFO.B.name,
      question: TEST_INFO.B.question,
      passed: bOk,
      score_real: r(sReal),
      beat_share_pct: r(100 * beat, 1),
      threshold_pct: r(100 * th.beat_share_min, 1),
      copies,
      block_hours: r(th.block_hours, 0),
      copy_score_median: r(quantile(sortedCopy, 0.5)),
      copy_score_p95: r(quantile(sortedCopy, th.beat_share_min)),
      sentence: bOk
        ? `Its timing beat ${fmtPct(100 * beat)} of ${copies} random-timing copies; it needed ${fmtPct(100 * th.beat_share_min)}.`
        : `Its timing beat only ${fmtPct(100 * beat)} of ${copies} random-timing copies; it needs at least ${fmtPct(100 * th.beat_share_min)}.`,
    };
    tests.B = testB;
    yield { stage: 'B', payload: testB };

    // C. Stress
    const sStress = score(stressNet, barsPerYear);
    const feeOk = sStress > th.stress_score_min;
    const wk = weekendMask(time);
    const total = net.reduce((a, b) => a + b, 0);
    const wkResult = net.reduce((sum, v, i) => (wk[i] ? sum + v : sum), 0);
    const wkLoss = Math.max(0, -wkResult);
    const [wkOk, wkShare] = weekendCheck(total, wkResult, th.weekend_loss_max_share);
    const cOk = feeOk && wkOk;
    const mult = th.stress_fee_mult;
    const feePart = feeOk
      ? `With fees at ${mult}x it still scored ${fmtScore(sStress)}`
      : `With fees at ${mult}x its score fell to ${fmtScore(sStress)}, not above ${th.stress_score_min}`;
    let wkPart: string;
    if (wkLoss === 0) wkPart = 'weekend candles did not lose money';
    else if (total > 0) {
      wkPart = `weekend candles lost ${fmtPct(100 * wkLoss)}, ${wkOk ? 'under' : 'more than'} half of the ${fmtPct(100 * total)} total result`;
    } else {
      wkPart = `weekend candles lost ${fmtPct(100 * wkLoss)} with no overall profit to absorb it`;
    }
    const testC: TestC = {
      name: TEST_INFO.C.name,
      question: TEST_INFO.C.question,
      passed: cOk,
      fee_passed: feeOk,
      weekend_passed: wkOk,
      score_base: r(score(net, barsPerYear)),
      score_stress: r(sStress),
      fee_pct: r(100 * fee, 3),
      stress_fee_pct: r(100 * fee * mult, 3),
      stress_fee_mult: mult,
      total_result_pct: pct(total),
      weekend_result_pct: pct(wkResult),
      weekend_loss_share_pct: Number.isFinite(wkShare) ? r(100 * wkShare, 1) : null,
      weekend_loss_max_share_pct: r(100 * th.weekend_loss_max_share, 0),
      weekend_candles: wk.filter(Boolean).length,
      sentence: `${feePart}, and ${wkPart}.`,
    };
    tests.C = testC;
    yield { stage: 'C', payload: testC };
  }

  const passed = gateOk && Object.values(tests).every((t) => t?.passed);
  const reasons: string[] = [];
  if (!gateOk) reasons.push(gate.sentence);
  if (tests.A && !tests.A.passed) reasons.push(tests.A.sentence);
  if (tests.B && !tests.B.passed) reasons.push(tests.B.sentence);
  if (tests.C && !tests.C.passed) reasons.push(tests.C.sentence);

  let headline: string;
  if (passed) headline = 'Not obviously luck on this history.';
  else if (!gateOk) headline = 'Too few trades to judge.';
  else if (tests.A && !tests.A.passed) headline = 'It does not hold up on data it never saw.';
  else if (tests.B && !tests.B.passed) headline = 'Its timing is no better than chance.';
  else if (tests.C && !tests.C.fee_passed) headline = 'It does not survive higher fees.';
  else headline = 'Weekend prices eat too much of the result.';

  const buyHold = close[n - 1] / close[0] - 1;
  const equity = cumprod(net);
  const equityStress = cumprod(stressNet);

  const holding: [number, number][] = [];
  let start: number | null = null;
  for (let i = 0; i < pos.length; i++) {
    if (pos[i] > 0 && start === null) start = i === 0 ? time[i] : time[i - 1];
    else if (pos[i] === 0 && start !== null) {
      holding.push([start, time[i - 1]]);
      start = null;
    }
  }
  if (start !== null) holding.push([start, time[pos.length - 1]]);

  const ruling: Ruling & { series?: unknown } = {
    verdict: passed ? 'PASS' : 'FAIL',
    headline,
    reasons,
    rule,
    rule_text: describe_rule(rule),
    gate,
    tests,
    stats: {
      candles: n,
      start: time[0],
      end: time[n - 1],
      trades,
      time_in_market_pct: r(100 * (pos.reduce((a, b) => a + b, 0) / n), 1),
      total_return_pct: pct(equity[n - 1]),
      buy_hold_return_pct: pct(buyHold),
      score: r(score(net, barsPerYear)),
      split_index: split,
      split_time: time[split],
    },
    settings: {
      fee,
      thresholds: th,
      seed,
      court_version: COURT_VERSION,
    },
    series: {
      time,
      close,
      position: pos,
      net,
      equity,
      equity_stress: equityStress,
      copy_scores: copyScores,
      weekend: gateOk ? weekendMask(time) : null,
    },
  };
  yield { stage: 'verdict', payload: ruling };
}

export function runCourt(
  market: Market,
  rule: Rule,
  fee = DEFAULT_FEE,
  thresholds?: Record<string, number> | null,
  seed = SEED
): Ruling & { series?: unknown } {
  let ruling: (Ruling & { series?: unknown }) | null = null;
  for (const ev of iterCourt(market, rule, fee, thresholds, seed)) {
    if (ev.stage === 'verdict') ruling = ev.payload as Ruling & { series?: unknown };
  }
  return ruling!;
}

export function publicRuling(ruling: Ruling & { series?: unknown }): Ruling {
  const { series, ...rest } = ruling;
  return rest as Ruling;
}

export function thin(n: number, maxPoints = 720): number[] {
  const step = Math.max(1, Math.ceil(n / maxPoints));
  const idx: number[] = [];
  for (let i = 0; i < n; i += step) idx.push(i);
  if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
  return idx;
}

export function holdingSpans(timeS: number[], pos: number[]): [number, number][] {
  const spans: [number, number][] = [];
  let start: number | null = null;
  for (let i = 0; i < pos.length; i++) {
    if (pos[i] > 0 && start === null) start = i === 0 ? timeS[i] : timeS[i - 1];
    else if (pos[i] === 0 && start !== null) {
      spans.push([start, timeS[i - 1]]);
      start = null;
    }
  }
  if (start !== null) spans.push([start, timeS[pos.length - 1]]);
  return spans;
}

export function candlesPayload(df: DataFrame): Candles {
  const n = df.time.length;
  const hours = n <= 150 ? 1 : n <= 300 ? 2 : n <= 600 ? 4 : n <= 900 ? 6 : n <= 1800 ? 12 : 24;
  const bucketMs = hours * 3600 * 1000;
  const buckets: Record<number, { time: number[]; open: number[]; high: number[]; low: number[]; close: number[] }> = {};
  for (let i = 0; i < n; i++) {
    const b = Math.floor(df.time[i] / bucketMs);
    if (!buckets[b]) buckets[b] = { time: [], open: [], high: [], low: [], close: [] };
    buckets[b].time.push(df.time[i]);
    buckets[b].open.push(df.open[i]);
    buckets[b].high.push(df.high[i]);
    buckets[b].low.push(df.low[i]);
    buckets[b].close.push(df.close[i]);
  }
  const keys = Object.keys(buckets).map(Number).sort((a, b) => a - b);
  const out: Candles = { hours, time: [], open: [], high: [], low: [], close: [] };
  for (const k of keys) {
    const b = buckets[k];
    out.time.push(b.time[0]);
    out.open.push(b.open[0]);
    out.high.push(Math.max(...b.high));
    out.low.push(Math.min(...b.low));
    out.close.push(b.close[b.close.length - 1]);
  }
  return out;
}

export function tradeList(ruling: Ruling & { series?: unknown }): Trade[] {
  const s = ruling.series as Record<string, number[]>;
  const pos = s.position;
  const close = s.close;
  const net = s.net;
  const timeS = s.time.map((t) => Math.floor(t / 1000));
  const n = pos.length;
  const split = ruling.stats.split_index;
  const trades: Trade[] = [];
  let i = 0;
  while (i < n) {
    if (pos[i] > 0 && (i === 0 || pos[i - 1] === 0)) {
      let j = i;
      while (j + 1 < n && pos[j + 1] > 0) j++;
      const last = j + 1 < n ? j + 1 : j;
      const prod = net.slice(i, last + 1).reduce((a, b) => a * (1 + b), 1) - 1;
      const entry = i > 0 ? i - 1 : i;
      trades.push({
        n: trades.length + 1,
        entry_time: timeS[i],
        exit_time: timeS[j] + 3600,
        entry_price: Math.round(close[entry] * 10000) / 10000,
        exit_price: Math.round(close[j] * 10000) / 10000,
        hours: j - i + 1,
        return_pct: Math.round(100 * prod * 1000) / 1000,
        open: j === n - 1,
        part: i >= split ? 'unseen' : 'seen',
      });
      i = j + 1;
    } else {
      i++;
    }
  }
  return trades;
}

export function chartPayload(ruling: Ruling & { series?: unknown }, df?: DataFrame): ChartData {
  const s = ruling.series as Record<string, number[]>;
  const timeS = s.time.map((t) => Math.floor(t / 1000));
  const idx = thin(timeS.length);
  const payload: ChartData = {
    time: idx.map((i) => timeS[i]),
    close: idx.map((i) => Math.round(s.close[i] * 10000) / 10000),
    equity_pct: idx.map((i) => Math.round(s.equity[i] * 100 * 1000) / 1000),
    equity_stress_pct: idx.map((i) => Math.round(s.equity_stress[i] * 100 * 1000) / 1000),
    holding: holdingSpans(timeS, s.position),
    split_time: Math.floor(ruling.stats.split_time / 1000),
    copy_scores: s.copy_scores.map((v) => Math.round(v * 1000) / 1000),
    trades: tradeList(ruling),
  };
  if (df) payload.candles = candlesPayload(df);
  return payload;
}
