<script lang="ts" module>
	export type Tone = 'success' | 'danger' | 'info' | 'warning' | 'neutral' | 'brand';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		tone?: Tone;
		/** Show a small status dot before the text. */
		dot?: boolean;
		/** Pulse the dot (for something in progress). */
		live?: boolean;
		class?: string;
		children: Snippet;
	}

	let { tone = 'neutral', dot = false, live = false, class: className = '', children }: Props = $props();

	const TONES: Record<Tone, string> = {
		success: 'bg-success-muted text-success-foreground',
		danger: 'bg-danger-muted text-danger-foreground',
		info: 'bg-info-muted text-info-foreground',
		warning: 'bg-warning-muted text-warning-foreground',
		neutral: 'bg-muted text-subtle',
		brand: 'bg-brand-wash text-primary'
	};
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-md px-2 py-[3px] text-[11px] leading-none font-bold tracking-[0.06em] whitespace-nowrap uppercase {TONES[
		tone
	]} {className}"
>
	{#if dot}
		<span class="size-1.5 rounded-full bg-current {live ? 'motion-safe:animate-pulse' : ''}" aria-hidden="true"></span>
	{/if}
	{@render children()}
</span>
