<!-- Svelte port of VengeanceUI CardDescription (MIT, github.com/Ashutoshx7/VengeanceUI). -->
<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from './utils.js';

	let { class: className, children, ...rest }: HTMLAttributes<HTMLParagraphElement> = $props();
</script>

<p data-slot="card-description" class={cn('m-0 text-sm text-muted-foreground', className as string)} {...rest}>
	{@render children?.()}
</p>
