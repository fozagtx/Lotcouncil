<!--
	Horizontal tab menu in the AlignUI style (alignui.com/docs/ui/tab-menu-horizontal):
	flat text tabs on the card's bottom border, with a primary underline that springs
	between selections.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { Spring } from 'svelte/motion';
	import { cn } from './utils.js';

	interface Tab {
		id: string;
		label: string;
		count?: number | null;
	}

	interface Props {
		tabs: Tab[];
		selected: string;
		label: string;
		class?: string;
	}

	let { tabs, selected = $bindable(), label, class: className = '' }: Props = $props();

	let nav: HTMLDivElement | undefined = $state();
	let buttons: HTMLButtonElement[] = $state([]);
	let ready = $state(false);
	let reduce = false;

	const spring = { stiffness: 0.3, damping: 0.8 };
	const lineX = new Spring(0, spring);
	const lineW = new Spring(0, spring);

	const activeIndex = $derived(Math.max(0, tabs.findIndex((t) => t.id === selected)));

	function rectOf(i: number): { x: number; w: number } {
		const b = buttons[i];
		return b ? { x: b.offsetLeft, w: b.offsetWidth } : { x: 0, w: 0 };
	}

	onMount(() => {
		reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const place = () => {
			const r = rectOf(activeIndex);
			lineX.set(r.x, { instant: true });
			lineW.set(r.w, { instant: true });
		};
		place();
		ready = true;
		const ro = new ResizeObserver(place);
		if (nav) ro.observe(nav);
		return () => ro.disconnect();
	});

	$effect(() => {
		const r = rectOf(activeIndex);
		if (ready) {
			const opts = reduce ? { instant: true } : undefined;
			lineX.set(r.x, opts);
			lineW.set(r.w, opts);
		}
	});

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

<div class={cn('max-w-full min-w-0 overflow-x-auto [scrollbar-width:none]', className)}>
	<div bind:this={nav} role="tablist" tabindex="-1" aria-label={label} class="relative flex w-max items-end">
		{#each tabs as tab, i (tab.id)}
			{@const active = selected === tab.id}
			<button
				type="button"
				role="tab"
				id="tab-{tab.id}"
				bind:this={buttons[i]}
				aria-selected={active}
				aria-controls="tabpanel-{tab.id}"
				tabindex={active ? 0 : -1}
				class={cn(
					'relative inline-flex h-9 items-center gap-1.5 px-3 pb-px text-sm font-medium whitespace-nowrap transition-colors duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:ring-inset',
					active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
				)}
				onclick={() => (selected = tab.id)}
				onkeydown={(e) => onkeydown(e, i)}
			>
				{tab.label}
				{#if tab.count !== undefined && tab.count !== null}
					<span class="num rounded-md bg-muted px-1.5 py-px text-[11px] font-semibold {active ? 'text-foreground' : 'text-muted-foreground'}">{tab.count}</span>
				{/if}
			</button>
		{/each}

		<!-- The active underline, sprung between tabs. -->
		<div
			class="pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-primary transition-opacity"
			style:opacity={ready ? 1 : 0}
			style:transform="translate3d({lineX.current}px, 0, 0)"
			style:width="{lineW.current}px"
			aria-hidden="true"
		></div>
	</div>
</div>
