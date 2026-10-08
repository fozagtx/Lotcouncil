<script lang="ts">
	import { fmtDateTime } from '#lib/format.js';
	import type { Trade } from '#lib/types.js';
	import Badge from './Badge.svelte';

	let { trades, decimals }: { trades: Trade[]; decimals: number } = $props();

	const sign = (x: number) => (x > 0 ? '+' : x < 0 ? '−' : '');
	const wins = $derived(trades.filter((t) => !t.open && t.return_pct > 0).length);
	const closed = $derived(trades.filter((t) => !t.open).length);
	const avgHours = $derived(trades.length ? Math.round(trades.reduce((a, t) => a + t.hours, 0) / trades.length) : 0);
	const best = $derived(trades.length ? Math.max(...trades.map((t) => t.return_pct)) : 0);
	const worst = $derived(trades.length ? Math.min(...trades.map((t) => t.return_pct)) : 0);
</script>

{#if trades.length === 0}
	<div class="grid place-items-center gap-1 px-4 py-12 text-center">
		<p class="m-0 font-semibold">No trades</p>
		<p class="m-0 max-w-sm text-sm text-muted-foreground">
			The rule never bought in this window. Try a longer window or shorter lengths in the Rule tab.
		</p>
	</div>
{:else}
	<dl class="m-0 grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-4">
		{#each [['Win rate', closed ? `${Math.round((100 * wins) / closed)}%` : '—', `${wins} of ${closed} closed`], ['Avg. hold', `${avgHours} h`, `${trades.length} trades`], ['Best trade', `${sign(best)}${Math.abs(best).toFixed(2)}%`, 'after fees'], ['Worst trade', `${sign(worst)}${Math.abs(worst).toFixed(2)}%`, 'after fees']] as [label, value, note] (label)}
			<div class="bg-card px-4 py-2.5">
				<dt class="eyebrow">{label}</dt>
				<dd class="num m-0 text-[17px] font-bold">{value}</dd>
				<p class="m-0 text-xs text-muted-foreground">{note}</p>
			</div>
		{/each}
	</dl>
	<!-- A scrollable region must be focusable so keyboard users can scroll it (WCAG 2.1.1). -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class="max-h-[440px] overflow-auto" role="region" aria-label="Trade ledger" tabindex="0">
		<table class="w-full min-w-[720px] border-collapse text-[13px]">
			<caption class="sr-only">Every trade the rule made, oldest first. Returns include fees.</caption>
			<thead class="sticky top-0 z-10 bg-card-raised">
				<tr class="text-left">
					{#each ['Trade', 'Entry', 'Exit', 'Held', 'Entry price', 'Exit price', 'Return', 'Part', 'Status'] as h (h)}
						<th
							scope="col"
							class="border-b border-border px-3 py-2 text-[11px] font-bold tracking-[0.06em] whitespace-nowrap text-muted-foreground uppercase
								{['Held', 'Entry price', 'Exit price', 'Return'].includes(h) ? 'text-right' : ''}">{h}</th
						>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each trades as t (t.n)}
					<tr class="border-b border-border last:border-0 even:bg-card-raised">
						<td class="px-3 py-2 font-mono text-[12px] font-semibold text-info-foreground">T-{String(t.n).padStart(3, '0')}</td>
						<td class="num px-3 py-2 whitespace-nowrap">{fmtDateTime(t.entry_time)}</td>
						<td class="num px-3 py-2 whitespace-nowrap">{t.open ? '—' : fmtDateTime(t.exit_time)}</td>
						<td class="num px-3 py-2 text-right">{t.hours} h</td>
						<td class="num px-3 py-2 text-right">{t.entry_price.toFixed(decimals)}</td>
						<td class="num px-3 py-2 text-right">{t.exit_price.toFixed(decimals)}</td>
						<td class="num px-3 py-2 text-right font-semibold {t.return_pct >= 0 ? 'text-success-foreground' : 'text-danger-foreground'}">
							{sign(t.return_pct)}{Math.abs(t.return_pct).toFixed(2)}%
						</td>
						<td class="px-3 py-2"><Badge tone={t.part === 'unseen' ? 'info' : 'neutral'}>{t.part === 'unseen' ? 'Never seen' : 'Seen'}</Badge></td>
						<td class="px-3 py-2">
							{#if t.open}
								<Badge tone="warning">Open</Badge>
							{:else if t.return_pct > 0}
								<Badge tone="success">Win</Badge>
							{:else}
								<Badge tone="danger">Loss</Badge>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="m-0 border-t border-border px-4 py-2 text-xs text-muted-foreground">
		Bought at the close before the first held hour, sold at the close of the last one. Returns include both fees. An open trade was still held at the last candle.
	</p>
{/if}
