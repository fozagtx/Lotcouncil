<script lang="ts">
	import { toggleTheme } from '#lib/theme.js';
	import BrandMark from './BrandMark.svelte';
	import Icon, { type IconName } from './Icon.svelte';

	interface Props {
		onhow: () => void;
		onaudit: () => void;
		onrecent: () => void;
		ontrial: () => void;
	}

	let { onhow, onaudit, onrecent, ontrial }: Props = $props();

	const ITEMS: { label: string; icon: IconName; action: () => void; current?: boolean }[] = $derived([
		{ label: 'Court: new trial', icon: 'scales', action: ontrial, current: true },
		{ label: 'Recent rulings', icon: 'clock', action: onrecent },
		{ label: 'How the court works', icon: 'book', action: onhow },
		{ label: 'Check an audit file', icon: 'shield', action: onaudit }
	]);
</script>

<!-- Desktop only: phones get the same actions in the top bar. -->
<nav
	class="fixed inset-y-0 left-0 z-30 hidden w-16 flex-col items-center gap-2 bg-rail py-4 lg:flex"
	aria-label="Lotcouncil"
>
	<a href="./" class="mb-3 rounded-[10px]" aria-label="Lotcouncil home"><BrandMark /></a>
	{#each ITEMS as item (item.label)}
		<button
			type="button"
			class="rail-btn relative grid size-11 place-items-center rounded-[10px] text-rail-foreground
				{item.current ? 'bg-rail-active text-white' : ''}"
			aria-label={item.label}
			title={item.label}
			aria-current={item.current ? 'page' : undefined}
			onclick={item.action}
		>
			{#if item.current}
				<span class="absolute top-2 bottom-2 -left-2.5 w-[3px] rounded-r bg-brand" aria-hidden="true"></span>
			{/if}
			<Icon name={item.icon} class="size-5" />
		</button>
	{/each}
	<a
		href="/api/docs"
		target="_blank"
		rel="external noopener"
		class="rail-btn grid size-11 place-items-center rounded-[10px] text-rail-foreground"
		aria-label="API documentation (opens in a new tab)"
		title="API documentation"
	>
		<Icon name="code" class="size-5" />
	</a>
	<button
		type="button"
		class="rail-btn mt-auto grid size-11 place-items-center rounded-[10px] text-rail-foreground"
		aria-label="Switch between light and dark mode"
		title="Light or dark"
		onclick={toggleTheme}
	>
		<Icon name="moon" class="size-5" />
	</button>
</nav>
