<!-- Svelte port of VengeanceUI Spinner (MIT, github.com/Ashutoshx7/VengeanceUI). -->
<script lang="ts">
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { cn } from './utils.js';

	/** With a `label` the spinner announces itself; without one it is decorative (inside a labelled button). */
	let { class: className = '', label }: { class?: string; label?: string } = $props();
</script>

{#if label}
	<LoaderCircle role="status" aria-label={label} class={cn('size-4 animate-spin', className)} />
{:else}
	<LoaderCircle class={cn('size-4 animate-spin', className)} />
{/if}
