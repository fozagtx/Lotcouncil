<script lang="ts">
	import { STEPS, type StepKey, type StepState } from '#lib/court.svelte.js';

	let { steps }: { steps: Record<StepKey, StepState> } = $props();

	const STATE_TEXT: Record<StepState, string> = {
		'': 'waiting',
		active: 'running',
		done: 'passed',
		failed: 'failed',
		skipped: 'skipped'
	};
	const DOT: Record<StepState, string> = {
		'': 'bg-border',
		active: 'bg-chart-1 motion-safe:animate-pulse',
		done: 'bg-success',
		failed: 'bg-danger',
		skipped: 'bg-border'
	};
</script>

<ol class="m-0 flex list-none flex-wrap gap-1 p-0 sm:gap-1.5" aria-label="Court progress">
	{#each STEPS as step (step.key)}
		{@const state = steps[step.key]}
		<li
			class="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-xs sm:gap-1.5 sm:px-2.5
				{state ? 'text-foreground' : 'text-muted-foreground'} {state === 'skipped' ? 'line-through' : ''}"
		>
			<span class="size-1.5 rounded-full {DOT[state]}" aria-hidden="true"></span>
			<span class="sm:hidden">{step.short}</span><span class="hidden sm:inline">{step.label}</span>
			<span class="sr-only">: {STATE_TEXT[state]}</span>
		</li>
	{/each}
</ol>
