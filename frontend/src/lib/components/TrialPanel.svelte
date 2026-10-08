<script lang="ts">
	import type { CourtSession } from '#lib/court.svelte.js';
	import { feeLabel } from '#lib/format.js';
	import Icon from './Icon.svelte';
	import Button from './ui/Button.svelte';
	import Card from './ui/Card.svelte';
	import CardContent from './ui/CardContent.svelte';
	import CardDescription from './ui/CardDescription.svelte';
	import CardHeader from './ui/CardHeader.svelte';
	import CardTitle from './ui/CardTitle.svelte';
	import Kbd from './ui/Kbd.svelte';
	import RadialGlowButton from './ui/RadialGlowButton.svelte';
	import Spinner from './ui/Spinner.svelte';
	import Textarea from './ui/Textarea.svelte';
	import ToggleTabs from './ui/ToggleTabs.svelte';

	interface Props {
		session: CourtSession;
		onrun: (idea: string) => void;
		textarea?: HTMLTextAreaElement | null;
		class?: string;
	}

	let { session, onrun, textarea = $bindable(null), class: className = '' }: Props = $props();

	const EXAMPLES = [
		{ label: '10h / 40h average cross', idea: 'buy when the 10 hour average crosses above the 40 hour average' },
		{ label: '48h breakout', idea: 'buy when the price breaks above its 48 hour high, sell at its 24 hour low' },
		{ label: 'Buy a 1.5% dip', idea: 'buy when the price drops 1.5% below its 24 hour average, sell after 24 hours' },
		{ label: 'Price above 3-day average', idea: 'hold while the price is above its 3 day average' }
	];

	const markets = $derived(session.markets);
	const tokens = $derived(markets?.tokens ?? []);
	const windows = $derived(
		(markets?.windows_days ?? []).map((d) => ({ value: d, label: `${d}D`, description: `Last ${d} days` }))
	);

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const idea = session.idea.trim();
		if (!idea) {
			textarea?.focus();
			return;
		}
		onrun(idea);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
			e.preventDefault();
			(e.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
		}
	}

	function useExample(idea: string) {
		session.idea = idea;
		onrun(idea);
	}
</script>

<Card class={className} aria-labelledby="trial-title">
	<CardHeader>
		<CardTitle id="trial-title">New trial</CardTitle>
		<CardDescription>Describe a trading idea in one sentence. Fixed code rules PASS or FAIL; the AI only translates.</CardDescription>
	</CardHeader>
	<CardContent>
		<form class="grid gap-5" onsubmit={submit} autocomplete="off">
			<div class="grid gap-2">
				<label for="idea" class="field-label">Your idea</label>
				<div class="flex flex-col gap-3 xl:flex-row xl:items-stretch">
					<Textarea
						id="idea"
						bind:ref={textarea}
						bind:value={session.idea}
						rows={2}
						maxlength={400}
						required
						aria-describedby="idea-help"
						placeholder="buy when the 10 hour average crosses above the 40 hour average"
						class="min-h-[4.5rem] flex-1 resize-none px-3.5 py-3 text-base leading-snug md:text-[15px]"
						{onkeydown}
					/>
					<RadialGlowButton type="submit" class="w-full xl:w-auto xl:min-w-[200px]" disabled={session.running} aria-busy={session.running}>
						{#if session.running}<Spinner />{:else}<Icon name="gavel" class="size-[18px]" />{/if}
						<span>{session.running ? 'Ruling…' : 'Put it on trial'}</span>
					</RadialGlowButton>
				</div>
				<p id="idea-help" class="m-0 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
					Average crosses, breakouts and dip buys, in hours, days or weeks.
					<span class="inline-flex items-center gap-1">Press <Kbd>Enter</Kbd> to run.</span>
				</p>
			</div>

			<div class="grid gap-2">
				<span class="field-label" id="examples-label">Examples</span>
				<div
					class="-mx-5 flex gap-2 overflow-x-auto px-5 py-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
					role="group"
					aria-labelledby="examples-label"
				>
					{#each EXAMPLES as example (example.label)}
						<Button variant="outline" size="sm" class="shrink-0 rounded-full px-3.5" onclick={() => useExample(example.idea)}>
							{example.label}
						</Button>
					{/each}
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4 border-t pt-5 sm:flex sm:flex-wrap sm:items-end">
				<div class="grid min-w-0 gap-2 sm:w-[210px]">
					<label for="symbol" class="field-label">Token</label>
					<select id="symbol" class="select" bind:value={session.symbol}>
						{#each tokens as t (t.symbol)}
							<option value={t.symbol}>{t.label}/USDT{t.name ? ` · ${t.name}` : ''}</option>
						{/each}
					</select>
				</div>
				<div class="grid min-w-0 gap-2 sm:w-[120px]">
					<label for="fee" class="field-label">Fee / trade</label>
					<select id="fee" class="select" bind:value={session.feePct}>
						{#each markets?.fees_pct ?? [] as f (f)}
							<option value={f}>{feeLabel(f)}</option>
						{/each}
					</select>
				</div>
				<div class="col-span-2 grid gap-2">
					<span id="days-label" class="field-label">History</span>
					<ToggleTabs options={windows} bind:value={session.days} labelledby="days-label" class="w-full sm:w-fit" />
				</div>
			</div>
		</form>
	</CardContent>
</Card>
