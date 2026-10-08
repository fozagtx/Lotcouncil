<script lang="ts">
	import '@fontsource-variable/sora';
	import '@fontsource-variable/ibm-plex-sans';
	import '@fontsource/ibm-plex-mono/400.css';
	import '@fontsource/ibm-plex-mono/500.css';
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
