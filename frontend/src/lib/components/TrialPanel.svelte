<script lang="ts">
	import type { CourtSession } from '#lib/court.svelte.js';
	import { feeLabel } from '#lib/format.js';
	import Icon from './Icon.svelte';
	import SegmentedRadio from './SegmentedRadio.svelte';

	interface Props {
		session: CourtSession;
		onrun: (idea: string) => void;
		textarea?: HTMLTextAreaElement;
		class?: string;
	}

	let { session, onrun, textarea = $bindable(), class: className = '' }: Props = $props();

	const EXAMPLES = [
		{ label: '10h / 40h average cross', idea: 'buy when the 10 hour average crosses above the 40 hour average' },
		{ label: '48h breakout', idea: 'buy when the price breaks above its 48 hour high, sell at its 24 hour low' },
		{ label: 'Buy a 1.5% dip', idea: 'buy when the price drops 1.5% below its 24 hour average, sell after 24 hours' },
		{ label: 'Price above 3-day average', idea: 'hold while the price is above its 3 day average' }
	];

	const markets = $derived(session.markets);
	const realTokens = $derived(markets?.tokens.filter((t) => !t.practice) ?? []);
	const practiceTokens = $derived(markets?.tokens.filter((t) => t.practice) ?? []);
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

<section class="panel {className}" aria-labelledby="trial-title">
	<header class="panel-head">
		<h2 id="trial-title" class="panel-title">New trial</h2>
		<span class="text-xs text-muted-foreground">One sentence in, one ruling out</span>
	</header>
	<form class="grid gap-3 p-4" onsubmit={submit} autocomplete="off">
		<div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-stretch">
			<div class="grid gap-1.5">
				<label for="idea" class="field-label">Your idea</label>
				<textarea
					id="idea"
					bind:this={textarea}
					bind:value={session.idea}
					rows="2"
					maxlength="400"
					required
					aria-describedby="idea-help"
					placeholder="buy when the 10 hour average crosses above the 40 hour average"
					class="min-h-[4.25rem] w-full resize-y rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[16px] leading-snug placeholder:text-muted-foreground focus:border-transparent focus:outline-2 focus:outline-offset-0 focus:outline-ring"
					{onkeydown}
				></textarea>
				<p id="idea-help" class="m-0 text-xs text-muted-foreground">
					Average crosses, breakouts and dip buys. Lengths in hours, days or weeks. Press Enter to run.
				</p>
			</div>
			<button
				type="submit"
				class="btn btn-primary min-h-12 px-6 text-[15px] lg:mt-[22px] lg:mb-[22px] lg:min-w-[190px]"
				disabled={session.running}
				aria-busy={session.running}
			>
				<Icon name={session.running ? 'spinner' : 'gavel'} class="size-[18px]" />
				<span>{session.running ? 'Ruling…' : 'Put it on trial'}</span>
			</button>
		</div>

		<div class="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
			<div class="grid gap-1.5">
				<span class="field-label" id="examples-label">Examples</span>
				<div
					class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
					role="group"
					aria-labelledby="examples-label"
				>
					{#each EXAMPLES as example (example.label)}
						<button
							type="button"
							class="chip min-h-10 shrink-0 rounded-full border border-border bg-card px-3 text-[13px] font-medium text-subtle sm:min-h-9 pointer-coarse:min-h-10"
							onclick={() => useExample(example.idea)}
						>
							{example.label}
						</button>
					{/each}
				</div>
			</div>

			<div class="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
				<div class="grid min-w-0 gap-1.5 sm:w-[190px]">
					<label for="symbol" class="field-label">Token</label>
					<select id="symbol" class="select" bind:value={session.symbol}>
						<optgroup label="Bitget stock tokens">
							{#each realTokens as t (t.symbol)}
								<option value={t.symbol}>{t.label}/USDT{t.name ? ` · ${t.name}` : ''}</option>
							{/each}
						</optgroup>
						<optgroup label="Practice (made-up prices)">
							{#each practiceTokens as t (t.symbol)}
								<option value={t.symbol}>{t.label}</option>
							{/each}
						</optgroup>
					</select>
				</div>
				<div class="grid min-w-0 gap-1.5 sm:w-[110px]">
					<label for="fee" class="field-label">Fee / trade</label>
					<select id="fee" class="select" bind:value={session.feePct}>
						{#each markets?.fees_pct ?? [] as f (f)}
							<option value={f}>{feeLabel(f)}</option>
						{/each}
					</select>
				</div>
				<div class="col-span-2 grid gap-1.5">
					<span id="days-label" class="field-label">History</span>
					<SegmentedRadio options={windows} bind:value={session.days} labelledby="days-label" />
				</div>
			</div>
		</div>
	</form>
</section>
