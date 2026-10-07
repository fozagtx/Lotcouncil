<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} type="image/svg+xml" />
	<meta
		name="description"
		content="Put a trading idea on trial. Lotcouncil tests it on Bitget tokenized-stock prices and rules PASS or FAIL with the evidence."
	/>
</svelte:head>

{@render children()}
