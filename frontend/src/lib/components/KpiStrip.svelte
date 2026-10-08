<script lang="ts">
	import type { CourtResult } from '#lib/court.svelte.js';
	import { int, pct, score, signedPct } from '#lib/format.js';

	let { result, class: className = '' }: { result: CourtResult | null; class?: string } = $props();

	interface Kpi {
		label: string;
		value: string;
		note: string;
		tone: 'pass' | 'fail' | 'plain';
	}

	const kpis = $derived.by((): Kpi[] => {
		if (!result) return [];
		const { tests, gate, stats } = result.ruling;
		const tone = (ok: boolean | undefined) => (ok === undefined ? 'plain' : ok ? 'pass' : 'fail');
		return [
			{
				label: 'Unseen score',
				value: tests.A ? score(tests.A.score_unseen) : '—',
				note: tests.A ? `needs > ${tests.A.threshold}` : 'not run',
				tone: tone(tests.A?.passed)
			},
			{
				label: 'Beat random',
				value: tests.B ? pct(tests.B.beat_share_pct) : '—',
				note: tests.B ? `of ${tests.B.copies} · needs ${pct(tests.B.threshold_pct)}` : 'not run',
				tone: tone(tests.B?.passed)
			},
			{
				label: 'Score at 3× fees',
				value: tests.C ? score(tests.C.score_stress) : '—',
				note: tests.C ? 'needs > 0' : 'not run',
				tone: tone(tests.C ? tests.C.fee_passed : undefined)
			},
			{ label: 'Trades', value: int(gate.trades), note: `needs ${gate.min_trades}+`, tone: tone(gate.passed) },
			{ label: 'Result after fees', value: signedPct(stats.total_return_pct), note: `score ${score(stats.score)}`, tone: 'plain' },
			{ label: 'Just holding', value: signedPct(stats.buy_hold_return_pct), note: 'buy at start, sell at end', tone: 'plain' }
		];
	});

	const TONE = { pass: 'text-success-foreground', fail: 'text-danger-foreground', plain: 'text-foreground' };
</script>

<section class="panel {className}" aria-label="Key numbers" aria-busy={!result}>
	<dl class="m-0 grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-6">
		{#if result}
			{#each kpis as k, i (k.label)}
				<div
					class="min-w-0 border-border px-4 py-3
						{i % 2 === 1 ? 'border-l' : ''} {i >= 2 ? 'border-t' : ''}
						sm:border-t-0 sm:border-l-0 {i % 3 !== 0 ? 'sm:border-l' : ''} {i >= 3 ? 'sm:border-t' : ''}
						2xl:border-t-0 {i !== 0 ? '2xl:border-l' : '2xl:border-l-0'}"
				>
					<dt class="eyebrow truncate">{k.label}</dt>
					<dd class="m-0 mt-1 flex items-baseline gap-2">
						<span class="num text-[22px] leading-none font-bold tracking-tight {TONE[k.tone]}">{k.value}</span>
					</dd>
					<p class="m-0 mt-1 truncate text-xs text-muted-foreground">{k.note}</p>
				</div>
			{/each}
		{:else}
			{#each Array.from({ length: 6 }, (_, i) => i) as i (i)}
				<div class="grid gap-2 px-4 py-3" aria-hidden="true">
					<div class="skeleton h-3 w-20"></div>
					<div class="skeleton h-6 w-16"></div>
					<div class="skeleton h-3 w-24"></div>
				</div>
			{/each}
		{/if}
	</dl>
</section>
