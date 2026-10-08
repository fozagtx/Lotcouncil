<!-- Svelte port of VengeanceUI Kbd (MIT, github.com/Ashutoshx7/VengeanceUI). -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from './utils.js';

	let { class: className = '', children }: { class?: string; children: Snippet } = $props();
</script>

<kbd
	data-slot="kbd"
	class={cn(
		'pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm bg-muted px-1 font-sans text-xs font-medium text-muted-foreground select-none [&_svg:not([class*=size-])]:size-3',
		className
	)}
>
	{@render children()}
</kbd>
