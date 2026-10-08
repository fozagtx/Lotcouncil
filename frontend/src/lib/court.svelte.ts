// Page state for one visitor: the controls, the streamed run, and the last ruling.
import { goto } from '$app/navigation';
import { CourtApiError, getMarkets, isDataProblem, isIdeaProblem, judge, type ErrorKind, type JudgeBody } from './api';
import { RulingHistory } from './history.svelte.js';
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

export interface RunArgs {
	idea?: string;
	rule?: Rule;
	end?: number;
	example?: boolean;
}

export interface CourtResult {
	ruling: Ruling;
	chart: ChartData;
	market: MarketInfo;
	request: JudgeRequest;
	idea: string;
}

export interface CourtFailure {
	message: string;
	kind: ErrorKind;
}

const blankSteps = (): Record<StepKey, StepState> => ({ read: '', data: '', gate: '', A: '', B: '', C: '' });

export class CourtSession {
	markets = $state.raw<Markets | null>(null);
	symbol = $state('');
	days = $state(90);
	feePct = $state(0.1);
	idea = $state('');

	running = $state(false);
	/** False until the first real run; the page idles empty instead of demo-ing a verdict. */
	started = $state(false);
	example = $state(false);
	steps = $state(blankSteps());
	reading = $state.raw<Reading | null>(null);
	result = $state.raw<CourtResult | null>(null);
	explanation = $state.raw<Explanation | null>(null);
	error = $state.raw<CourtFailure | null>(null);
	/** Read out by a polite live region when a ruling lands. */
	announcement = $state('');
	/** Time the server spent on the last ruling (reading the idea, loading prices, running the court). */
	elapsedMs = $state<number | null>(null);
	history = new RulingHistory();

	lastArgs: RunArgs = {};
	#runId = 0;
	#controller: AbortController | null = null;

	async init() {
		this.history.load();
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


	async run(args: RunArgs) {
		const runId = ++this.#runId;
		this.started = true;
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
		this.elapsedMs = null;
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
				this.#handle(ev, args, runId);
				if (ev.stage === 'error') return;
			}
			if (!ended) throw new CourtApiError('The ruling was cut off before it finished. Try again.', 'cut');
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return;
			if (runId !== this.#runId) return;
			const err = e instanceof CourtApiError ? e : new CourtApiError('Something went wrong. Try again.', 'server');
			this.#fail(runId, err.message, err.kind);
		} finally {
			if (runId === this.#runId) this.running = false;
		}
	}

	// Steps update as the server streams them; there is no artificial delay.
	#handle(ev: CourtEvent, args: RunArgs, runId: number) {
		const s = this.steps;
		switch (ev.stage) {
			case 'understood':
				this.reading = { rule: ev.rule, rule_text: ev.rule_text, source: ev.source, notice: ev.notice };
				s.read = 'done';
				s.data = 'active';
				break;
			case 'data':
				s.data = 'done';
				s.gate = 'active';
				break;
			case 'gate':
				s.gate = ev.gate.passed ? 'done' : 'failed';
				if (ev.gate.passed) s.A = 'active';
				else s.A = s.B = s.C = 'skipped';
				break;
			case 'A':
			case 'B':
			case 'C': {
				s[ev.stage] = ev.test.passed ? 'done' : 'failed';
				const next = ({ A: 'B', B: 'C' } as const)[ev.stage as 'A' | 'B'];
				if (next) s[next] = 'active';
				break;
			}
			case 'verdict':
				if (runId !== this.#runId) return;
				this.elapsedMs = ev.elapsed_ms;
				this.result = {
					ruling: ev.ruling,
					chart: ev.chart,
					market: ev.market,
					request: ev.request,
					idea: args.idea ?? ''
				};
				if (ev.request.parsed_by === 'user') {
					this.reading = { rule: ev.ruling.rule, rule_text: ev.ruling.rule_text, source: 'user', notice: null };
				}
				this.running = false;
				this.announcement = `Verdict: ${ev.ruling.verdict}. ${ev.ruling.headline}`;
				this.#syncUrl();
				this.history.add({
					id: [ev.request.symbol, ev.request.days, ev.request.fee, encodeRule(ev.request.rule), ev.request.end].join('|'),
					symbol: ev.request.symbol,
					label: ev.market.label,
					days: ev.request.days,
					feePct: 100 * ev.request.fee,
					rule: ev.request.rule,
					idea: args.idea ?? '',
					end: Math.floor(ev.request.end / 1000),
					verdict: ev.ruling.verdict,
					headline: ev.ruling.headline,
					at: Date.now()
				});
				break;
			case 'explanation':
				this.explanation = ev.explanation;
				break;
			case 'error':
				this.#fail(runId, ev.message, isDataProblem(ev.message) ? 'data' : isIdeaProblem(ev.message) ? 'idea' : 'server');
				break;
		}
	}

	#fail(runId: number, message: string, kind: ErrorKind) {
		if (runId !== this.#runId) return;
		this.running = false;
		for (const k of Object.keys(this.steps) as StepKey[]) {
			if (this.steps[k] === 'active') this.steps[k] = 'failed';
		}
		if (kind === 'idea') this.steps.read = 'failed';
		this.error = { message, kind };
		this.announcement = `The court can’t rule on this. ${message}`;
	}

	/** Re-run the current rule on another time window (the chart's window switch). */
	changeWindow(days: number) {
		this.days = days;
		const r = this.result;
		if (r) this.run({ rule: r.request.rule, idea: r.idea });
		else this.retry();
	}

	/** Re-open a past ruling exactly: same token, window, fee, rule and last candle. */
	reopen(p: { symbol: string; days: number; feePct: number; rule: Rule; idea: string; end: number }) {
		if (this.markets?.tokens.some((t) => t.symbol === p.symbol)) this.symbol = p.symbol;
		this.days = p.days;
		this.feePct = p.feePct;
		this.idea = p.idea;
		this.run({ rule: p.rule, idea: p.idea, end: p.end });
	}

	retry() {
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
