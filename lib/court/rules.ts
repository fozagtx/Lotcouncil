import type { BreakoutRule, DipBuyRule, MaCrossRule, Rule, RuleType } from './types';

export class RuleError extends Error {}

const RULE_TYPES: RuleType[] = ['ma_cross', 'breakout', 'dip_buy'];

type ParamSpec = { kind: 'int' | 'float'; min: number; max: number; default: number | null };

const PARAMS: Record<RuleType, Record<string, ParamSpec>> = {
  ma_cross: {
    fast: { kind: 'int', min: 1, max: 2000, default: null },
    slow: { kind: 'int', min: 3, max: 4000, default: null },
  },
  breakout: {
    lookback: { kind: 'int', min: 3, max: 4000, default: null },
    exit_lookback: { kind: 'int', min: 2, max: 4000, default: -1 },
  },
  dip_buy: {
    lookback: { kind: 'int', min: 3, max: 4000, default: 24 },
    drop_pct: { kind: 'float', min: 0.1, max: 50.0, default: null },
    max_hold: { kind: 'int', min: 1, max: 4000, default: 48 },
  },
};

const TYPE_LABELS: Record<RuleType, string> = {
  ma_cross: 'Average cross',
  breakout: 'Breakout',
  dip_buy: 'Dip buy',
};

function hours(n: number): string {
  if (n % 24 === 0 && n >= 48) return `${n / 24}-day`;
  return `${n}-hour`;
}

