import { RuleError, validate_rule } from './rules';
import type { Rule } from './types';

export class ParseError extends RuleError {}

const UNSUPPORTED_HINT =
  'The court can read three kinds of idea: an average cross ' +
  '("buy when the 10 hour average crosses above the 40 hour average"), a breakout ' +
  '("buy when the price breaks above its 48 hour high"), or a dip buy ' +
  '("buy when the price drops 2% below its 24 hour average").';

const WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80,
  ninety: 90, hundred: 100, 'a hundred': 100, 'two hundred': 200,
};

const UNITS: Record<string, number> = {
  h: 1, hr: 1, hrs: 1, hour: 1, hours: 1, hourly: 1,
  bar: 1, bars: 1, candle: 1, candles: 1, period: 1, periods: 1,
  d: 24, day: 24, days: 24, daily: 24,
  w: 168, wk: 168, wks: 168, week: 168, weeks: 168, weekly: 168,
};

const NUM = String.raw`\d+(?:\.\d+)?`;
const LEN_RE = new RegExp(`(${NUM})\\s*-?\\s*(hours?|hrs?|hourly|h|bars?|candles?|periods?|days?|daily|d|weeks?|weekly|wks?|w)\\b`, 'gi');
const PCT_RE = new RegExp(`(${NUM})\\s*(?:%|percent\\b|pct\\b|per cent\\b)`, 'gi');
const HOLD_RE = new RegExp(
  `(?:after|for|within|hold(?:ing)?(?: it)?(?: for)?|max(?:imum)?(?: of)?)\\s+(?:up to\\s+)?` +
  `(${NUM})\\s*-?\\s*(hours?|hrs?|h|days?|d|bars?|candles?)\\b`,
  'gi'
);
const MINUTES_RE = new RegExp(`${NUM}\\s*-?\\s*(?:m|min|mins|minutes?)\\b`, 'gi');

const UNSUPPORTED: [RegExp, string][] = [
  [/\brsi\b|relative strength/i, 'RSI rules'],
  [/\bmacd\b/i, 'MACD rules'],
  [/bollinger/i, 'Bollinger band rules'],
  [/\bvolume\b/i, 'volume rules, because Bitget\'s volume data for these tokens is incomplete'],
  [/\bshort(?:ing|s)?\b(?!er|est)|sell short/i, 'short selling (rules here only buy or hold cash)'],
  [/\bnews\b|tweet|earnings|sentiment/i, 'news or sentiment rules'],
];

function normalise(text: string): string {
  let t = ' ' + text.toLowerCase().replace(/[‑–—]/g, '-') + ' ';
  t = t.replace(/(?<=\d),(?=\d{3}\b)/g, '');
  const sorted = Object.entries(WORDS).sort((a, b) => b[0].length - a[0].length);
  for (const [word, num] of sorted) {
    t = t.replace(new RegExp(`\\b${word}\\b`, 'g'), String(num));
  }
  return t;
}

interface LengthMatch { hours: number; start: number; end: number }

function lengths(t: string): LengthMatch[] {
  const out: LengthMatch[] = [];
  for (const m of t.matchAll(LEN_RE)) {
    const hours = Number(m[1]) * UNITS[m[2].toLowerCase()];
    if (Number.isInteger(hours) && hours >= 1 && m.index !== undefined) {
      out.push({ hours: hours as number, start: m.index, end: m.index + m[0].length });
    }
  }
  return out;
}

function bareNumbers(t: string): number[] {
  const covered: [number, number][] = [];
  for (const m of t.matchAll(LEN_RE)) if (m.index !== undefined) covered.push([m.index, m.index + m[0].length]);
  for (const m of t.matchAll(PCT_RE)) if (m.index !== undefined) covered.push([m.index, m.index + m[0].length]);

  const nums: number[] = [];
  const re = new RegExp(`(?<![\\w.])${NUM}(?![\\w.%])`, 'g');
  for (const m of t.matchAll(re)) {
    if (m.index !== undefined && covered.some(([a, b]) => a <= m.index && m.index < b)) continue;
    const val = Number(m[0]);
    if (Number.isInteger(val) && val >= 1) nums.push(val);
  }
  return nums;
}

function orderedLengths(t: string): number[] {
  const items: { start: number; value: number; mult: number | null }[] = [];
  for (const m of t.matchAll(LEN_RE)) {
    if (m.index === undefined) continue;
    items.push({ start: m.index, value: Number(m[1]), mult: UNITS[m[2].toLowerCase()] });
  }
  const covered: [number, number][] = [];
  for (const m of t.matchAll(LEN_RE)) if (m.index !== undefined) covered.push([m.index, m.index + m[0].length]);
  for (const m of t.matchAll(PCT_RE)) if (m.index !== undefined) covered.push([m.index, m.index + m[0].length]);

  const re = new RegExp(`(?<![\\w.])${NUM}(?![\\w.%])`, 'g');
  for (const m of t.matchAll(re)) {
    if (m.index !== undefined && !covered.some(([a, b]) => a <= m.index && m.index < b)) {
      items.push({ start: m.index, value: Number(m[0]), mult: null });
    }
  }
  items.sort((a, b) => a.start - b.start);

  const out: number[] = [];
  let unit = 1;
  for (const { value, mult } of items) {
    if (mult !== null) unit = mult;
    const hours = value * unit;
    if (Number.isInteger(hours) && hours >= 1) out.push(hours);
  }
  return out;
}

