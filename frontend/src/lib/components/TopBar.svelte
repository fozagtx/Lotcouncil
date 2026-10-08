<script lang="ts">
	import type { CourtSession } from '#lib/court.svelte.js';
	import { toggleTheme } from '#lib/theme.js';
	import Badge from './Badge.svelte';
	import BrandMark from './BrandMark.svelte';
	import Icon from './Icon.svelte';

	let { session, onhow }: { session: CourtSession; onhow: () => void } = $props();

	const market = $derived(session.result?.market);
	const markets = $derived(session.markets);
	const source = $derived.by(() => {
		if (!market) return { tone: 'neutral' as const, text: session.running ? 'Loading' : 'Waiting' };
		if (market.source === 'bitget') return { tone: 'success' as const, text: 'Live Bitget' };
		if (market.source === 'saved') return { tone: 'warning' as const, text: 'Saved Bitget' };
		return { tone: 'warning' as const, text: 'Practice prices' };
	});
</script>

{#snippet chips()}
	<Badge tone={source.tone} dot live={session.running}><span class="sr-only">Data: </span>{source.text}</Badge>
	{#if markets}
		<Badge tone={markets.ai_enabled ? 'info' : 'neutral'} dot>
			{markets.ai_enabled ? `AI · ${markets.ai_model?.split('/').at(-1) ?? 'on'}` : 'AI off · keyword reader'}
		</Badge>
	{/if}
{/snippet}

<header class="border-b border-border bg-card">
	<div class="flex items-center gap-3 px-4 py-3 lg:gap-6 lg:px-6">
		<a href="./" class="shrink-0 lg:hidden" aria-label="Lotcouncil home"><BrandMark class="size-8" /></a>
		<div class="min-w-0 flex-1">
			<p class="m-0 text-[12px] font-extrabold tracking-[0.14em] text-brand sm:text-[13px]">LOTCOUNCIL</p>
			<h1 class="m-0 truncate text-[15px] leading-tight font-semibold tracking-tight sm:text-lg">
				Strategy court<span class="hidden sm:inline"> · put your trading idea on trial</span>
			</h1>
			<p class="m-0 hidden truncate text-[13px] text-muted-foreground md:block">
				Fixed code rules PASS or FAIL on hourly Bitget stock-token prices. The AI only translates and explains.
			</p>
		</div>

		<div class="hidden flex-wrap items-center gap-2 md:flex" role="group" aria-label="Status">
			{@render chips()}
			{#if session.result}
				{@const st = session.result.ruling.settings}
				<Badge tone="neutral"><span class="font-mono tracking-normal normal-case">{st.court_version} · seed {st.seed}</span></Badge>
			{/if}
		</div>

		<div class="flex shrink-0 items-center gap-2">
			<button type="button" class="btn btn-secondary px-2.5 sm:px-3.5" onclick={onhow} aria-label="How it works">
				<Icon name="book" class="size-4" /><span class="hidden sm:inline">How it works</span>
			</button>
			<button
				type="button"
				class="btn btn-secondary size-10 p-0 lg:hidden"
				aria-label="Switch between light and dark mode"
				onclick={toggleTheme}
			>
				<Icon name="moon" class="size-[18px]" />
			</button>
		</div>
	</div>
	<div class="-mt-1 flex flex-wrap gap-2 px-4 pb-2.5 md:hidden" role="group" aria-label="Status">
		{@render chips()}
	</div>
</header>
