import { createHash } from 'crypto';

import type { DataFrame, MarketInfo } from './types';

export class DataError extends Error {}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const COLUMNS = ['time', 'open', 'high', 'low', 'close'];
const BITGET_BASE = (process.env.BITGET_BASE_URL || 'https://api.bitget.com').replace(/\/$/, '');
const CANDLES_PATH = '/api/v2/spot/market/candles';
const HISTORY_PATH = '/api/v2/spot/market/history-candles';
const GRANULARITIES = ['1h', '1H'];
const MAX_DAYS = 180;
const CACHE_SECONDS = 600;

export const TOKEN_NAMES: Record<string, string> = {
  rAAPLUSDT: 'Apple',
  rTSLAUSDT: 'Tesla',
  rNVDAUSDT: 'Nvidia',
  rMSFTUSDT: 'Microsoft',
  rGOOGLUSDT: 'Alphabet',
  rAMZNUSDT: 'Amazon',
  rMETAUSDT: 'Meta',
  rCOINUSDT: 'Coinbase',
  rMSTRUSDT: 'Strategy',
  rHOODUSDT: 'Robinhood',
};

const DEFAULT_TOKENS = [
  'rAAPLUSDT', 'rTSLAUSDT', 'rNVDAUSDT', 'rMSFTUSDT',
  'rGOOGLUSDT', 'rAMZNUSDT', 'rMETAUSDT', 'rCOINUSDT',
];

export const WINDOWS_DAYS = [30, 60, 90, 180];
export const DEFAULT_DAYS = 90;

export function tokenList(): string[] {
  const raw = process.env.COURT_TOKENS || '';
  const tokens = raw.split(',').map((t) => t.trim()).filter(Boolean);
  return tokens.length ? tokens : DEFAULT_TOKENS;
}

export function tokenLabel(symbol: string): string {
  return symbol.endsWith('USDT') ? symbol.slice(0, -4) : symbol;
}

function nowMs(): number {
  return Date.now();
}

function parseNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function cleanCandles(rows: DataFrame, nowMsArg?: number, barMs = HOUR_MS): DataFrame {
  if (!rows || !rows.time || !rows.time.length) {
    throw new DataError('No candles came back for this token.');
  }
  const n = rows.time.length;
  const out: DataFrame = { time: [], open: [], high: [], low: [], close: [] };
  for (let i = 0; i < n; i++) {
    const t = parseNumber(rows.time[i]);
    const c = parseNumber(rows.close[i]);
    if (Number.isNaN(t) || Number.isNaN(c) || c <= 0) continue;
    let o = rows.open ? parseNumber(rows.open[i]) : NaN;
    let h = rows.high ? parseNumber(rows.high[i]) : NaN;
    let l = rows.low ? parseNumber(rows.low[i]) : NaN;
    if (Number.isNaN(o) || o <= 0) o = c;
    if (Number.isNaN(h) || h <= 0) h = c;
    if (Number.isNaN(l) || l <= 0) l = c;
    out.time.push(Math.floor(t));
    out.open.push(o);
    out.high.push(h);
    out.low.push(l);
    out.close.push(c);
  }
  if (!out.time.length) throw new DataError('The price data has no usable prices.');

  // dedupe by time, keep last
  const seen = new Map<number, { o: number; h: number; l: number; c: number }>();
  for (let i = 0; i < out.time.length; i++) {
    seen.set(out.time[i], { o: out.open[i], h: out.high[i], l: out.low[i], c: out.close[i] });
  }
  const sorted = Array.from(seen.entries()).sort((a, b) => a[0] - b[0]);
  out.time = sorted.map(([t]) => t);
  out.open = sorted.map(([, v]) => v.o);
  out.high = sorted.map(([, v]) => v.h);
  out.low = sorted.map(([, v]) => v.l);
  out.close = sorted.map(([, v]) => v.c);

  const now = nowMsArg ?? nowMs();
  let keep = out.time.length;
  while (keep > 0 && out.time[keep - 1] + barMs > now) keep--;
  out.time = out.time.slice(0, keep);
  out.open = out.open.slice(0, keep);
  out.high = out.high.slice(0, keep);
  out.low = out.low.slice(0, keep);
  out.close = out.close.slice(0, keep);

  if (!out.time.length) throw new DataError('No finished candles are available yet for this token.');
  return out;
}

export function dataHash(df: DataFrame): string {
  const h = createHash('sha256');
  for (let i = 0; i < df.time.length; i++) {
    h.update(`${df.time[i]},${df.open[i]},${df.high[i]},${df.low[i]},${df.close[i]}\n`);
  }
  return 'sha256:' + h.digest('hex');
}

function parseBitgetRows(rows: unknown[]): DataFrame {
  if (!Array.isArray(rows)) throw new DataError('Bitget sent candles in an unexpected format.');
  const out: DataFrame = { time: [], open: [], high: [], low: [], close: [] };
  for (const r of rows) {
    if (Array.isArray(r) && r.length >= 5) {
      out.time.push(r[0]);
      out.open.push(r[1]);
      out.high.push(r[2]);
      out.low.push(r[3]);
      out.close.push(r[4]);
    }
  }
  return out;
}

async function getJson(path: string, params: Record<string, string>, timeout = 10_000): Promise<unknown[]> {
  const url = new URL(BITGET_BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) {
      throw new DataError(`Bitget answered with HTTP ${res.status}`);
    }
    const body = await res.json();
    if (!body || typeof body !== 'object') throw new DataError('Bitget sent data in an unexpected format.');
    const b = body as Record<string, unknown>;
    if (String(b.code) !== '00000') {
      throw new DataError(`Bitget refused the request: ${b.msg || 'unknown'}`);
    }
    return (b.data as unknown[]) || [];
  } finally {
    clearTimeout(t);
  }
}

