<script lang="ts">
	import { onMount, tick } from 'svelte';
	import ChartPanel from '#lib/components/ChartPanel.svelte';
	import HowDrawer from '#lib/components/HowDrawer.svelte';
	import Inspector from '#lib/components/Inspector.svelte';
	import KpiStrip from '#lib/components/KpiStrip.svelte';
	import RecentRulings from '#lib/components/RecentRulings.svelte';
	import RulePanel from '#lib/components/RulePanel.svelte';
	import Tabs from '#lib/components/Tabs.svelte';
	import TestsGrid from '#lib/components/TestsGrid.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import TradeTable from '#lib/components/TradeTable.svelte';
	import TrialPanel from '#lib/components/TrialPanel.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Skeleton from '#lib/components/ui/Skeleton.svelte';
	import { CourtSession, EXAMPLE_IDEA } from '#lib/court.svelte.js';
	import type { Rule } from '#lib/types.js';

	const session = new CourtSession();
	let drawer: HowDrawer | undefined = $state();
	let tab = $state('tests');

	const maxDays = $derived(Math.max(...(session.markets?.windows_days ?? [180])));
	const aiOn = $derived(!!session.markets?.ai_enabled);
	const result = $derived(session.result);
	const decimals = $derived.by(() => {
		const last = result?.chart.close.at(-1) ?? 100;
		return last >= 100 ? 2 : last >= 1 ? 3 : 5;
	});

	onMount(() => {
		session.init();
	});

	function reveal(id: string) {
		const el = document.getElementById(id);
		if (!el) return;
		const top = el.getBoundingClientRect().top;
		if (top > window.innerHeight * 0.6 || top < 0) {
			const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
		}
	}

	function runIdea(idea: string) {
		session.run({ idea });
		// On phones the verdict sits below the input; bring it into view.
		if (window.innerWidth < 1280) reveal('inspector');
	}

	function runRule(rule: Rule) {
		const same = session.reading && JSON.stringify(session.reading.rule) === JSON.stringify(rule);
		session.run({ rule, idea: same ? session.idea.trim() : '' });
		reveal('inspector');
	}

	function widen() {
		session.changeWindow(maxDays);
	}

	async function editNumbers() {
		tab = 'rule';
		await tick();
		reveal('evidence');
		(document.querySelector('#rule-form input') as HTMLInputElement | null)?.focus();
	}

	function useExample() {
		session.idea = EXAMPLE_IDEA;
		runIdea(EXAMPLE_IDEA);
	}


</script>

<svelte:head>
	<title>Lotcouncil · Strategy court</title>
</svelte:head>

<a href="#inspector" class="absolute top-2 -left-[999px] z-40 rounded-md border bg-card px-3 py-2 text-sm font-medium shadow-sm focus:left-2">Skip to the ruling</a>

<div>
	<TopBar {session} onhow={() => drawer?.open()} />

	<main class="mx-auto max-w-[1600px] px-4 pt-6 pb-8 lg:px-6 lg:pt-8">
		<div class="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
			<div class="grid gap-1.5">
				<h1 class="m-0 text-2xl font-semibold tracking-tight sm:text-3xl">Strategy court</h1>
				<p class="m-0 max-w-2xl text-sm text-muted-foreground sm:text-base">
					Put a trading idea on trial against hourly Bitget stock-token prices. Three fixed tests decide if it is more than luck.
				</p>
			</div>
		</div>
		<div class="flex flex-col gap-4 lg:gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_460px]">
			<div class="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-6">
				<TrialPanel {session} onrun={runIdea} class="order-1" />
				<KpiStrip {result} class="order-3" />
				<ChartPanel {session} class="order-4" />
				<div id="evidence" class="order-5 min-w-0 scroll-mt-3 lg:scroll-mt-20">
					<Tabs
						label="Evidence"
						bind:selected={tab}
						tabs={[
							{ id: 'tests', label: 'Tests' },
							{ id: 'trades', label: 'Trades', count: result ? result.chart.trades.length : null },
							{ id: 'words', label: 'Plain words' },
							{ id: 'rule', label: 'Rule' }
						]}
					>
						{#snippet actions()}
							{#if result}
								<Badge variant="outline">
									<span class="num">{result.market.candles.toLocaleString('en-US')} candles · fee {(100 * result.request.fee).toFixed(2)}%</span>
								</Badge>
							{/if}
						{/snippet}
						{#snippet panel(id)}
							{#if id === 'tests'}
								<TestsGrid {result} markets={session.markets} />
							{:else if id === 'trades'}
								{#if result}
									<TradeTable trades={result.chart.trades} {decimals} />
								{:else}
									<div class="grid gap-2 p-5 sm:p-6" aria-hidden="true">
										{#each [0, 1, 2, 3, 4] as i (i)}<Skeleton class="h-8" />{/each}
									</div>
								{/if}
							{:else if id === 'words'}
								<div class="grid gap-3 p-5 sm:p-6" aria-busy={!session.explanation}>
									{#if session.explanation}
										<div class="flex flex-wrap items-center gap-2">
											<Badge variant={session.explanation.source === 'ai' ? 'info' : 'secondary'}>
												{session.explanation.source === 'ai' ? 'Written by AI from the court’s numbers' : 'Built-in summary'}
											</Badge>
										</div>
										<p class="m-0 max-w-prose text-base leading-relaxed">{session.explanation.text}</p>
										{#if aiOn && session.explanation.notice}
											<p class="m-0 text-[13px] text-muted-foreground">{session.explanation.notice}</p>
										{/if}
									{:else}
										<div class="grid gap-2" aria-hidden="true">
											<Skeleton class="h-4 w-full" />
											<Skeleton class="h-4 w-11/12" />
											<Skeleton class="h-4 w-4/5" />
										</div>
									{/if}
									<p class="m-0 text-xs text-muted-foreground">
										The verdict comes from fixed code. The explanation is written from the court’s numbers and cannot change it.
									</p>
								</div>
							{:else if id === 'rule'}
								<RulePanel
									reading={session.reading}
									ruleText={result?.ruling.rule_text ?? ''}
									showNotice={aiOn}
									running={session.running}
									onrun={runRule}
								/>
							{/if}
						{/snippet}
					</Tabs>
				</div>
			</div>

			<div class="contents xl:flex xl:flex-col xl:gap-6">
				<div id="inspector" class="order-2 scroll-mt-3 lg:scroll-mt-20">
					<Inspector {session} {maxDays} onedit={editNumbers} onwiden={widen} onexample={useExample} />
				</div>
				<RecentRulings {session} class="order-6" />
			</div>
		</div>
	</main>

	<footer class="mx-auto max-w-[1600px] border-t px-4 pt-6 pb-10 text-[13px] text-muted-foreground lg:px-6">
		<p class="m-0 max-w-4xl leading-relaxed">
			<b class="font-medium text-foreground">Not financial advice.</b> A PASS means “not obviously luck on this history”, not that an idea
			will make money. Lotcouncil never trades or holds money.
			{#if session.markets}
				{aiOn
					? `Ideas are read and explained by ${session.markets.ai_model} on Nebius AI Studio; verdicts come only from fixed code.`
					: 'AI is off on this server: a keyword reader and a built-in summary are used; verdicts come only from fixed code.'}
			{/if}
			<a href="/api/docs" rel="external" class="font-medium text-foreground underline underline-offset-4">API docs</a>
		</p>
	</footer>
</div>

<p class="sr-only" aria-live="polite">{session.announcement}</p>

<HowDrawer bind:this={drawer} />
