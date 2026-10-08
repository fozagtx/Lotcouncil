<!-- Svelte port of VengeanceUI CardTitle (MIT, github.com/Ashutoshx7/VengeanceUI). -->
<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from './utils.js';

	interface Props extends HTMLAttributes<HTMLHeadingElement> {
		level?: 2 | 3;
	}

	let { level = 2, class: className, children, ...rest }: Props = $props();
</script>

<svelte:element
	this={`h${level}`}
	data-slot="card-title"
	class={cn('m-0 text-base leading-none font-semibold tracking-tight', className as string)}
	{...rest}
>
	{@render children?.()}
</svelte:element>
