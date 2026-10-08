<!--
	Svelte port of VengeanceUI StatsCounter (MIT, github.com/Ashutoshx7/VengeanceUI): counts up to
	`value` when it appears on screen, and glides to each new value. A counter that first appears
	off screen shows its real value at once, so a number is never left at 0. Screen readers get the
	final number straight away.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { cn } from './utils.js';

	interface Props {
		value: number;
		/** Seconds. */
		duration?: number;
		prefix?: string;
		suffix?: string;
		decimals?: number;
		/** Custom formatting; overrides prefix, suffix and decimals. */
		format?: (n: number) => string;
		class?: string;
	}

	let { value, duration = 1.5, prefix = '', suffix = '', decimals = 0, format, class: className = '' }: Props = $props();

	let el: HTMLSpanElement | undefined = $state();
	let ready = $state(false);
	let reduce = false;
	const tween = new Tween(0, { easing: cubicOut });

	const show = (n: number) => (format ? format(n) : `${prefix}${n.toFixed(decimals)}${suffix}`);

	onMount(() => {
		reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const r = el?.getBoundingClientRect();
		const onScreen = !!r && r.bottom > 0 && r.top < window.innerHeight;
		tween.set(value, { duration: reduce || !onScreen ? 0 : duration * 1000 });
		ready = true;
	});

	// Glide to each later value.
	$effect(() => {
		const target = value;
		if (ready) tween.set(target, { duration: reduce ? 0 : duration * 1000 });
	});
</script>

<span bind:this={el} class={cn('tabular-nums', className)}>
	<span aria-hidden="true">{show(ready ? tween.current : value)}</span>
	<span class="sr-only">{show(value)}</span>
</span>
