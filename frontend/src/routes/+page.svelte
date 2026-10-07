<script lang="ts">
	import { onMount, tick } from 'svelte';
	import Actions from '#lib/components/Actions.svelte';
	import Bench from '#lib/components/Bench.svelte';
	import ErrorBox from '#lib/components/ErrorBox.svelte';
	import ExplanationPanel from '#lib/components/ExplanationPanel.svelte';
	import Header from '#lib/components/Header.svelte';
	import HowDrawer from '#lib/components/HowDrawer.svelte';
	import PricePanel from '#lib/components/PricePanel.svelte';
	import Progress from '#lib/components/Progress.svelte';
	import RulePanel from '#lib/components/RulePanel.svelte';
	import TestCards from '#lib/components/TestCards.svelte';
	import Verdict from '#lib/components/Verdict.svelte';
	import { CourtSession, EXAMPLE_IDEA } from '#lib/court.svelte.js';
	import type { Rule } from '#lib/types.js';

	const session = new CourtSession();
	let drawer: HowDrawer | undefined = $state();
	let rulingSection: HTMLElement | undefined = $state();
	let editorOpen = $state(false);

	const maxDays = $derived(Math.max(...(session.markets?.windows_days ?? [180])));
	const aiOn = $derived(!!session.markets?.ai_enabled);

	onMount(() => {
		session.init();
	});

	function scrollToRuling() {
		const el = rulingSection;
		if (!el) return;
		const top = el.getBoundingClientRect().top;
		if (top > window.innerHeight * 0.5 || top < 0) {
			const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
		}
	}

	function runIdea(idea: string) {
		editorOpen = false;
		session.run({ idea });
		scrollToRuling();
	}

	function runRule(rule: Rule) {
		const same = session.reading && JSON.stringify(session.reading.rule) === JSON.stringify(rule);
		session.run({ rule, idea: same ? session.idea.trim() : '' });
		scrollToRuling();
	}

	function widen() {
		session.days = maxDays;
		session.retry();
	}

	async function editNumbers() {
		editorOpen = true;
		await tick();
		document.getElementById('rule-form')?.scrollIntoView({ block: 'center' });
		(document.querySelector('#rule-form input') as HTMLInputElement | null)?.focus();
	}

	function useExample() {
		session.idea = EXAMPLE_IDEA;
		runIdea(EXAMPLE_IDEA);
	}
</script>

<svelte:head>
	<title>Lotcouncil · put your trading idea on trial</title>
</svelte:head>

<a
	href="#ruling"
	class="absolute -left-[999px] top-2 z-20 rounded-lg bg-card px-3 py-2 focus:left-2">Skip to the ruling</a
>

<Header onHow={() => drawer?.open()} />

<main
	class="mx-auto grid max-w-7xl gap-5 px-4 pt-1 pb-8 lg:grid-cols-[minmax(330px,380px)_minmax(0,1fr)] lg:items-start lg:gap-8 lg:pt-3"
>
	<div class="lg:sticky lg:top-4">
		<Bench {session} onrun={runIdea} />
	</div>

	<section id="ruling" bind:this={rulingSection} tabindex="-1" class="grid min-w-0 gap-4 outline-none" aria-label="Ruling">
		<Progress steps={session.steps} />

		{#if session.error}
			<ErrorBox
				failure={session.error}
				isPractice={session.isPractice}
				onretry={() => session.retry()}
				onpractice={() => session.tryPractice()}
				onexample={useExample}
			/>
		{:else}
			<Verdict
				result={session.result}
				markets={session.markets}
				example={session.example}
				{maxDays}
				onwiden={widen}
				onedit={editNumbers}
			/>
			{#if session.reading}
				<RulePanel
					reading={session.reading}
					ruleText={session.result?.ruling.rule_text ?? ''}
					showNotice={aiOn}
					bind:open={editorOpen}
					onrun={runRule}
				/>
			{/if}
			<TestCards result={session.result} markets={session.markets} />
			<ExplanationPanel explanation={session.explanation} showNotice={aiOn} />
			<PricePanel result={session.result} />
			<Actions {session} />
		{/if}
	</section>
</main>

<footer class="mx-auto max-w-7xl px-4 pt-2 pb-10 text-[13px] text-muted-foreground">
	<p class="m-0 mb-1.5 max-w-3xl">
		<b class="text-subtle">Not financial advice.</b> A PASS means “not obviously luck on this history”, not that an idea will make
		money. Lotcouncil never trades or holds money.
	</p>
	{#if session.markets}
		<p class="m-0 max-w-3xl">
			{aiOn
				? `Ideas are read and explained by ${session.markets.ai_model} on Nebius AI Studio. Verdicts come only from fixed code.`
				: 'AI is off on this server: a built-in keyword reader and summary are used. Verdicts come only from fixed code.'}
		</p>
	{/if}
</footer>

<p class="sr-only" aria-live="polite">{session.announcement}</p>

<HowDrawer bind:this={drawer} />
