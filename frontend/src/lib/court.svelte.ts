// Page state for one visitor: the controls, the streamed run, and the last ruling.
import { goto } from '$app/navigation';
import { CourtApiError, getMarkets, isDataProblem, isIdeaProblem, judge, type ErrorKind, type JudgeBody } from './api';
import { decodeRule, encodeRule } from './rules';
import type { ChartData, CourtEvent, Explanation, JudgeRequest, MarketInfo, Markets, Reading, Rule, Ruling } from './types';

export type StepKey = 'read' | 'data' | 'gate' | 'A' | 'B' | 'C';
export type StepState = '' | 'active' | 'done' | 'failed' | 'skipped';

export const STEPS: { key: StepKey; label: string; short: string }[] = [
	{ key: 'read', label: 'Idea', short: 'Idea' },
	{ key: 'data', label: 'Prices', short: 'Prices' },
	{ key: 'gate', label: 'Trades', short: 'Trades' },
	{ key: 'A', label: 'Test A', short: 'A' },
	{ key: 'B', label: 'Test B', short: 'B' },
	{ key: 'C', label: 'Test C', short: 'C' }
];

export const EXAMPLE_IDEA = 'buy when the 10 hour average crosses above the 40 hour average';
const PRACTICE_FALLBACK = 'PRACTICE-TREND';

export interface RunArgs {
	idea?: string;
	rule?: Rule;
	end?: number;
	example?: boolean;
	fallbackNote?: string;
}

export interface CourtResult {
	ruling: Ruling;
	chart: ChartData;
	market: MarketInfo;
	request: JudgeRequest;
	idea: string;
	fallbackNote?: string;
}

export interface CourtFailure {
	message: string;
	kind: ErrorKind;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const blankSteps = (): Record<StepKey, StepState> => ({ read: '', data: '', gate: '', A: '', B: '', C: '' });

export class CourtSession {
	markets = $state.raw<Markets | null>(null);
	symbol = $state('');
	days = $state(90);
	feePct = $state(0.1);
	idea = $state('');

	running = $state(false);
	example = $state(false);
	steps = $state(blankSteps());
	reading = $state.raw<Reading | null>(null);
	result = $state.raw<CourtResult | null>(null);
	explanation = $state.raw<Explanation | null>(null);
	error = $state.raw<CourtFailure | null>(null);
	/** Read out by a polite live region when a ruling lands. */
	announcement = $state('');

	lastArgs: RunArgs = {};
	#runId = 0;
	#controller: AbortController | null = null;
	#gap = 170;

	async init() {
		this.#gap = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 170;
		try {
			this.markets = await getMarkets();
		} catch (e) {
			this.error = { message: (e as Error).message, kind: 'network' };
			return;
		}
		const m = this.markets;
		this.symbol = m.tokens[0]?.symbol ?? '';
		this.days = m.default_days;
		this.feePct = m.default_fee_pct;

		const q = new URLSearchParams(window.location.search);
		if (q.get('symbol') || q.get('rule') || q.get('idea')) {
			this.#applyQuery(q);
			const rule = decodeRule(q.get('rule')) ?? undefined;
			const end = q.get('end') ? Number(q.get('end')) : undefined;
			this.run({ idea: this.idea, rule, end });
		} else {
			this.idea = EXAMPLE_IDEA;
			this.run({ idea: EXAMPLE_IDEA, example: true });
		}
	}

	#applyQuery(q: URLSearchParams) {
		const m = this.markets!;
		const symbol = q.get('symbol');
		if (symbol && m.tokens.some((t) => t.symbol === symbol)) this.symbol = symbol;
		const days = Number(q.get('days'));
		if (m.windows_days.includes(days)) this.days = days;
		const fee = Number(q.get('fee'));
		if (m.fees_pct.some((f) => Math.abs(f - fee) < 1e-9)) this.feePct = fee;
		this.idea = q.get('idea') ?? '';
	}

	get isPractice() {
		return this.symbol.startsWith('PRACTICE');
	}

