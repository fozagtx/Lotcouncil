// Shapes of the court's API (see lotcouncil/server.py and lotcouncil/court.py).

export type RuleType = 'ma_cross' | 'breakout' | 'dip_buy';
export type Rule = { type: RuleType } & Record<string, number | string>;
export type TestKey = 'A' | 'B' | 'C';
export type Verdict = 'PASS' | 'FAIL';

export interface Token {
	symbol: string;
	label: string;
	name: string;
}

export interface Markets {
	tokens: Token[];
	windows_days: number[];
	default_days: number;
	fees_pct: number[];
	default_fee_pct: number;
	tests: Record<TestKey, { name: string; question: string }>;
	ai_enabled: boolean;
	ai_model: string | null;
}

export interface MarketInfo {
	symbol: string;
	label: string;
	name: string;
	source: 'bitget' | 'saved';
	source_note: string;
	granularity: string;
	days_requested: number;
	days_available: number;
	short_history: boolean;
	candles: number;
	start: number;
	end: number;
	hash: string;
}

export interface Gate {
	passed: boolean;
	trades: number;
	min_trades: number;
	sentence: string;
}

interface TestBase {
	name: string;
	question: string;
	passed: boolean;
	sentence: string;
}

export interface TestA extends TestBase {
	score_unseen: number;
	score_seen: number;
	threshold: number;
	trades_unseen: number;
	return_unseen_pct: number;
	unseen_share_pct: number;
}

export interface TestB extends TestBase {
	score_real: number;
	beat_share_pct: number;
	threshold_pct: number;
	copies: number;
	block_hours: number;
	copy_score_median: number;
	copy_score_p95: number;
}

export interface TestC extends TestBase {
	fee_passed: boolean;
	weekend_passed: boolean;
	score_base: number;
	score_stress: number;
	fee_pct: number;
	stress_fee_pct: number;
	stress_fee_mult: number;
	total_result_pct: number;
	weekend_result_pct: number;
	weekend_loss_share_pct: number | null;
	weekend_loss_max_share_pct: number;
	weekend_candles: number;
}

export interface Ruling {
	verdict: Verdict;
	headline: string;
	reasons: string[];
	rule: Rule;
	rule_text: string;
	gate: Gate;
	tests: { A?: TestA; B?: TestB; C?: TestC };
	stats: {
		candles: number;
		start: number;
		end: number;
		trades: number;
		time_in_market_pct: number;
		total_return_pct: number;
		buy_hold_return_pct: number;
		score: number;
		split_index: number;
		split_time: number;
	};
	settings: { fee: number; seed: number; court_version: string; thresholds: Record<string, number> };
}

export interface Trade {
	n: number;
	entry_time: number;
	exit_time: number;
	entry_price: number;
	exit_price: number;
	hours: number;
	return_pct: number;
	open: boolean;
	part: 'seen' | 'unseen';
}

export interface Candles {
	hours: number;
	time: number[];
	open: number[];
	high: number[];
	low: number[];
	close: number[];
}

export interface ChartData {
	time: number[];
	close: number[];
	equity_pct: number[];
	equity_stress_pct: number[];
	holding: [number, number][];
	split_time: number;
	copy_scores: number[];
	trades: Trade[];
	candles?: Candles;
}

export interface JudgeRequest {
	symbol: string;
	days: number;
	end: number;
	rule: Rule;
	fee: number;
	idea: string;
	parsed_by: string;
}

export interface Explanation {
	text: string;
	source: 'ai' | 'template';
	notice: string | null;
}

export interface Reading {
	rule: Rule;
	rule_text: string;
	source: 'ai' | 'keywords' | 'user';
	notice: string | null;
}

export type CourtEvent =
	| ({ stage: 'understood' } & Reading)
	| { stage: 'data'; market: MarketInfo }
	| { stage: 'gate'; gate: Gate }
	| { stage: TestKey; test: TestBase }
	| { stage: 'verdict'; ruling: Ruling; chart: ChartData; market: MarketInfo; request: JudgeRequest }
	| { stage: 'explanation'; explanation: Explanation }
	| { stage: 'error'; message: string };

export interface RerunResult {
	same: boolean;
	hash_ok: boolean;
	data_hash: string;
	verdict_in_file: Verdict | null;
	verdict_now: Verdict;
	differences: string[];
}
