<script lang="ts">
	import type { CourtFailure } from '#lib/court.svelte.js';
	import Icon from './Icon.svelte';

	interface Props {
		failure: CourtFailure;
		isPractice: boolean;
		onretry: () => void;
		onpractice: () => void;
		onexample: () => void;
	}

	let { failure, isPractice, onretry, onpractice, onexample }: Props = $props();

	const TITLES = {
		idea: 'The court couldn’t read that idea',
		data: 'Couldn’t load the prices',
		network: 'Can’t reach the court',
		rate: 'Too many rulings for now',
		server: 'The court hit a problem',
		cut: 'The ruling was cut off'
	};
</script>

<div class="flex items-start gap-3 rounded-card border border-danger bg-danger-muted px-4 py-3.5" role="alert">
	<Icon name="x" class="mt-0.5 size-5 shrink-0 text-danger-foreground" />
	<div class="grid gap-2">
		<p class="m-0 font-semibold">{TITLES[failure.kind]}</p>
		<p class="m-0 text-sm text-subtle">{failure.message}</p>
		<div class="flex flex-wrap gap-2">
			{#if failure.kind === 'data' && !isPractice}
				<button type="button" class="btn btn-secondary" onclick={onpractice}>Try it on a practice market</button>
			{/if}
			{#if failure.kind === 'idea'}
				<button type="button" class="btn btn-secondary" onclick={onexample}>Use an example idea</button>
			{:else if failure.kind !== 'rate'}
				<button type="button" class="btn btn-secondary" onclick={onretry}>
					<Icon name="retry" class="size-4" />Try again
				</button>
			{/if}
		</div>
	</div>
</div>
