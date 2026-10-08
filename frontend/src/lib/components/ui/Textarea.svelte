<!-- Svelte port of VengeanceUI Textarea (MIT, github.com/Ashutoshx7/VengeanceUI). -->
<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import { cn } from './utils.js';

	interface Props extends HTMLTextareaAttributes {
		ref?: HTMLTextAreaElement | null;
	}

	let { value = $bindable(), ref = $bindable(null), class: className, ...rest }: Props = $props();
</script>

<textarea
	bind:this={ref}
	bind:value
	data-slot="textarea"
	class={cn(
		'flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:ring-destructive/40',
		className as string
	)}
	{...rest}
></textarea>
