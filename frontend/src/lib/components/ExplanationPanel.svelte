<script lang="ts">
	import type { Explanation } from '#lib/types.js';

	interface Props {
		explanation: Explanation | null;
		/** Per-run AI notices are shown only when the AI is on; the footer covers "AI is off". */
		showNotice: boolean;
	}

	let { explanation, showNotice }: Props = $props();
</script>

<section class="card p-4" aria-labelledby="explain-title" aria-busy={!explanation}>
	<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
		<h2 id="explain-title" class="m-0 text-[15px] font-semibold">In plain words</h2>
		{#if explanation}
			<span class="tag">{explanation.source === 'ai' ? 'Written by AI from the court’s numbers' : 'Built-in summary'}</span>
		{/if}
	</div>
	{#if explanation}
		<p class="m-0 mb-2.5 max-w-prose text-[16.5px] leading-relaxed">{explanation.text}</p>
		{#if showNotice && explanation.notice}
			<p class="notice m-0">{explanation.notice}</p>
		{/if}
	{:else}
		<div class="grid gap-2" aria-hidden="true">
			<div class="skeleton h-4 w-full"></div>
			<div class="skeleton h-4 w-11/12"></div>
			<div class="skeleton h-4 w-4/5"></div>
		</div>
	{/if}
	<p class="mt-2.5 mb-0 text-[12.5px] text-muted-foreground">
		The verdict comes from fixed code. The explanation is written from the court’s numbers and cannot change it.
	</p>
</section>