export async function fetchBitget(symbol: string, days = MAX_DAYS): Promise<DataFrame> {
  const now = nowMs();
  const wantFrom = now - days * DAY_MS;

  let lastErr: Error | null = null;
  const frames: DataFrame[] = [];
  let gran: string | null = null;
  for (const g of GRANULARITIES) {
    try {
      const rows = await getJson(CANDLES_PATH, { symbol, granularity: g, limit: '1000' });
      frames.push(parseBitgetRows(rows));
      gran = g;
      break;
    } catch (e) {
      lastErr = e as Error;
    }
  }
  if (gran === null) throw lastErr || new DataError('Bitget returned no candles.');

  for (let page = 0; page < 40; page++) {
    const known = concatFrames(frames);
    if (!known.time.length) break;
    const earliest = Math.min(...known.time);
    if (earliest <= wantFrom) break;
    const rows = await getJson(HISTORY_PATH, { symbol, granularity: gran, endTime: String(earliest), limit: '200' });
    const older = parseBitgetRows(rows);
    if (!older.time.length || Math.min(...older.time) >= earliest) break;
    frames.push(older);
  }

  const all = concatFrames(frames);
  const cleaned = cleanCandles(all, now);
  const fromIdx = cleaned.time.findIndex((t) => t >= wantFrom);
  const start = fromIdx <= 0 ? 0 : fromIdx;
  return {
    time: cleaned.time.slice(start),
    open: cleaned.open.slice(start),
    high: cleaned.high.slice(start),
    low: cleaned.low.slice(start),
    close: cleaned.close.slice(start),
  };
}

function concatFrames(frames: DataFrame[]): DataFrame {
  const out: DataFrame = { time: [], open: [], high: [], low: [], close: [] };
  for (const f of frames) {
    out.time.push(...f.time);
    out.open.push(...f.open);
    out.high.push(...f.high);
    out.low.push(...f.low);
    out.close.push(...f.close);
  }
  return out;
}

interface Entry {
  df: DataFrame;
  loadedAt: number;
}

export class CandleStore {
  cacheSeconds = CACHE_SECONDS;
  fetcher: (symbol: string, days: number) => Promise<DataFrame> = fetchBitget;
  retrySeconds = 60;
  private cache = new Map<string, Entry>();
  private failures = new Map<string, [number, string]>();

  private async load(symbol: string): Promise<Entry> {
    const df = await this.fetcher(symbol, MAX_DAYS);
    return { df, loadedAt: Date.now() / 1000 };
  }

  async getAll(symbol: string): Promise<Entry> {
    const entry = this.cache.get(symbol);
    const fresh = entry && Date.now() / 1000 - entry.loadedAt < this.cacheSeconds;
    if (fresh) return entry;

    const failed = this.failures.get(symbol);
    if (failed && Date.now() / 1000 - failed[0] < this.retrySeconds) {
      throw new DataError(failed[1]);
    }
    try {
      const loaded = await this.load(symbol);
      this.cache.set(symbol, loaded);
      this.failures.delete(symbol);
      return loaded;
    } catch (e) {
      if (e instanceof DataError) {
        this.failures.set(symbol, [Date.now() / 1000, e.message]);
      }
      throw e;
    }
  }

  async window(symbol: string, days: number, endMs?: number | null): Promise<[DataFrame, MarketInfo]> {
    if (!tokenList().includes(symbol)) {
      throw new DataError(`${symbol} is not one of the tokens this court can judge.`);
    }
    if (!(1 <= days && days <= MAX_DAYS)) {
      throw new DataError(`The time window must be between 1 and ${MAX_DAYS} days.`);
    }
    const entry = await this.getAll(symbol);
    let df = entry.df;
    if (endMs !== undefined && endMs !== null) {
      const idx = df.time.findIndex((t) => t > endMs);
      const end = idx === -1 ? df.time.length : idx;
      df = {
        time: df.time.slice(0, end),
        open: df.open.slice(0, end),
        high: df.high.slice(0, end),
        low: df.low.slice(0, end),
        close: df.close.slice(0, end),
      };
      if (!df.time.length) throw new DataError('No candles exist before the requested end time.');
    }
    const last = df.time[df.time.length - 1];
    const startIdx = df.time.findIndex((t) => t > last - days * DAY_MS);
    const start = startIdx === -1 ? 0 : startIdx - 1 >= 0 ? startIdx - 1 : 0;
    df = {
      time: df.time.slice(start),
      open: df.open.slice(start),
      high: df.high.slice(start),
      low: df.low.slice(start),
      close: df.close.slice(start),
    };
    const spanDays = (df.time[df.time.length - 1] - df.time[0] + HOUR_MS) / DAY_MS;
    const info: MarketInfo = {
      symbol,
      label: tokenLabel(symbol),
      name: TOKEN_NAMES[symbol] || '',
      source: 'bitget',
      source_note: 'Live hourly candles from Bitget.',
      granularity: '1h',
      days_requested: days,
      days_available: Math.round(spanDays * 10) / 10,
      short_history: spanDays < days - 1,
      candles: df.time.length,
      start: df.time[0],
      end: df.time[df.time.length - 1],
      hash: dataHash(df),
    };
    return [df, info];
  }
}
