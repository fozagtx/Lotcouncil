<!--
	Svelte port of VengeanceUI Empty, EmptyHeader, EmptyMedia (icon), EmptyTitle, EmptyDescription
	and EmptyContent (MIT, github.com/Ashutoshx7/VengeanceUI), as one component.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from './utils.js';

	interface Props {
		title: string;
		description?: string;
		/** An icon shown in a muted tile above the title. */
		media?: Snippet;
		/** Actions under the text. */
		children?: Snippet;
		class?: string;
	}

	let { title, description, media, children, class: className = '' }: Props = $props();
</script>

<div
	data-slot="empty"
	class={cn('flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border-dashed p-6 text-center text-balance md:p-12', className)}
>
	<div class="flex max-w-sm flex-col items-center gap-2 text-center">
		{#if media}
			<div class="mb-2 flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg:not([class*=size-])]:size-6">
				{@render media()}
			</div>
		{/if}
		<p class="m-0 text-lg font-medium tracking-tight">{title}</p>
		{#if description}
			<p class="m-0 text-sm/relaxed text-muted-foreground">{description}</p>
		{/if}
	</div>
	{#if children}
		<div class="flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance">{@render children()}</div>
	{/if}
</div>
