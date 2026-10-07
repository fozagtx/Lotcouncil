<script lang="ts">
	import type { CourtResult } from '#lib/court.svelte.js';
	import { fmtDate, feeLabel, pct, score, signedPct } from '#lib/format.js';
	import type { Markets, TestKey } from '#lib/types.js';
	import BarPair from './charts/BarPair.svelte';
	import Histogram from './charts/Histogram.svelte';
	import LineChart from './charts/LineChart.svelte';
	import Mark from './Mark.svelte';

	let { result, markets }: { result: CourtResult | null; markets: Markets | null } = $props();

	const KEYS: TestKey[] = ['A', 'B', 'C'];
	const tests = $derived(result?.ruling.tests);

	const weekend = $derived.by(() => {
		const c = tests?.C;
		if (!c) return null;
		if (c.weekend_result_pct >= 0) return { text: `Weekend candles: ${signedPct(c.weekend_result_pct)}, no loss`, share: 0 };
		if (c.weekend_loss_share_pct === null)
			return { text: `Weekend candles lost ${pct(-c.weekend_result_pct)}, with no overall profit`, share: 100 };
		return {
			text: `Weekend loss: ${pct(c.weekend_loss_share_pct)} of the result (limit ${c.weekend_loss_max_share_pct}%)`,
			share: c.weekend_loss_share_pct
		};
	});
</script>

<div class="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
	{#each KEYS as key (key)}
		{@const t = tests?.[key]}
		{@const info = markets?.tests[key]}
		<article class="card flex min-w-0 flex-col gap-2 p-3.5" aria-labelledby="test-{key}-name">
			<div class="flex items-center gap-2">
				<span class="text-xs font-bold tracking-wider text-muted-foreground">{key}</span>
				<h3 id="test-{key}-name" class="m-0 flex-1 text-[15px] font-semibold">{info?.name ?? ''}</h3>
				{#if result}
					{@const st = !t ? 'skip' : t.passed ? 'pass' : 'fail'}
					<span
						class="inline-flex items-center gap-1 rounded-full py-0.5 pr-2 pl-1 text-xs font-bold tracking-wide uppercase
							{st === 'pass' ? 'bg-success-muted text-success-foreground' : st === 'fail' ? 'bg-danger-muted text-danger-foreground' : 'bg-muted text-subtle'}"
					>
						<Mark state={st} size="sm" />{!t ? 'Not run' : t.passed ? 'Pass' : 'Fail'}
					</span>
				{/if}
			</div>
			<p class="m-0 text-[13.5px] text-subtle">{info?.question ?? ''}</p>

			{#if !result}
				<div class="grid gap-2" aria-hidden="true">
					<div class="skeleton h-[140px]"></div>
					<div class="skeleton h-8 w-1/2"></div>
					<div class="skeleton h-3.5 w-full"></div>
					<div class="skeleton h-3.5 w-4/5"></div>
				</div>
			{:else if !t}
				<p class="m-0 text-[13.5px] text-subtle">Not run. {result.ruling.gate.sentence}</p>
			{:else}
				{#if key === 'A' && tests?.A}
					{@const a = tests.A}
					{@const chart = result.chart}
					<LineChart
						time={chart.time}
						values={chart.equity_pct}
						split={chart.split_time}
						splitLabels={['Seen', 'Never seen']}
						zero
						height={140}
						yFormat={(v) => Math.round(v) + '%'}
						tip={(i) => ({ head: fmtDate(chart.time[i]), value: `Result after fees ${signedPct(chart.equity_pct[i])}` })}
						label="Result after fees over time; the never-seen last 40% is shaded."
					/>
					<div class="flex flex-wrap items-baseline gap-2">
						<span class="text-[28px] leading-tight font-semibold tabular-nums">{score(a.score_unseen)}</span>
						<span class="text-[13px] text-subtle">score on never-seen data · needs above {a.threshold}</span>
					</div>
				{:else if key === 'B' && tests?.B}
					{@const b = tests.B}
					<Histogram
						values={result.chart.copy_scores}
						marker={b.score_real}
						threshold={b.copy_score_p95}
						markerLabel="This idea {score(b.score_real)}"
						label="Scores of {b.copies} random-timing copies, with this idea's score marked."
					/>
					<div class="flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] text-subtle" aria-hidden="true">
						<span class="inline-flex items-center gap-1.5"><i class="size-3 rounded-[3px] bg-[var(--chart-copies)]"></i>Copies’ scores</span>
						<span class="inline-flex items-center gap-1.5"><i class="size-2.5 rounded-full bg-chart-1"></i>This idea</span>
						<span class="inline-flex items-center gap-1.5"><i class="h-3 w-px bg-subtle"></i>Beats 95%</span>
					</div>
					<div class="flex flex-wrap items-baseline gap-2">
						<span class="text-[28px] leading-tight font-semibold tabular-nums">{pct(b.beat_share_pct)}</span>
						<span class="text-[13px] text-subtle">of {b.copies} random copies beaten · needs {pct(b.threshold_pct)}</span>
					</div>
				{:else if key === 'C' && tests?.C}
					{@const c = tests.C}
					<BarPair
						rows={[
							{ label: `Fee ${feeLabel(c.fee_pct)}`, value: c.score_base, valueLabel: score(c.score_base), strong: true },
							{ label: `Fee ${feeLabel(c.stress_fee_pct)}`, value: c.score_stress, valueLabel: score(c.score_stress), strong: false }
						]}
						label="Score at the normal fee and at {c.stress_fee_mult} times the fee."
					/>
					<div class="flex flex-wrap items-baseline gap-2">
						<span class="text-[28px] leading-tight font-semibold tabular-nums">{score(c.score_stress)}</span>
						<span class="text-[13px] text-subtle">score at {c.stress_fee_mult}x fees · needs above 0</span>
					</div>
					{#if weekend}
						<div class="grid gap-1.5 text-[12.5px] text-subtle">
							<span>{weekend.text}</span>
							<div class="relative" role="img" aria-label={weekend.text}>
								<div class="h-2.5 overflow-hidden rounded-full bg-muted">
									<div
										class="h-full rounded-full {c.weekend_passed ? 'bg-chart-1' : 'bg-danger'}"
										style="width: {Math.min(100, weekend.share)}%"
									></div>
								</div>
								<span class="absolute -top-[3px] -bottom-[3px] w-0.5 bg-subtle" style="left: {c.weekend_loss_max_share_pct}%"></span>
							</div>
						</div>
					{/if}
				{/if}
				<p class="m-0 text-[13.5px] text-subtle">{t.sentence}</p>
			{/if}
		</article>
	{/each}
</div>
