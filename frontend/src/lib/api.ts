import type { CourtEvent, Markets, RerunResult, Rule } from './types';

export type ErrorKind = 'idea' | 'data' | 'network' | 'rate' | 'server' | 'cut';

export class CourtApiError extends Error {
	constructor(
		message: string,
		public kind: ErrorKind
	) {
		super(message);
	}
}

async function errorFrom(res: Response): Promise<CourtApiError> {
	let message = 'Something went wrong on the court’s server. Try again in a moment.';
	try {
		message = (await res.json()).error || message;
	} catch {
		/* keep the default */
	}
	const kind: ErrorKind = res.status === 429 ? 'rate' : res.status >= 500 ? 'server' : 'idea';
	return new CourtApiError(message, kind);
}

async function call(path: string, init?: RequestInit): Promise<Response> {
	try {
		const res = await fetch(path, init);
		if (!res.ok) throw await errorFrom(res);
		return res;
	} catch (e) {
		if (e instanceof CourtApiError) throw e;
		if (e instanceof DOMException && e.name === 'AbortError') throw e;
		const offline = typeof navigator !== 'undefined' && !navigator.onLine;
		throw new CourtApiError(
			offline
				? 'You’re offline. Reconnect, then try again.'
				: 'The court’s server can’t be reached. Check your connection and try again.',
			'network'
		);
	}
}

export async function getMarkets(): Promise<Markets> {
	return (await call('/api/markets')).json();
}

export interface JudgeBody {
	symbol: string;
	days: number;
	fee_pct: number;
	idea: string;
	rule?: Rule;
	end?: number;
}

/** Stream the court's progress events, one per line of NDJSON. */
export async function* judge(body: JudgeBody, signal: AbortSignal): AsyncGenerator<CourtEvent> {
	const res = await call('/api/judge', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
		signal
	});
	if (!res.body) throw new CourtApiError('The ruling didn’t arrive. Try again.', 'cut');
	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	try {
		for (;;) {
			const { value, done } = await reader.read();
			buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
			let nl: number;
			while ((nl = buffer.indexOf('\n')) >= 0) {
				const line = buffer.slice(0, nl).trim();
				buffer = buffer.slice(nl + 1);
				if (line) yield JSON.parse(line) as CourtEvent;
			}
			if (done) return;
		}
	} catch (e) {
		if (e instanceof DOMException && e.name === 'AbortError') throw e;
		throw new CourtApiError('The connection dropped before the ruling arrived. Try again.', 'cut');
	} finally {
		reader.releaseLock();
	}
}

export interface AuditBody {
	symbol: string;
	days: number;
	end: number;
	rule: Rule;
	fee_pct: number;
	idea: string;
	parsed_by: string;
	explanation: unknown;
}

export async function getAudit(body: AuditBody): Promise<Blob> {
	const res = await call('/api/audit', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	return res.blob();
}

export async function rerunAudit(fileText: string): Promise<RerunResult> {
	const res = await call('/api/rerun', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: fileText
	});
	return res.json();
}

/** Errors that mean "the prices could not be loaded". */
export function isDataProblem(message: string): boolean {
	return /prices|Bitget|candles/i.test(message);
}

export function isIdeaProblem(message: string): boolean {
	return /idea|rule|average|breakout|dip|couldn.t find|can.t judge|lengths|needs a/i.test(message);
}
