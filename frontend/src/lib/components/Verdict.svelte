<script lang="ts">
	import type { CourtResult } from '#lib/court.svelte.js';
	import { feeLabel, int } from '#lib/format.js';
	import type { Markets, TestKey } from '#lib/types.js';
	import Mark from './Mark.svelte';

	interface Props {
		result: CourtResult | null;
		markets: Markets | null;
		example: boolean;
		maxDays: number;
		onwiden: () => void;
		onedit: () => void;
	}

	let { result, markets, example, maxDays, onwiden, onedit }: Props = $props();

	const SOURCE: Record<string, string> = {
		bitget: 'Live Bitget prices',
		saved: 'Saved Bitget prices',
		practice: 'Practice prices'
	};
	const KEYS: TestKey[] = ['A', 'B', 'C'];

	const ruling = $derived(result?.ruling);
	const failedCount = $derived(ruling ? Object.values(ruling.tests).filter((t) => !t.passed).length : 0);
	const caveat = $derived.by(() => {
		if (!ruling) return '';
		if (ruling.verdict === 'PASS')
			return 'Passed all three tests. That means not obviously luck on this history. It is not a prediction.';
		if (!ruling.gate.passed) {
			const made = ruling.gate.trades
				? `it made ${ruling.gate.trades} trade${ruling.gate.trades === 1 ? '' : 's'}`
				: 'it never traded';
			return `Not judged: ${made}, and the court needs at least ${ruling.gate.min_trades}.`;
		}
		return `Failed ${failedCount} of 3 tests. An idea must pass all three.`;
	});
	const notes = $derived.by(() => {
		if (!result) return [];
		const out: string[] = [];
		if (result.fallbackNote) out.push(result.fallbackNote);
		if (result.market.source !== 'bitget') out.push(result.market.source_note);
		if (result.market.short_history)
			out.push(`Only ${result.market.days_available} days of history exist for ${result.market.label}, so all of it was used.`);
		return out;
	});
</script>

<article
	class="relative overflow-hidden rounded-[20px] border border-border bg-card p-4 pl-5 sm:p-6 sm:pl-7"
	aria-busy={!result}
	aria-labelledby="verdict-headline"
>
	<span
		class="absolute inset-y-0 left-0 w-1.5 {ruling?.verdict === 'PASS'
			? 'bg-success'
			: ruling?.verdict === 'FAIL'
				? 'bg-danger'
				: 'bg-border'}"
		aria-hidden="true"
	></span>
	{#if example && result}
		<p class="m-0 mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase sm:absolute sm:top-3 sm:right-4 sm:mb-0">
			Example ruling
		</p>
	{/if}

	<div class="flex flex-wrap items-center gap-4 sm:gap-6">
		{#if ruling}
			<div
				class="stamp inline-grid min-w-[3.4em] -rotate-3 place-items-center rounded-[14px] border-[3px] px-3.5 pt-1 pb-0.5 text-center text-[64px] leading-none font-extrabold tracking-[0.06em] sm:border-4 sm:px-4.5 sm:text-[88px]
					{ruling.verdict === 'PASS'
					? 'border-success bg-success-muted text-success-foreground'
					: 'border-danger bg-danger-muted text-danger-foreground'}"
				aria-label="Verdict: {ruling.verdict}"
				role="img"
			>
				{ruling.verdict}
			</div>
		{:else}
			<div class="skeleton h-[72px] w-[200px] -rotate-3 rounded-[14px] sm:h-[96px] sm:w-[300px]" aria-hidden="true"></div>
		{/if}

		<div class="min-w-0 flex-[1_1_260px]">
			{#if ruling && result}
				<h2 id="verdict-headline" class="m-0 mb-1.5 font-serif text-[22px] leading-tight font-semibold sm:text-[26px]">
					{ruling.headline}
				</h2>
				<p class="m-0 mb-2.5 text-sm text-subtle">{caveat}</p>
				<p class="m-0 mb-1.5 text-[15px] break-words">
					<span class="text-muted-foreground">“</span>{result.idea || ruling.rule_text}<span class="text-muted-foreground"
						>”</span
					>
				</p>
				<p class="m-0 text-[13px] text-muted-foreground">
					{result.market.label} · {result.market.days_available} days · {int(result.market.candles)} hourly candles · fee
					{feeLabel(100 * result.request.fee)} · {SOURCE[result.market.source]}
				</p>
			{:else}
				<h2 id="verdict-headline" class="sr-only">The court is ruling</h2>
				<div class="grid gap-2.5" aria-hidden="true">
					<div class="skeleton h-7 w-4/5"></div>
					<div class="skeleton h-4 w-3/5"></div>
					<div class="skeleton h-4 w-full"></div>
					<div class="skeleton h-3.5 w-2/3"></div>
				</div>
			{/if}
		</div>
	</div>

	<ul class="m-0 mt-4 grid list-none gap-2 p-0 sm:mt-5 sm:grid-cols-3">
		{#each KEYS as key (key)}
			{@const t = ruling?.tests[key]}
			<li class="flex min-w-0 items-center gap-2 rounded-[10px] bg-muted px-2.5 py-2 text-[13.5px]">
				{#if ruling}
					<Mark state={!t ? 'skip' : t.passed ? 'pass' : 'fail'} />
					<span class="truncate">
						<b class="font-semibold">{key} · {markets?.tests[key].name}</b>
						{!t ? 'not run' : t.passed ? 'passed' : 'failed'}
					</span>
				{:else}
					<span class="skeleton size-5 rounded-full" aria-hidden="true"></span>
					<span class="skeleton h-3.5 w-24" aria-hidden="true"></span>
				{/if}
			</li>
		{/each}
	</ul>

	{#if notes.length}
		<p class="notice mt-3 mb-0">{notes.join(' ')}</p>
	{/if}

	{#if ruling && !ruling.gate.passed}
		<div class="mt-3 flex flex-wrap gap-2">
			{#if result && result.request.days < maxDays}
				<button type="button" class="btn btn-secondary" onclick={onwiden}>Try the {maxDays}-day window</button>
			{/if}
			<button type="button" class="btn btn-secondary" onclick={onedit}>Edit the numbers</button>
		</div>
	{/if}
</article>
