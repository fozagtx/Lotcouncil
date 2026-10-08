<!--
	Svelte port of VengeanceUI BorderBeam (MIT, github.com/Ashutoshx7/VengeanceUI): a light that
	travels around the parent's border. The parent needs `position: relative`.
-->
<script lang="ts">
	import { cn } from './utils.js';

	interface Props {
		class?: string;
		size?: number;
		/** Seconds per lap. */
		duration?: number;
		borderWidth?: number;
		anchor?: number;
		colorFrom?: string;
		colorTo?: string;
		/** Seconds before the first lap. */
		delay?: number;
	}

	let {
		class: className = '',
		size = 200,
		duration = 15,
		anchor = 90,
		borderWidth = 1.5,
		colorFrom = 'var(--beam-from)',
		colorTo = 'var(--beam-to)',
		delay = 0
	}: Props = $props();
</script>

<div
	aria-hidden="true"
	class={cn('border-beam pointer-events-none absolute inset-0 rounded-[inherit]', className)}
	style:--size={size}
	style:--duration={duration}
	style:--anchor={anchor}
	style:--border-width={borderWidth}
	style:--color-from={colorFrom}
	style:--color-to={colorTo}
	style:--delay={delay}
></div>

<style>
	.border-beam {
		border: calc(var(--border-width) * 1px) solid transparent;
		mask:
			linear-gradient(#000 0 0) padding-box,
			linear-gradient(#000 0 0);
		mask-composite: exclude;
	}
	.border-beam::after {
		content: '';
		position: absolute;
		aspect-ratio: 1;
		width: calc(var(--size) * 1px);
		background: linear-gradient(to left, var(--color-from), var(--color-to), transparent);
		offset-anchor: calc(var(--anchor) * 1%) 50%;
		offset-path: rect(0 auto auto 0 round calc(var(--size) * 1px));
		animation: border-beam calc(var(--duration) * 1s) infinite linear;
		animation-delay: calc(var(--delay) * 1s);
	}
	@keyframes border-beam {
		100% {
			offset-distance: 100%;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.border-beam {
			display: none;
		}
	}
</style>
