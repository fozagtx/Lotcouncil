<script lang="ts">
	import type { CourtSession } from '#lib/court.svelte.js';
	import { fmtDate, signedPct } from '#lib/format.js';
	import CandleChart from './charts/CandleChart.svelte';
	import LineChart from './charts/LineChart.svelte';
	import Card from './ui/Card.svelte';
	import CardContent from './ui/CardContent.svelte';
	import CardDescription from './ui/CardDescription.svelte';
	import CardHeader from './ui/CardHeader.svelte';
	import CardTitle from './ui/CardTitle.svelte';
	import Skeleton from './ui/Skeleton.svelte';
	import ToggleTabs from './ui/ToggleTabs.svelte';

	let { session, class: className = '' }: { session: CourtSession; class?: string } = $props();

	let view: string | number = $state('candles');
	const result = $derived(session.result);
	const chart = $derived(result?.chart);
	const pair = $derived(!result ? '' : result.market.source === 'practice' ? result.market.label : `${result.market.label}/USDT`);
	const windows = $derived(
		(session.markets?.windows_days ?? []).map((d) => ({ value: d, label: `${d}D`, description: `Re-run on the last ${d} days` }))
	);
	const candleLabel = $derived.by(() => {
		const h = chart?.candles?.hours ?? 1;
		return h === 24 ? '1D candles' : `${h}H candles`;
	});
	const sourceLabel = $derived(
		!result ? '' : result.market.source === 'practice' ? 'Practice prices (made up)' : result.market.source === 'saved' ? 'Saved Bitget spot' : 'Bitget spot'
	);
</script>

<Card class={className} aria-labelledby="chart-title" aria-busy={!result}>
	<CardHeader>
		<CardTitle id="chart-title" class="text-lg">{result ? pair : 'Chart'}</CardTitle>
		<CardDescription>
			{#if result}{sourceLabel} · {view === 'candles' ? candleLabel : 'result after fees'}{:else}Prices load with the first ruling.{/if}
		</CardDescription>
		{#snippet action()}
			<ToggleTabs
				label="Chart view"
				options={[
					{ value: 'candles', label: 'Candles', description: 'Show price candles' },
					{ value: 'result', label: 'Result', description: 'Show the rule’s result after fees' }
				]}
				bind:value={view}
			/>
			<ToggleTabs
				label="Time window"
				options={windows}
				value={session.days}
				disabled={session.running}
				onchange={(d) => session.changeWindow(Number(d))}
			/>
		{/snippet}
	</CardHeader>

	<CardContent class="px-3 sm:px-5">
		{#if result && chart}
			<div class="mb-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground" aria-hidden="true">
				{#if view === 'candles'}
					<span class="inline-flex items-center gap-1.5"><i class="h-3 w-2 rounded-[2px] bg-[var(--candle-up)]"></i>Up</span>
					<span class="inline-flex items-center gap-1.5"><i class="h-3 w-2 rounded-[2px] bg-[var(--candle-down)]"></i>Down</span>
				{:else}
					<span class="inline-flex items-center gap-1.5"><i class="h-0.5 w-4 rounded bg-chart-1"></i>Result after fees</span>
				{/if}
				<span class="inline-flex items-center gap-1.5"><i class="size-3 rounded-[3px] bg-[var(--holding-wash)] ring-1 ring-brand/40"></i>Rule holding</span>
				<span class="inline-flex items-center gap-1.5"><i class="size-3 rounded-[3px] bg-muted ring-1 ring-border-strong"></i>Never-seen 40%</span>
			</div>
			{#if view === 'candles' && chart.candles}
				<CandleChart
					candles={chart.candles}
					spans={chart.holding}
					split={chart.split_time}
					label="{pair} price candles, with the rule's holding periods shaded and the never-seen last 40% marked."
				/>
			{:else}
				<LineChart
					time={chart.time}
					values={chart.equity_pct}
					spans={chart.holding}
					split={chart.split_time}
					splitLabels={['Seen', 'Never seen']}
					zero
					height={320}
					yFormat={(v) => Math.round(v) + '%'}
					tip={(i) => ({ head: fmtDate(chart.time[i]), value: `Result after fees ${signedPct(chart.equity_pct[i])}` })}
					label="The rule's result after fees over time, with the never-seen last 40% shaded."
				/>
			{/if}
		{:else}
			<Skeleton class="h-[320px] rounded-lg" />
		{/if}
	</CardContent>
</Card>
