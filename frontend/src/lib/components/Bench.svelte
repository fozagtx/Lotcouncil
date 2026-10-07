<script lang="ts">
	import type { CourtSession } from '#lib/court.svelte.js';
	import { feeLabel } from '#lib/format.js';
	import Icon from './Icon.svelte';
	import SegmentedRadio from './SegmentedRadio.svelte';

	interface Props {
		session: CourtSession;
		onrun: (idea: string) => void;
	}

	let { session, onrun }: Props = $props();
	let textarea: HTMLTextAreaElement | undefined = $state();

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
		(markets?.windows_days ?? []).map((d) => ({ value: d, label: `${d}d`, description: `Last ${d} days` }))
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

<section aria-labelledby="bench-title">
	<h1 id="bench-title" class="mt-1 mb-2 font-serif text-[25px] leading-tight font-semibold tracking-tight sm:text-4xl">
		Put your trading idea on trial.
	</h1>
	<p class="mb-3 text-sm text-subtle sm:mb-5 sm:text-[15px]">
		Describe it in one sentence. Fixed code tests it on hourly prices of Bitget stock tokens and rules
		<b class="font-semibold text-foreground">PASS</b> or <b class="font-semibold text-foreground">FAIL</b>. The AI only
		translates and explains.
	</p>

	<form class="card grid gap-3 p-3 sm:gap-4 sm:p-4" onsubmit={submit} autocomplete="off">
		<div class="grid gap-1">
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
				class="min-h-[4.5rem] w-full resize-y rounded-[12px] border border-border bg-input px-3.5 py-3 text-[17px] leading-snug placeholder:text-muted-foreground focus:border-transparent focus:outline-2 focus:outline-offset-0 focus:outline-ring"
				{onkeydown}
			></textarea>
			<p id="idea-help" class="text-xs text-muted-foreground">
				Average crosses, breakouts and dip buys. Lengths in hours, days or weeks.
			</p>
		</div>

		<div
			class="-mx-3 flex gap-2 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
			role="group"
			aria-label="Example ideas"
		>
			{#each EXAMPLES as example (example.label)}
				<button
					type="button"
					class="chip min-h-10 shrink-0 rounded-full border border-border bg-muted px-3 text-[13px] text-subtle sm:min-h-8 pointer-coarse:min-h-10"
					onclick={() => useExample(example.idea)}
				>
					{example.label}
				</button>
			{/each}
		</div>

		<div class="grid grid-cols-2 gap-x-3 gap-y-3">
			<div class="grid min-w-0 gap-1">
				<label for="symbol" class="field-label">Token</label>
				<select id="symbol" class="select" bind:value={session.symbol}>
					<optgroup label="Bitget stock tokens">
						{#each realTokens as t (t.symbol)}
							<option value={t.symbol}>{t.label}{t.name ? ` · ${t.name}` : ''}</option>
						{/each}
					</optgroup>
					<optgroup label="Practice (made-up prices)">
						{#each practiceTokens as t (t.symbol)}
							<option value={t.symbol}>{t.label}</option>
						{/each}
					</optgroup>
				</select>
			</div>
			<div class="grid min-w-0 gap-1">
				<label for="fee" class="field-label">Fee per trade</label>
				<select id="fee" class="select" bind:value={session.feePct}>
					{#each markets?.fees_pct ?? [] as f (f)}
						<option value={f}>{feeLabel(f)}</option>
					{/each}
				</select>
			</div>
			<div class="col-span-2 grid gap-1">
				<span id="days-label" class="field-label">History</span>
				<SegmentedRadio options={windows} bind:value={session.days} labelledby="days-label" />
			</div>
		</div>

		<button type="submit" class="btn btn-primary" disabled={session.running} aria-busy={session.running}>
			<Icon name={session.running ? 'spinner' : 'gavel'} />
			<span>Put it on trial</span>
		</button>
	</form>
</section>
