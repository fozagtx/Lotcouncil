<!-- Svelte port of VengeanceUI Skeleton (MIT, github.com/Ashutoshx7/VengeanceUI). -->
<script lang="ts">
	import { cn } from './utils.js';

	let { class: className = '' }: { class?: string } = $props();
</script>

<div data-slot="skeleton" aria-hidden="true" class={cn('rounded-md bg-accent motion-safe:animate-pulse', className)}></div>