function niceName(name: string): string {
  return name.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function validate_rule(raw: unknown): Rule {
  if (!raw || typeof raw !== 'object') {
    throw new RuleError('A rule must be an object with a type and its numbers.');
  }
  const r = raw as Record<string, unknown>;
  const rtype = r.type as RuleType;
  if (!RULE_TYPES.includes(rtype)) {
    throw new RuleError('The court only knows three kinds of idea: an average cross, a breakout, or a dip buy.');
  }
  const spec = PARAMS[rtype];
  const extra = Object.keys(r).filter((k) => k !== 'type' && !spec[k]);
  if (extra.length) {
    throw new RuleError(`Unknown setting for a ${TYPE_LABELS[rtype].toLowerCase()}: ${extra.sort().join(', ')}.`);
  }

  const out: Record<string, number> = {};
  for (const [name, { kind, min, max, default: def }] of Object.entries(spec)) {
    let value = r[name];
    if (value === undefined || value === null) {
      if (def === null) {
        throw new RuleError(`A ${TYPE_LABELS[rtype].toLowerCase()} needs a value for ${name.replace('_', ' ')}.`);
      }
      value = def;
    }
    if (typeof value === 'boolean') {
      throw new RuleError(`${niceName(name)} must be a number.`);
    }
    let num = Number(value);
    if (!Number.isFinite(num)) {
      throw new RuleError(`${niceName(name)} must be a number.`);
    }
    if (kind === 'int') {
      if (Math.abs(num - Math.round(num)) > 1e-9) {
        throw new RuleError(`${niceName(name)} must be a whole number of hours.`);
      }
      num = Math.round(num);
    } else {
      num = Math.round(num * 10000) / 10000;
    }
    if (name === 'exit_lookback' && num === -1) {
      num = Math.max(2, Math.floor(out.lookback / 2));
    }
    if (!(min <= num && num <= max)) {
      throw new RuleError(`${niceName(name)} must be between ${min} and ${max}, not ${num}.`);
    }
    out[name] = num;
  }

  const base = { type: rtype } as Record<string, number | string>;
  if (rtype === 'ma_cross') {
    const rule = { ...base, fast: out.fast, slow: out.slow } as MaCrossRule;
    if (rule.fast >= rule.slow) throw new RuleError('The fast average must be shorter than the slow average.');
    return rule;
  }
  if (rtype === 'breakout') {
    return { ...base, lookback: out.lookback, exit_lookback: out.exit_lookback } as BreakoutRule;
  }
  return { ...base, lookback: out.lookback, drop_pct: out.drop_pct, max_hold: out.max_hold } as DipBuyRule;
}

export function describe_rule(rule: Rule): string {
  if (rule.type === 'ma_cross') {
    const fast = rule.fast === 1 ? 'price' : `${hours(rule.fast)} average price`;
    return `Hold the token while its ${fast} is above its ${hours(rule.slow)} average; otherwise stay in cash.`;
  }
  if (rule.type === 'breakout') {
    return `Buy when the price closes above its highest close of the previous ${hours(rule.lookback)} window; sell when it closes below the lowest close of the previous ${hours(rule.exit_lookback)} window.`;
  }
  if (rule.type === 'dip_buy') {
    return `Buy when the price falls ${rule.drop_pct}% below its ${hours(rule.lookback)} average; sell when it gets back to that average or after ${rule.max_hold} hours, whichever comes first.`;
  }
  throw new RuleError('Unknown rule type.');
}

export function warmup(rule: Rule): number {
  if (rule.type === 'ma_cross') return rule.slow;
  if (rule.type === 'breakout') return Math.max(rule.lookback, rule.exit_lookback) + 1;
  return rule.lookback;
}

function sma(x: number[], n: number): number[] {
  const out = new Array(x.length).fill(NaN);
  if (n <= x.length) {
    let sum = 0;
    for (let i = 0; i < x.length; i++) {
      sum += x[i];
      if (i >= n) sum -= x[i - n];
      if (i >= n - 1) out[i] = sum / n;
    }
  }
  return out;
}

function prevExtreme(x: number[], n: number, fn: (...args: number[]) => number): number[] {
  const out = new Array(x.length).fill(NaN);
  if (n < x.length) {
    for (let i = n; i < x.length; i++) {
      const slice = x.slice(i - n, i);
      out[i] = fn(...slice);
    }
  }
  return out;
}

export function signals(rule: Rule, close: number[]): number[] {
  const n = close.length;
  const sig = new Array(n).fill(0);

  if (rule.type === 'ma_cross') {
    const fast = sma(close, rule.fast);
    const slow = sma(close, rule.slow);
    for (let i = 0; i < n; i++) {
      if (!Number.isNaN(slow[i])) {
        sig[i] = fast[i] > slow[i] ? 1 : 0;
      }
    }
    return sig;
  }

  if (rule.type === 'breakout') {
    const hi = prevExtreme(close, rule.lookback, Math.max);
    const lo = prevExtreme(close, rule.exit_lookback, Math.min);
    let holding = 0;
    for (let i = 0; i < n; i++) {
      if (Number.isNaN(hi[i]) || Number.isNaN(lo[i])) continue;
      if (!holding && close[i] > hi[i]) holding = 1;
      else if (holding && close[i] < lo[i]) holding = 0;
      sig[i] = holding;
    }
    return sig;
  }

  if (rule.type === 'dip_buy') {
    const avg = sma(close, rule.lookback);
    const trigger = 1.0 - rule.drop_pct / 100.0;
    let holding = 0;
    let held = 0;
    for (let i = 0; i < n; i++) {
      if (Number.isNaN(avg[i])) continue;
      if (!holding) {
        if (close[i] <= avg[i] * trigger) {
          holding = 1;
          held = 0;
        }
      } else {
        held += 1;
        if (close[i] >= avg[i] || held >= rule.max_hold) {
          holding = 0;
        }
      }
      sig[i] = holding;
    }
    return sig;
  }

  throw new RuleError('Unknown rule type.');
}

export function positions(rule: Rule, close: number[]): number[] {
  const sig = signals(rule, close);
  const pos = new Array(sig.length).fill(0);
  for (let i = 1; i < sig.length; i++) {
    pos[i] = sig[i - 1];
  }
  return pos;
}
