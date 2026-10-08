// Rulings made in this browser, newest first. Kept in localStorage as a convenience only.
import type { Rule, Verdict } from './types';

export interface PastRuling {
	id: string;
	symbol: string;
	label: string;
	days: number;
	feePct: number;
	rule: Rule;
	idea: string;
	end: number;
	verdict: Verdict;
	headline: string;
	at: number;
}

const KEY = 'lc-history';
const MAX = 12;

export class RulingHistory {
	items: PastRuling[] = [];

	load() {
		try {
			const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
			if (Array.isArray(raw)) this.items = raw.slice(0, MAX);
		} catch {
			this.items = [];
		}
	}

	add(entry: PastRuling) {
		this.items = [entry, ...this.items.filter((p) => p.id !== entry.id)].slice(0, MAX);
		this.#save();
	}

	clear() {
		this.items = [];
		this.#save();
	}

	#save() {
		try {
			localStorage.setItem(KEY, JSON.stringify(this.items));
		} catch {
			/* storage unavailable: the list lasts for this page only */
		}
	}
}
