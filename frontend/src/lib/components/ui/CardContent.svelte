<!-- Svelte port of VengeanceUI CardContent (MIT, github.com/Ashutoshx7/VengeanceUI). -->
<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from './utils.js';

	let { class: className, children, ...rest }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<div data-slot="card-content" class={cn('px-4 pb-4', className as string)} {...rest}>
	{@render children?.()}
</div>
