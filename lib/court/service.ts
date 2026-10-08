import { createHash } from 'crypto';

import { chartPayload, CourtError, DEFAULT_FEE, FEE_CHOICES, iterCourt, publicRuling, runCourt, TEST_INFO } from './court';
import { CandleStore, DEFAULT_DAYS, TOKEN_NAMES, tokenLabel, tokenList, WINDOWS_DAYS } from './data';
import type { AuditBody, ChartData, DataFrame, Explanation, JudgeBody, MarketInfo, Markets, Reading, Ruling, Rule } from './types';
import { describe_rule, validate_rule } from './rules';
import { keywordParse } from './parse';

export { CourtError };

export function snapFee(fee: number): number {
  for (const choice of FEE_CHOICES) {
    if (Math.abs(fee - choice) < 1e-9) return choice;
  }
  throw new CourtError('Pick a fee of 0.05%, 0.10% or 0.20% per position change.');
}

export function markets(): Markets {
  const tokens = tokenList().map((s) => ({ symbol: s, label: tokenLabel(s), name: TOKEN_NAMES[s] || '' }));
  return {
    tokens,
    windows_days: WINDOWS_DAYS,
    default_days: DEFAULT_DAYS,
    fees_pct: FEE_CHOICES.map((f) => Math.round(100 * f * 1000) / 1000),
    default_fee_pct: Math.round(100 * DEFAULT_FEE * 1000) / 1000,
    tests: TEST_INFO,
  };
}

function thin(n: number, maxPoints = 720): number[] {
  const step = Math.max(1, Math.ceil(n / maxPoints));
  const idx: number[] = [];
  for (let i = 0; i < n; i += step) idx.push(i);
  if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
  return idx;
}

export async function prices(store: CandleStore, symbol: string, days: number): Promise<{ market: MarketInfo; time: number[]; close: number[] }> {
  const [df, info] = await store.window(symbol, days);
  const idx = thin(df.time.length);
  return { market: info, time: idx.map((i) => Math.floor(df.time[i] / 1000)), close: idx.map((i) => Math.round(df.close[i] * 10000) / 10000) };
}

export function understand(idea: string): Reading {
  const rule = keywordParse(idea);
  return { rule, rule_text: describe_rule(rule), source: 'keywords', notice: null };
}

export async function* judgeEvents(
  storeArg: CandleStore,
  body: JudgeBody
): AsyncGenerator<{ stage: string; payload: unknown }> {
  const started = performance.now();
  try {
    const fee = snapFee(body.fee_pct / 100);
    let parsedBy = 'user';
    let notice: string | null = null;
    let rule: Rule;
    const idea = body.idea || '';
    if (!body.rule) {
      const reading = understand(idea);
      rule = reading.rule;
      parsedBy = reading.source;
      notice = reading.notice;
      yield { stage: 'understood', payload: { rule, rule_text: reading.rule_text, source: parsedBy, notice } };
    } else {
      rule = validate_rule(body.rule);
    }
    const [df, market] = await storeArg.window(body.symbol, body.days, body.end);
    yield { stage: 'data', payload: market };

    let ruling: (Ruling & { series?: unknown }) | null = null;
    for (const ev of iterCourt({ time: df.time, close: df.close }, rule, fee)) {
      if (ev.stage === 'verdict') {
        ruling = ev.payload as Ruling & { series?: unknown };
      } else if (ev.stage === 'gate') {
        yield { stage: 'gate', payload: ev.payload };
      } else {
        yield { stage: ev.stage, payload: ev.payload };
      }
    }

    if (!ruling) throw new CourtError('The court did not produce a ruling.');
    const chart = chartPayload(ruling, df);
    const publicR = publicRuling(ruling);
    publicR.rule_text = describe_rule(ruling.rule);
    yield {
      stage: 'verdict',
      payload: {
        elapsed_ms: Math.round(performance.now() - started),
        ruling: publicR,
        chart,
        market,
        request: {
          symbol: body.symbol,
          days: body.days,
          end: market.end,
          rule,
          fee,
          idea,
          parsed_by: parsedBy,
        },
      },
    };
    const explanation = explain(idea || describe_rule(rule), ruling, market);
    yield { stage: 'explanation', payload: { explanation } };
  } catch (e) {
    yield { stage: 'error', payload: { message: (e as Error).message } };
  }
}

function explain(idea: string, ruling: Ruling, market: MarketInfo): Explanation {
  const verdict = ruling.verdict;
  const total = ruling.stats.total_return_pct;
  const bh = ruling.stats.buy_hold_return_pct;
  const text =
    `${verdict === 'PASS' ? 'The rule passed' : 'The rule failed'} on ${market.label} over ${market.days_available} days. ` +
    `It made ${ruling.stats.trades} trades and returned ${total.toFixed(1)}% before fees, ` +
    `while buying and holding returned ${bh.toFixed(1)}%. ` +
    `${ruling.headline} ${ruling.reasons.join(' ')}`;
  return { text, source: 'template', notice: null };
}

export async function judge(storeArg: CandleStore, body: JudgeBody): Promise<{ ok: boolean; error?: string; ruling?: Ruling; market?: MarketInfo; request?: unknown; explanation?: Explanation }> {
  let result: { ok: boolean; error?: string; ruling?: Ruling; market?: MarketInfo; request?: unknown; explanation?: Explanation } = { ok: false };
  for await (const ev of judgeEvents(storeArg, body)) {
    if (ev.stage === 'error') {
      return { ok: false, error: (ev.payload as { message: string }).message };
    }
    if (ev.stage === 'verdict') {
      const p = ev.payload as { ruling: Ruling; chart: ChartData; market: MarketInfo; request: unknown };
      result = { ok: true, ruling: p.ruling, market: p.market, request: p.request };
    }
    if (ev.stage === 'explanation') {
      result.explanation = (ev.payload as { explanation: Explanation }).explanation;
    }
  }
  return result;
}

export const store = new CandleStore();

export async function audit(storeArg: CandleStore, body: AuditBody): Promise<Record<string, unknown>> {
  const fee = snapFee(body.fee_pct / 100);
  const rule = validate_rule(body.rule);
  const [df, market] = await storeArg.window(body.symbol, body.days, body.end);
  const ruling = runCourt({ time: df.time, close: df.close }, rule, fee);
  const chart = chartPayload(ruling, df);
  const file = buildAudit(body.idea, body.parsed_by, market, df, ruling, body.explanation);
  return file;
}

function buildAudit(
  idea: string,
  parsedBy: string,
  market: MarketInfo,
  candles: DataFrame,
  ruling: Ruling,
  explanation?: Explanation | null
): Record<string, unknown> {
  return {
    version: '1.0.0',
    idea,
    parsed_by: parsedBy,
    market,
    candles: {
      columns: ['time', 'open', 'high', 'low', 'close'],
      rows: candles.time.map((t, i) => [t, candles.open[i], candles.high[i], candles.low[i], candles.close[i]]),
    },
    result: publicRuling(ruling),
    explanation: explanation || null,
    hash: dataHash(candles),
  };
}

function dataHash(df: DataFrame): string {
  const h = createHash('sha256');
  for (let i = 0; i < df.time.length; i++) {
    h.update(`${df.time[i]},${df.open[i]},${df.high[i]},${df.low[i]},${df.close[i]}\n`);
  }
  return 'sha256:' + h.digest('hex');
}
