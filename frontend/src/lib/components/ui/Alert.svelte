<!--
	Svelte port of VengeanceUI Alert, AlertTitle and AlertDescription (MIT,
	github.com/Ashutoshx7/VengeanceUI). Lotcouncil adds a warning variant.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from './utils.js';

	interface Props {
		variant?: 'default' | 'destructive' | 'warning';
		title?: string;
		/** An icon in the left column. */
		icon?: Snippet;
		children?: Snippet;
		/** `alert` interrupts screen readers; use `note` for something that is just worth knowing. */
		role?: 'alert' | 'note' | 'status';
		class?: string;
	}

	let { variant = 'default', title, icon, children, role = 'alert', class: className = '' }: Props = $props();

	const VARIANTS = {
		default: 'bg-card text-card-foreground',
		destructive: 'border-danger/30 bg-card text-destructive *:data-[slot=alert-description]:text-danger-foreground',
		warning: 'border-warning/40 bg-warning-muted text-warning-foreground *:data-[slot=alert-description]:text-warning-foreground'
	};
</script>

<div
	data-slot="alert"
	{role}
	class={cn(
		'relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
		VARIANTS[variant],
		className
	)}
>
	{@render icon?.()}
	{#if title}
		<p data-slot="alert-title" class="col-start-2 m-0 min-h-4 font-medium tracking-tight">{title}</p>
	{/if}
	{#if children}
		<div data-slot="alert-description" class="col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:m-0 [&_p]:leading-relaxed">
			{@render children()}
		</div>
	{/if}
</div>