	async run(args: RunArgs) {
		const runId = ++this.#runId;
		this.#controller?.abort();
		const controller = (this.#controller = new AbortController());
		this.lastArgs = args;
		this.example = !!args.example;
		this.running = true;
		this.error = null;
		this.result = null;
		this.explanation = null;
		this.announcement = '';
		this.steps = blankSteps();
		this.steps.read = args.rule ? 'done' : 'active';
		if (args.rule) {
			this.steps.data = 'active';
			this.reading = { rule: args.rule, rule_text: '', source: 'user', notice: null };
		}

		const body: JudgeBody = { symbol: this.symbol, days: this.days, fee_pct: this.feePct, idea: args.idea ?? '' };
		if (args.rule) body.rule = args.rule;
		if (args.end) body.end = args.end;

		let ended = false;
		try {
			for await (const ev of judge(body, controller.signal)) {
				if (runId !== this.#runId) return;
				if (ev.stage === 'verdict' || ev.stage === 'error') ended = true;
				await this.#handle(ev, args, runId);
				if (ev.stage === 'error') return;
			}
			if (!ended) throw new CourtApiError('The ruling was cut off before it finished. Try again.', 'cut');
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return;
			if (runId !== this.#runId) return;
			const err = e instanceof CourtApiError ? e : new CourtApiError('Something went wrong. Try again.', 'server');
			this.#fail(runId, err.message, err.kind, args);
		} finally {
			if (runId === this.#runId) this.running = false;
		}
	}

	async #handle(ev: CourtEvent, args: RunArgs, runId: number) {
		const s = this.steps;
		switch (ev.stage) {
			case 'understood':
				this.reading = { rule: ev.rule, rule_text: ev.rule_text, source: ev.source, notice: ev.notice };
				s.read = 'done';
				s.data = 'active';
				break;
			case 'data':
				await sleep(this.#gap);
				s.data = 'done';
				s.gate = 'active';
				break;
			case 'gate':
				await sleep(this.#gap);
				s.gate = ev.gate.passed ? 'done' : 'failed';
				if (ev.gate.passed) s.A = 'active';
				else s.A = s.B = s.C = 'skipped';
				break;
			case 'A':
			case 'B':
			case 'C': {
				await sleep(this.#gap);
				s[ev.stage] = ev.test.passed ? 'done' : 'failed';
				const next = ({ A: 'B', B: 'C' } as const)[ev.stage as 'A' | 'B'];
				if (next) s[next] = 'active';
				break;
			}
			case 'verdict':
				await sleep(this.#gap);
				if (runId !== this.#runId) return;
				this.result = {
					ruling: ev.ruling,
					chart: ev.chart,
					market: ev.market,
					request: ev.request,
					idea: args.idea ?? '',
					fallbackNote: args.fallbackNote
				};
				if (ev.request.parsed_by === 'user') {
					this.reading = { rule: ev.ruling.rule, rule_text: ev.ruling.rule_text, source: 'user', notice: null };
				}
				this.running = false;
				this.announcement = `Verdict: ${ev.ruling.verdict}. ${ev.ruling.headline}`;
				this.#syncUrl();
				break;
			case 'explanation':
				this.explanation = ev.explanation;
				break;
			case 'error':
				this.#fail(runId, ev.message, isDataProblem(ev.message) ? 'data' : isIdeaProblem(ev.message) ? 'idea' : 'server', args);
				break;
		}
	}

	#fail(runId: number, message: string, kind: ErrorKind, args: RunArgs) {
		if (runId !== this.#runId) return;
		if (args.example && kind === 'data' && !this.isPractice) {
			// The first-load example should never be an error page: fall back to practice prices and say so.
			this.symbol = PRACTICE_FALLBACK;
			this.run({
				...args,
				fallbackNote: 'Bitget prices couldn’t be loaded on this server, so this example runs on a practice market.'
			});
			return;
		}
		this.running = false;
		for (const k of Object.keys(this.steps) as StepKey[]) {
			if (this.steps[k] === 'active') this.steps[k] = 'failed';
		}
		if (kind === 'idea') this.steps.read = 'failed';
		this.error = { message, kind };
		this.announcement = `The court can’t rule on this. ${message}`;
	}

	retry() {
		this.run({ ...this.lastArgs, example: false });
	}

	tryPractice() {
		this.symbol = PRACTICE_FALLBACK;
		this.run({ ...this.lastArgs, example: false });
	}

	/** Keep the address bar shareable: token, window, fee, rule and idea (not the end time). */
	#syncUrl() {
		const r = this.result;
		if (!r) return;
		const q = new URLSearchParams({
			symbol: r.request.symbol,
			days: String(r.request.days),
			fee: (100 * r.request.fee).toFixed(2),
			rule: encodeRule(r.request.rule)
		});
		if (r.idea) q.set('idea', r.idea);
		goto(`?${q}`, { shallow: true, replace: true }).catch(() => {});
	}

	/** A link that re-runs this exact ruling: it pins the last candle's time. */
	shareUrl(): string {
		const r = this.result!;
		const q = new URLSearchParams({
			symbol: r.request.symbol,
			days: String(r.request.days),
			fee: (100 * r.request.fee).toFixed(2),
			rule: encodeRule(r.request.rule),
			end: String(Math.floor(r.request.end / 1000))
		});
		if (r.idea) q.set('idea', r.idea);
		return `${window.location.origin}${window.location.pathname}?${q}`;
	}
}
