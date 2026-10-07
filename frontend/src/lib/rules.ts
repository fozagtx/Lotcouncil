import type { Rule, RuleType } from './types';

export interface RuleField {
	key: string;
	label: string;
	unit: 'h' | '%';
	initial: number;
}

/** The numbers each rule type takes, in the order the editor shows them. */
export const RULE_FIELDS: Record<RuleType, RuleField[]> = {
	ma_cross: [
		{ key: 'fast', label: 'Fast average', unit: 'h', initial: 10 },
		{ key: 'slow', label: 'Slow average', unit: 'h', initial: 40 }
	],
	breakout: [
		{ key: 'lookback', label: 'Buy above high of', unit: 'h', initial: 48 },
		{ key: 'exit_lookback', label: 'Sell below low of', unit: 'h', initial: 24 }
	],
	dip_buy: [
		{ key: 'drop_pct', label: 'Drop', unit: '%', initial: 1.5 },
		{ key: 'lookback', label: 'Below average of', unit: 'h', initial: 24 },
		{ key: 'max_hold', label: 'Hold at most', unit: 'h', initial: 48 }
	]
};

export const RULE_LABELS: Record<RuleType, string> = {
	ma_cross: 'Average cross',
	breakout: 'Breakout',
	dip_buy: 'Dip buy'
};

/** Check the editor's numbers before sending them, so mistakes show next to the field. */
export function ruleErrors(type: RuleType, values: Record<string, string>): Record<string, string> {
	const errors: Record<string, string> = {};
	for (const f of RULE_FIELDS[type]) {
		const raw = (values[f.key] ?? '').trim();
		const n = Number(raw);
		if (raw === '' || !Number.isFinite(n)) {
			errors[f.key] = 'Enter a number.';
		} else if (f.unit === 'h' && (!Number.isInteger(n) || n < 1)) {
			errors[f.key] = 'Use whole hours, 1 or more.';
		} else if (f.unit === '%' && (n < 0.1 || n > 50)) {
			errors[f.key] = 'Use 0.1 to 50.';
		}
	}
	if (type === 'ma_cross' && !errors.fast && !errors.slow && Number(values.fast) >= Number(values.slow)) {
		errors.fast = 'Must be shorter than the slow average.';
	}
	return errors;
}

export function toRule(type: RuleType, values: Record<string, string>): Rule {
	const rule: Rule = { type };
	for (const f of RULE_FIELDS[type]) rule[f.key] = Number(values[f.key]);
	return rule;
}

export function encodeRule(rule: Rule): string {
	return [rule.type, ...RULE_FIELDS[rule.type].map((f) => rule[f.key])].join(',');
}

export function decodeRule(text: string | null): Rule | null {
	if (!text) return null;
	const [type, ...nums] = text.split(',');
	if (!(type in RULE_FIELDS)) return null;
	const rule: Rule = { type: type as RuleType };
	RULE_FIELDS[type as RuleType].forEach((f, i) => {
		if (nums[i] !== undefined && nums[i] !== '') rule[f.key] = Number(nums[i]);
	});
	return rule;
}
