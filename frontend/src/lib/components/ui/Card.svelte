<!-- Svelte port of VengeanceUI Card (MIT, github.com/Ashutoshx7/VengeanceUI). -->
<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from './utils.js';

	interface Props extends HTMLAttributes<HTMLElement> {
		/** Render as a landmark-friendly element; defaults to a section. */
		as?: 'section' | 'div' | 'article' | 'aside';
	}

	let { as = 'section', class: className, children, ...rest }: Props = $props();
</script>

<svelte:element
	this={as}
	data-slot="card"
	class={cn('min-w-0 rounded-xl border bg-card text-card-foreground shadow-sm', className as string)}
	{...rest}
>
	{@render children?.()}
</svelte:element>
