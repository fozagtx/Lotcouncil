<script lang="ts">
	import type { CourtSession } from '#lib/court.svelte.js';
	import { toggleTheme } from '#lib/theme.js';
	import BrandMark from './BrandMark.svelte';
	import Icon from './Icon.svelte';
	import Badge, { type DotTone } from './ui/Badge.svelte';
	import Button from './ui/Button.svelte';

	let { session, onhow }: { session: CourtSession; onhow: () => void } = $props();

	const market = $derived(session.result?.market);
	const markets = $derived(session.markets);
	const source = $derived.by((): { dot: DotTone; text: string } => {
		if (!market) return { dot: 'neutral', text: session.running ? 'Loading prices' : 'Waiting for prices' };
		if (market.source === 'bitget') return { dot: 'success', text: 'Live Bitget prices' };
		return { dot: 'warning', text: 'Saved Bitget prices' };
	});
</script>

{#snippet chips()}
	<Badge variant="outline" dot={source.dot} live={session.running}><span class="sr-only">Data: </span>{source.text}</Badge>
	{#if markets}
		<Badge variant="outline" dot={markets.ai_enabled ? 'info' : 'neutral'}>
			{markets.ai_enabled ? `AI · ${markets.ai_model?.split('/').at(-1) ?? 'on'}` : 'AI off · keyword reader'}
		</Badge>
	{/if}
{/snippet}

<header class="relative z-30 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 lg:sticky lg:top-0">
	<div class="mx-auto flex h-11 max-w-[1600px] items-center gap-3 px-4 lg:gap-4 lg:px-6">
		<a href="./" class="flex shrink-0 items-center gap-2 rounded-md" aria-label="Lotcouncil home">
			<BrandMark class="size-6" />
			<span class="font-display text-sm font-semibold tracking-tight">Lotcouncil</span>
		</a>
		<span class="hidden h-5 w-px bg-border sm:block" aria-hidden="true"></span>
		<p class="m-0 hidden min-w-0 flex-1 truncate text-sm text-muted-foreground sm:block">Put a trading idea on trial</p>
		<span class="flex-1 sm:hidden"></span>

		<div class="hidden items-center gap-2 lg:flex" role="group" aria-label="Status">
			{@render chips()}
		</div>

		<div class="flex shrink-0 items-center gap-1.5">
			<Button variant="outline" size="sm" onclick={onhow} aria-label="How it works">
				<Icon name="book" /><span class="hidden sm:inline">How it works</span>
			</Button>
			<Button variant="ghost" size="icon" class="size-8" aria-label="Switch between light and dark mode" onclick={toggleTheme}>
				<Icon name="moon" class="size-4 dark:hidden" />
				<Icon name="sun" class="hidden size-4 dark:block" />
			</Button>
		</div>
	</div>
	<div class="mx-auto flex max-w-[1600px] flex-wrap gap-2 px-4 pb-2 lg:hidden" role="group" aria-label="Status">
		{@render chips()}
	</div>
</header>
