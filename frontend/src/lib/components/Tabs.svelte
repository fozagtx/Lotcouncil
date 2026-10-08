<script lang="ts">
	import type { Snippet } from 'svelte';

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
	let buttons: HTMLButtonElement[] = $state([]);

	function onkeydown(e: KeyboardEvent, i: number) {
		const n = tabs.length;
		const next =
			e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
		if (next >= 0) {
			e.preventDefault();
			selected = tabs[next].id;
			buttons[next]?.focus();
		}
	}
</script>

<section class="panel {className}" aria-label={label}>
	<div class="flex flex-wrap items-center justify-between gap-2 border-b border-border px-2 sm:px-3">
		<div role="tablist" aria-label={label} class="-mb-px flex overflow-x-auto [scrollbar-width:none]">
			{#each tabs as tab, i (tab.id)}
				<button
					type="button"
					role="tab"
					id="tab-{tab.id}"
					bind:this={buttons[i]}
					aria-selected={selected === tab.id}
					aria-controls="tabpanel-{tab.id}"
					tabindex={selected === tab.id ? 0 : -1}
					class="tab inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-[13.5px] font-semibold
						{selected === tab.id ? 'border-brand text-primary' : 'border-transparent text-muted-foreground'}"
					onclick={() => (selected = tab.id)}
					onkeydown={(e) => onkeydown(e, i)}
				>
					{tab.label}
					{#if tab.count !== undefined && tab.count !== null}
						<span
							class="num rounded-full px-1.5 py-0.5 text-[11px] font-bold {selected === tab.id
								? 'bg-brand-wash text-primary'
								: 'bg-muted text-muted-foreground'}">{tab.count}</span
						>
					{/if}
				</button>
			{/each}
		</div>
		{#if actions}<div class="py-2">{@render actions()}</div>{/if}
	</div>
	{#each tabs as tab (tab.id)}
		{#if selected === tab.id}
			<div role="tabpanel" id="tabpanel-{tab.id}" aria-labelledby="tab-{tab.id}" tabindex="0" class="outline-none">
				{@render panel(tab.id)}
			</div>
		{/if}
	{/each}
</section>
