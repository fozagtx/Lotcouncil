<script lang="ts">
	import type { Snippet } from 'svelte';
	import Card from './ui/Card.svelte';
	import SpotlightTabs from './ui/SpotlightTabs.svelte';

	interface Tab {
		id: string;
		label: string;
		count?: number | null;
	}

	interface Props {
		tabs: Tab[];
		selected: string;
		label: string;
		/** Extra controls at the right end of the tab bar. */
		actions?: Snippet;
		panel: Snippet<[string]>;
		class?: string;
	}

	let { tabs, selected = $bindable(), label, actions, panel, class: className = '' }: Props = $props();
</script>

<Card class={className} aria-label={label}>
	<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-3 py-2.5 sm:px-4">
		<SpotlightTabs {tabs} bind:selected {label} />
		{#if actions}<div class="px-1">{@render actions()}</div>{/if}
	</div>
	{#each tabs as tab (tab.id)}
		{#if selected === tab.id}
			<div role="tabpanel" id="tabpanel-{tab.id}" aria-labelledby="tab-{tab.id}" tabindex="0" class="outline-none">
				{@render panel(tab.id)}
			</div>
		{/if}
	{/each}
</Card>
