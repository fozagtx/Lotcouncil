<!-- Svelte port of VengeanceUI CardContent (MIT, github.com/Ashutoshx7/VengeanceUI). -->
<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from './utils.js';

	let { class: className, children, ...rest }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<div data-slot="card-content" class={cn('px-5 pb-5 sm:px-6 sm:pb-6', className as string)} {...rest}>
	{@render children?.()}
</div>
