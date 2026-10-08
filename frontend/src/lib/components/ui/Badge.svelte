<!--
	Svelte port of VengeanceUI Badge (MIT, github.com/Ashutoshx7/VengeanceUI).
	Lotcouncil adds soft status variants and an optional status dot.
-->
<script lang="ts" module>
	export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'danger' | 'info' | 'warning';
	export type DotTone = 'success' | 'danger' | 'info' | 'warning' | 'neutral' | 'brand';
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from './utils.js';

	interface Props extends HTMLAttributes<HTMLSpanElement> {
		variant?: BadgeVariant;
		/** A small coloured status dot before the text. */
		dot?: DotTone;
		/** Pulse the dot (something in progress). */
		live?: boolean;
	}

	let { variant = 'default', dot, live = false, class: className, children, ...rest }: Props = $props();

	const VARIANTS: Record<BadgeVariant, string> = {
		default: 'border-transparent bg-primary text-primary-foreground',
		secondary: 'border-transparent bg-secondary text-secondary-foreground',
		destructive: 'border-transparent bg-destructive text-white dark:bg-destructive/60',
		outline: 'text-foreground',
		success: 'border-transparent bg-success-muted text-success-foreground',
		danger: 'border-transparent bg-danger-muted text-danger-foreground',
		info: 'border-transparent bg-info-muted text-info-foreground',
		warning: 'border-transparent bg-warning-muted text-warning-foreground'
	};

	const DOTS: Record<DotTone, string> = {
		success: 'bg-success',
		danger: 'bg-danger',
		info: 'bg-info',
		warning: 'bg-warning',
		neutral: 'bg-neutral-mark',
		brand: 'bg-brand'
	};
</script>

<span
	data-slot="badge"
	class={cn(
		'inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] [&>svg]:pointer-events-none [&>svg]:size-3',
		VARIANTS[variant],
		className as string
	)}
	{...rest}
>
	{#if dot}
		<span class="relative flex size-1.5 shrink-0" aria-hidden="true">
			{#if live}<span class="absolute inline-flex size-full rounded-full opacity-75 motion-safe:animate-ping {DOTS[dot]}"></span>{/if}
			<span class="relative inline-flex size-1.5 rounded-full {DOTS[dot]}"></span>
		</span>
	{/if}
	{@render children?.()}
</span>
