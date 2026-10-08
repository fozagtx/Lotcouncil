<script lang="ts">
	import type { CourtFailure } from '#lib/court.svelte.js';
	import Icon from './Icon.svelte';
	import Alert from './ui/Alert.svelte';
	import Button from './ui/Button.svelte';

	interface Props {
		failure: CourtFailure;
		onretry: () => void;
		onexample: () => void;
	}

	let { failure, onretry, onexample }: Props = $props();

	const TITLES = {
		idea: 'The court couldn’t read that idea',
		data: 'Couldn’t load the prices',
		network: 'Can’t reach the court',
		rate: 'Too many rulings for now',
		server: 'The court hit a problem',
		cut: 'The ruling was cut off'
	};
</script>

<Alert variant="destructive" title={TITLES[failure.kind]}>
	{#snippet icon()}<Icon name="alert" />{/snippet}
	<p>{failure.message}</p>
	{#if failure.kind === 'idea'}
		<Button variant="outline" size="sm" class="mt-2" onclick={onexample}>Use an example idea</Button>
	{:else if failure.kind !== 'rate'}
		<Button variant="outline" size="sm" class="mt-2" onclick={onretry}><Icon name="retry" />Try again</Button>
	{/if}
</Alert>
