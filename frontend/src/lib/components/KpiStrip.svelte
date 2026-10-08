<script lang="ts">
	import type { CourtResult } from '#lib/court.svelte.js';
	import { int, pct, score, signedPct } from '#lib/format.js';
	import Icon from './Icon.svelte';
	import Card from './ui/Card.svelte';
	import Skeleton from './ui/Skeleton.svelte';
	import StatsCounter from './ui/StatsCounter.svelte';

	let { result, class: className = '' }: { result: CourtResult | null; class?: string } = $props();

	interface Kpi {
		label: string;
		value: number | null;
		format: (n: number) => string;
		note: string;
		tone: 'pass' | 'fail' | 'plain';
	}

	const kpis = $derived.by((): Kpi[] => {
		if (!result) return [];
		const { tests, gate, stats } = result.ruling;
		const tone = (ok: boolean | undefined) => (ok === undefined ? 'plain' : ok ? 'pass' : 'fail');
		const count = (n: number) => int(Math.round(n));
		return [
			{
				label: 'Unseen score',
				value: tests.A?.score_unseen ?? null,
				format: score,
				note: tests.A ? `needs > ${tests.A.threshold}` : 'not run',
				tone: tone(tests.A?.passed)
			},
			{
				label: 'Beat random',
				value: tests.B?.beat_share_pct ?? null,
				format: pct,
				note: tests.B ? `of ${tests.B.copies} · needs ${pct(tests.B.threshold_pct)}` : 'not run',
				tone: tone(tests.B?.passed)
			},
			{
				label: 'Score at 3× fees',
				value: tests.C?.score_stress ?? null,
				format: score,
				note: tests.C ? 'needs > 0' : 'not run',
				tone: tone(tests.C ? tests.C.fee_passed : undefined)
			},
			{ label: 'Trades', value: gate.trades, format: count, note: `needs ${gate.min_trades}+`, tone: tone(gate.passed) },
			{ label: 'Result after fees', value: stats.total_return_pct, format: signedPct, note: `score ${score(stats.score)}`, tone: 'plain' },
			{
				label: 'Just holding',
				value: stats.buy_hold_return_pct,
				format: signedPct,
				note: 'buy at start, sell at end',
				tone: 'plain'
			}
		];
	});

	const TONE = { pass: 'text-success-foreground', fail: 'text-danger-foreground', plain: 'text-foreground' };
</script>

<Card class={className} aria-label="Key numbers" aria-busy={!result}>
	<dl class="m-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
		{#if result}
			{#each kpis as k, i (k.label)}
				<div
					class="min-w-0 px-4 py-3
						{i % 2 === 1 ? 'border-l' : ''} {i >= 2 ? 'border-t' : ''}
						sm:border-t-0 sm:border-l-0 {i % 3 !== 0 ? 'sm:border-l' : ''} {i >= 3 ? 'sm:border-t' : ''}
						lg:border-l-0 lg:border-t-0 {i !== 0 ? 'lg:border-l' : ''}"
				>
					<dt class="truncate text-[13px] text-muted-foreground">{k.label}</dt>
					<dd class="m-0 mt-1 flex items-center gap-1.5 {TONE[k.tone]}">
						{#if k.value === null}
							<span class="text-[22px] leading-none font-semibold tracking-tight">—</span>
						{:else}
							<StatsCounter value={k.value} format={k.format} duration={1.1} class="text-[22px] leading-none font-semibold tracking-tight" />
						{/if}
						{#if k.tone !== 'plain'}
							<Icon name={k.tone === 'pass' ? 'check' : 'x'} class="size-4 shrink-0" label={k.tone === 'pass' ? 'passed' : 'failed'} />
						{/if}
					</dd>
					<p class="m-0 mt-1 truncate text-[11px] text-muted-foreground">{k.note}</p>
				</div>
			{/each}
		{:else}
			{#each Array.from({ length: 6 }, (_, i) => i) as i (i)}
				<div class="grid gap-2 px-4 py-3" aria-hidden="true">
					<Skeleton class="h-3.5 w-20" />
					<Skeleton class="h-6 w-16" />
					<Skeleton class="h-3 w-24" />
				</div>
			{/each}
		{/if}
	</dl>
</Card>