function near(lengths: LengthMatch[], t: string, wordRe: string): number | null {
  const re = new RegExp(wordRe, 'gi');
  for (const m of t.matchAll(re)) {
    if (m.index === undefined) continue;
    const before = lengths.filter((h) => h.end <= m.index && m.index - h.end <= 25);
    if (before.length) return before[before.length - 1].hours;
    const after = lengths.filter((h) => h.start >= m.index + m[0].length && h.start - (m.index + m[0].length) <= 25);
    if (after.length) return after[0].hours;
  }
  return null;
}

export function keywordParse(idea: string): Rule {
  if (!idea || !idea.trim()) {
    throw new ParseError('Type an idea first. ' + UNSUPPORTED_HINT);
  }
  const t = normalise(idea);

  for (const [pattern, what] of UNSUPPORTED) {
    if (pattern.test(t)) {
      throw new ParseError(`The court can't judge ${what} yet. ` + UNSUPPORTED_HINT);
    }
  }
  if (MINUTES_RE.test(t) && !LEN_RE.test(t)) {
    throw new ParseError('Rules run on hourly candles, so give lengths in hours, days or weeks. ' + UNSUPPORTED_HINT);
  }

  const lens = lengths(t);
  const pcts: number[] = [];
  for (const m of t.matchAll(PCT_RE)) pcts.push(Number(m[1]));

  const isDip = /\b(dips?|drops?|dropped|falls?|fell|falling|pull ?backs?|sell-?offs?|oversold|declines?|down)\b/.test(t);
  const isBreakout = /break ?outs?|breaks? (?:above|out|through|over)|new (?:\S+ ){0,3}highs?|highest|donchian|\bhighs?\b/.test(t);
  const isCross = /\bcross(?:es|ed|ing|over)?\b|averages?|\bmas?\b|\bsma\b|\bema\b|golden/.test(t);

  try {
    if (isDip && pcts.length) {
      const rule: Record<string, unknown> = { type: 'dip_buy', drop_pct: pcts[0] };
      let avgLen = near(lens, t, 'averages?|\\bmean\\b|\\bma\\b|\\bsma\\b');
      let hold: number | null = null;
      const hm = HOLD_RE.exec(t);
      if (hm) hold = Number(hm[1]) * UNITS[hm[2].toLowerCase()];
      if (avgLen === null) {
        const others = lens.filter((h) => h.hours !== hold).map((h) => h.hours);
        avgLen = others[0] ?? null;
      }
      if (avgLen !== null) rule.lookback = avgLen;
      if (hold !== null) rule.max_hold = hold;
      return validate_rule(rule);
    }

    if (isBreakout && !(isCross && !/\bhighs?\b|highest|break/.test(t))) {
      let look = near(lens, t, '\\bhighs?\\b|highest') ?? (lens[0]?.hours ?? null);
      if (look === null) {
        const bare = bareNumbers(t);
        look = bare[0] ?? null;
      }
      if (look === null) {
        throw new ParseError('A breakout needs a length, like "its 48 hour high". ' + UNSUPPORTED_HINT);
      }
      const rule: Record<string, unknown> = { type: 'breakout', lookback: look };
      const exitLen = near(lens, t, '\\blows?\\b|lowest');
      if (exitLen !== null && exitLen !== look) rule.exit_lookback = exitLen;
      return validate_rule(rule);
    }

    if (isCross) {
      const nums = orderedLengths(t);
      if (nums.length >= 2) {
        const [fast, slow] = nums.slice(0, 2).sort((a, b) => a - b);
        if (fast === slow) throw new ParseError('The two averages need different lengths.');
        return validate_rule({ type: 'ma_cross', fast, slow } as unknown);
      }
      if (nums.length === 1 && /\bprice\b|closes?\b/.test(t)) {
        return validate_rule({ type: 'ma_cross', fast: 1, slow: nums[0] } as unknown);
      }
      throw new ParseError('An average cross needs two lengths, like "the 10 hour average crosses above the 40 hour average".');
    }

    if (isDip) {
      throw new ParseError('A dip buy needs a size, like "drops 2% below its 24 hour average".');
    }
  } catch (e) {
    if (e instanceof ParseError) throw e;
    if (e instanceof RuleError) throw new ParseError(e.message);
    throw e;
  }

  throw new ParseError("I couldn't find a rule in that. " + UNSUPPORTED_HINT);
}
