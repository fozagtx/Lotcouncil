<!-- Svelte port of VengeanceUI CopyButton (MIT, github.com/Ashutoshx7/VengeanceUI). -->
<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import { cn } from './utils.js';

	interface Props {
		/** The text to copy, or a function that returns it at click time. */
		text: string | (() => string);
		/** What is being copied, for screen readers ("Copy the data fingerprint"). */
		label?: string;
		class?: string;
		/** Called after a copy attempt; `ok` is false when the clipboard refused. */
		oncopy?: (ok: boolean, text: string) => void;
	}

	let { text, label = 'Copy', class: className = '', oncopy }: Props = $props();
	let copied = $state(false);

	$effect(() => {
		if (!copied) return;
		const timeout = setTimeout(() => (copied = false), 2000);
		return () => clearTimeout(timeout);
	});

	async function copy() {
		const value = typeof text === 'function' ? text() : text;
		try {
			await navigator.clipboard.writeText(value);
			copied = true;
			oncopy?.(true, value);
		} catch {
			oncopy?.(false, value);
		}
	}
</script>

<button
	type="button"
	class={cn(
		'relative z-10 inline-flex size-7 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
		className
	)}
	aria-label={copied ? 'Copied' : label}
	onclick={copy}
>
	{#if copied}
		<Check class="size-3.5 text-success-foreground" />
	{:else}
		<Copy class="size-3.5" />
	{/if}
</button>
