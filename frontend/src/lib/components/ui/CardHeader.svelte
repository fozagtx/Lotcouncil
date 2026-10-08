<!-- Svelte port of VengeanceUI CardHeader (MIT, github.com/Ashutoshx7/VengeanceUI). -->
<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from './utils.js';

	interface Props extends HTMLAttributes<HTMLElement> {
		/** Controls shown at the right end of the header. */
		action?: import('svelte').Snippet;
	}

	let { class: className, children, action, ...rest }: Props = $props();
</script>

<header
	data-slot="card-header"
	class={cn('flex flex-wrap items-start justify-between gap-x-4 gap-y-2 p-5 sm:p-6', className as string)}
	{...rest}
>
	<div class="flex min-w-[min(100%,15rem)] flex-1 flex-col gap-1.5">{@render children?.()}</div>
	{#if action}<div class="flex max-w-full min-w-0 flex-wrap items-center gap-2">{@render action()}</div>{/if}
</header>
