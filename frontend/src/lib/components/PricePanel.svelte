<script lang="ts">
	import type { CourtResult } from '#lib/court.svelte.js';
	import { fmtDateTime, int, pct, score, signedPct } from '#lib/format.js';
	import LineChart from './charts/LineChart.svelte';

	let { result }: { result: CourtResult | null } = $props();

	function holdingAt(spans: [number, number][], t: number): boolean {
		let lo = 0;
		let hi = spans.length - 1;
		while (lo <= hi) {
			const mid = (lo + hi) >> 1;
			if (t < spans[mid][0]) hi = mid - 1;
			else if (t > spans[mid][1]) lo = mid + 1;
			else return true;
		}
		return false;
	}

	const stats = $derived.by(() => {
		if (!result) return [];
		const s = result.ruling.stats;
		return [
			['Trades', int(s.trades)],
			['Time holding', pct(s.time_in_market_pct)],
			['Result after fees', signedPct(s.total_return_pct)],
			['Just holding', signedPct(s.buy_hold_return_pct)],
			['Score', score(s.score)]
		];
	});
	const decimals = $derived.by(() => {
		const last = result?.chart.close.at(-1) ?? 100;
		return last >= 100 ? 2 : last >= 1 ? 3 : 5;
	});
</script>

<section class="card min-w-0 p-4" aria-labelledby="price-title">
	<div class="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
		<h2 id="price-title" class="m-0 text-[15px] font-semibold">Price and the rule’s trades</h2>
		<div class="flex flex-wrap gap-3.5 text-[12.5px] text-subtle" aria-hidden="true">
			<span class="inline-flex items-center gap-1.5"><i class="h-0.5 w-4 rounded bg-chart-1"></i>Price</span>
			<span class="inline-flex items-center gap-1.5"><i class="size-3 rounded-[3px] border border-chart-1 bg-chart-1-wash"></i>Holding</span>
			<span class="inline-flex items-center gap-1.5"><i class="h-3 w-px bg-subtle"></i>Never-seen part starts</span>
		</div>
	</div>
	{#if result}
		{@const chart = result.chart}
		<LineChart
			time={chart.time}
			values={chart.close}
			spans={chart.holding}
			split={chart.split_time}
			height={240}
			yFormat={(v) => (v >= 1000 ? int(Math.round(v)) : v.toFixed(v >= 100 ? 0 : 2))}
			tip={(i) => ({
				head: fmtDateTime(chart.time[i]),
				value: `${chart.close[i].toFixed(decimals)} USDT · ${holdingAt(chart.holding, chart.time[i]) ? 'holding' : 'in cash'}`
			})}
			label="{result.market.label} hourly prices, with the rule's holding periods shaded."
		/>
		<dl class="m-0 mt-3 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(120px,1fr))]">
			{#each stats as [k, v] (k)}
				<div class="rounded-[10px] bg-muted px-2.5 py-2">
					<dt class="text-xs text-muted-foreground">{k}</dt>
					<dd class="m-0 text-[17px] font-semibold tabular-nums">{v}</dd>
				</div>
			{/each}
		</dl>
	{:else}
		<div class="skeleton h-[240px]" aria-hidden="true"></div>
	{/if}
</section>
