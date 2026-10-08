<!--
	Svelte port of VengeanceUI RadialGlowButton (MIT, github.com/Ashutoshx7/VengeanceUI): a deep
	radial-gradient button whose light shifts and shines on hover.
-->
<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { cn } from './utils.js';

	let { class: className, type = 'button', children, ...rest }: HTMLButtonAttributes = $props();
</script>

<button {type} class={cn('rg-button', className as string)} {...rest}>
	<span class="rg-shine" aria-hidden="true"><span></span></span>
	<span class="rg-bg" aria-hidden="true"></span>
	<span class="rg-label">{@render children?.()}</span>
</button>

<style>
	@property --rg-pos-x {
		syntax: '<percentage>';
		initial-value: 40%;
		inherits: false;
	}
	@property --rg-pos-y {
		syntax: '<percentage>';
		initial-value: 140%;
		inherits: false;
	}
	@property --rg-spread-x {
		syntax: '<percentage>';
		initial-value: 130%;
		inherits: false;
	}
	@property --rg-spread-y {
		syntax: '<percentage>';
		initial-value: 170%;
		inherits: false;
	}
	@property --rg-color-1 {
		syntax: '<color>';
		initial-value: #000022;
		inherits: false;
	}
	@property --rg-color-2 {
		syntax: '<color>';
		initial-value: #1f3f6d;
		inherits: false;
	}
	@property --rg-color-3 {
		syntax: '<color>';
		initial-value: #469396;
		inherits: false;
	}
	@property --rg-color-4 {
		syntax: '<color>';
		initial-value: #f1ffa5;
		inherits: false;
	}
	@property --rg-color-5 {
		syntax: '<color>';
		initial-value: hsl(250 80% 2.5%);
		inherits: false;
	}
	@property --rg-border-angle {
		syntax: '<angle>';
		initial-value: 180deg;
		inherits: true;
	}
	@property --rg-border-color-1 {
		syntax: '<color>';
		initial-value: hsla(230, 75%, 90%, 0.7);
		inherits: true;
	}
	@property --rg-border-color-2 {
		syntax: '<color>';
		initial-value: hsla(230, 50%, 90%, 0.25);
		inherits: true;
	}
	@property --rg-stop-1 {
		syntax: '<percentage>';
		initial-value: 37.35%;
		inherits: false;
	}
	@property --rg-stop-2 {
		syntax: '<percentage>';
		initial-value: 61.36%;
		inherits: false;
	}
	@property --rg-stop-3 {
		syntax: '<percentage>';
		initial-value: 78.42%;
		inherits: false;
	}
	@property --rg-stop-4 {
		syntax: '<percentage>';
		initial-value: 93.52%;
		inherits: false;
	}
	@property --rg-stop-5 {
		syntax: '<percentage>';
		initial-value: 100%;
		inherits: false;
	}

	.rg-button {
		--transition: 0.25s;
		--speed: 1.2s;
		--cut: 1px;
		--bg: radial-gradient(
			var(--rg-spread-x) var(--rg-spread-y) at var(--rg-pos-x) var(--rg-pos-y),
			var(--rg-color-1) var(--rg-stop-1),
			var(--rg-color-2) var(--rg-stop-2),
			var(--rg-color-3) var(--rg-stop-3),
			var(--rg-color-4) var(--rg-stop-4),
			var(--rg-color-5) var(--rg-stop-5)
		);
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 140px;
		min-height: 40px;
		padding: 10px 16px;
		border: none;
		border-radius: 8px;
		font-family: inherit;
		font-size: 14px;
		font-weight: 500;
		line-height: 18px;
		color: rgb(255 255 255 / 0.95);
		background: var(--bg);
		text-shadow: 0 0 2px rgb(0 0 0 / 0.95);
		overflow: hidden;
		-webkit-font-smoothing: antialiased;
		-webkit-tap-highlight-color: transparent;
		transition:
			--rg-pos-x 0.75s,
			--rg-pos-y 0.75s,
			--rg-spread-x 0.75s,
			--rg-spread-y 0.75s,
			--rg-color-1 0.75s,
			--rg-color-2 0.75s,
			--rg-color-3 0.75s,
			--rg-color-4 0.75s,
			--rg-color-5 0.75s,
			--rg-border-angle 0.75s,
			--rg-border-color-1 0.75s,
			--rg-border-color-2 0.75s,
			--rg-stop-1 0.75s,
			--rg-stop-2 0.75s,
			--rg-stop-3 0.75s,
			--rg-stop-4 0.75s,
			--rg-stop-5 0.75s;
	}
	.rg-button::before {
		content: '';
		position: absolute;
		inset: 0;
		padding: 1px;
		border-radius: inherit;
		background-image: linear-gradient(var(--rg-border-angle), var(--rg-border-color-1), var(--rg-border-color-2));
		mask:
			linear-gradient(#fff 0 0) content-box,
			linear-gradient(#fff 0 0);
		mask-composite: exclude;
		pointer-events: none;
	}
	.rg-button:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}
	.rg-button[aria-busy='true'] {
		cursor: progress;
	}
	@media (hover: hover) {
		.rg-button:hover:not(:disabled) {
			--rg-pos-x: 0%;
			--rg-pos-y: 120%;
			--rg-spread-x: 110.24%;
			--rg-spread-y: 110.2%;
			--rg-color-1: #000020;
			--rg-color-2: #f1ffa5;
			--rg-color-3: #469396;
			--rg-color-4: #1f3f6d;
			--rg-stop-1: 0%;
			--rg-stop-2: 10%;
			--rg-stop-3: 35.44%;
			--rg-stop-4: 71.34%;
			--rg-stop-5: 150%;
			--rg-border-angle: 190deg;
			--rg-border-color-1: hsla(320, 75%, 90%, 0.1);
			--rg-border-color-2: hsla(320, 50%, 90%, 0.35);
			--button-line-opacity: 1;
		}
	}
	.rg-label {
		position: relative;
		z-index: 1;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}
	.rg-bg {
		position: absolute;
		inset: var(--cut);
		background: var(--bg);
		border-radius: inherit;
		transition:
			background var(--transition),
			opacity var(--transition);
	}
	.rg-shine {
		position: absolute;
		inset: 0;
		container-type: size;
		border-radius: inherit;
		mix-blend-mode: soft-light;
		opacity: var(--button-line-opacity, 0);
		transition: opacity 0.3s;
		overflow: visible;
	}
	.rg-shine span {
		position: absolute;
		inset: 0;
		height: 100cqh;
		aspect-ratio: 1;
		animation: rg-slide var(--speed) ease-in-out infinite alternate;
		overflow: visible;
	}
	.rg-shine span::before {
		content: '';
		position: absolute;
		inset: -100%;
		background: conic-gradient(from calc(270deg - (90deg * 0.5)), transparent 0, #fff 90deg, transparent 90deg);
		animation: rg-spin calc(var(--speed) * 2) infinite linear;
	}
	@keyframes rg-spin {
		0% {
			rotate: 0deg;
		}
		15%,
		35% {
			rotate: 90deg;
		}
		65%,
		85% {
			rotate: 270deg;
		}
		100% {
			rotate: 360deg;
		}
	}
	@keyframes rg-slide {
		to {
			transform: translate(calc(100cqw - 100%), 0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.rg-button {
			transition: none;
		}
		.rg-shine {
			display: none;
		}
	}
</style>
