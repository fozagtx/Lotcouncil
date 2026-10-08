<!-- Svelte port of VengeanceUI CardFooter (MIT, github.com/Ashutoshx7/VengeanceUI). -->
<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from './utils.js';

	let { class: className, children, ...rest }: HTMLAttributes<HTMLElement> = $props();
</script>

<footer data-slot="card-footer" class={cn('flex items-center px-5 pb-5 sm:px-6 sm:pb-6', className as string)} {...rest}>
	{@render children?.()}
</footer>
