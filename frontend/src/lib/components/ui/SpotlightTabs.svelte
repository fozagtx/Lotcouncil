<!--
	Svelte port of VengeanceUI SpotlightNavbar (MIT, github.com/Ashutoshx7/VengeanceUI), used as a
	tab list: a light follows the mouse and a glow line springs to the selected tab.
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
	let hovering = $state(false);
	let ready = $state(false);
	let reduce = false;

	const spring = { stiffness: 0.12, damping: 0.5 };
	const spotlight = new Spring(0, spring);
	const ambience = new Spring(0, spring);

	const activeIndex = $derived(Math.max(0, tabs.findIndex((t) => t.id === selected)));

	function centerOf(i: number): number {
		const b = buttons[i];
		return b ? b.offsetLeft + b.offsetWidth / 2 : 0;
	}

	onMount(() => {
		reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const place = () => {
			ambience.set(centerOf(activeIndex), { instant: true });
			if (!hovering) spotlight.set(centerOf(activeIndex), { instant: true });
		};
		place();
		ready = true;
		const ro = new ResizeObserver(place);
		if (nav) ro.observe(nav);
		return () => ro.disconnect();
	});

	// Spring the glow line to the newly selected tab.
	$effect(() => {
		const x = centerOf(activeIndex);
		if (ready) ambience.set(x, reduce ? { instant: true } : undefined);
	});

	function onpointermove(e: PointerEvent) {
		if (e.pointerType !== 'mouse' || !nav) return;
		hovering = true;
		spotlight.set(e.clientX - nav.getBoundingClientRect().left, { instant: true });
	}

	function onpointerleave() {
		hovering = false;
		spotlight.set(centerOf(activeIndex), reduce ? { instant: true } : undefined);
	}

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

<div class={cn('max-w-full min-w-0 overflow-x-auto p-1 [scrollbar-width:none]', className)}>
	<div
		bind:this={nav}
		role="tablist"
		tabindex="-1"
		aria-label={label}
		class="spotlight-nav relative flex h-11 w-max items-center overflow-hidden rounded-full px-1.5"
		{onpointermove}
		{onpointerleave}
	>
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
					'relative z-10 inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium sm:px-4 transition-colors duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
					active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
				)}
				onclick={() => (selected = tab.id)}
				onkeydown={(e) => onkeydown(e, i)}
			>
				{tab.label}
				{#if tab.count !== undefined && tab.count !== null}
					<span class="num rounded-full bg-muted px-1.5 py-px text-[11px] font-semibold {active ? 'text-foreground' : ''}">{tab.count}</span>
				{/if}
			</button>
		{/each}

		<!-- The moving spotlight (follows the mouse). -->
		<div
			class="pointer-events-none absolute inset-0 z-[1] transition-opacity duration-300"
			style:opacity={hovering ? 1 : 0}
			style:background="radial-gradient(120px circle at {spotlight.current}px 100%, var(--spotlight-color) 0%, transparent 50%)"
			aria-hidden="true"
		></div>
		<!-- The glow line that stays under the selected tab. -->
		<div
			class="pointer-events-none absolute bottom-0 left-0 z-[2] h-[2px] w-full transition-opacity"
			style:opacity={ready ? 1 : 0}
			style:background="radial-gradient(60px circle at {ambience.current}px 0%, var(--ambience-color) 0%, transparent 100%)"
			aria-hidden="true"
		></div>
	</div>
</div>

<style>
	.spotlight-nav {
		background-color: rgb(250 250 250);
		border: 1px solid rgb(0 0 0 / 0.15);
		box-shadow:
			0 4px 6px -1px rgb(0 0 0 / 0.05),
			0 2px 4px -2px rgb(0 0 0 / 0.05);
	}
	:global(:root[data-theme='dark']) .spotlight-nav {
		background-color: rgb(10 10 10);
		border-color: rgb(255 255 255 / 0.2);
		box-shadow:
			0 4px 6px -1px rgb(0 0 0 / 0.3),
			0 2px 4px -2px rgb(0 0 0 / 0.3);
	}
	@media (prefers-color-scheme: dark) {
		:global(:root:not([data-theme='light'])) .spotlight-nav {
			background-color: rgb(10 10 10);
			border-color: rgb(255 255 255 / 0.2);
			box-shadow:
				0 4px 6px -1px rgb(0 0 0 / 0.3),
				0 2px 4px -2px rgb(0 0 0 / 0.3);
		}
	}
</style>
