<!--
	VengeanceUI Tabs list styling (MIT, github.com/Ashutoshx7/VengeanceUI) on a radio group:
	the muted track with a raised active pill. Arrow keys move between options.
-->
<script lang="ts">
	import { cn } from './utils.js';

	interface Option {
		value: number | string;
		label: string;
		description: string;
	}

	interface Props {
		options: Option[];
		value: number | string;
		labelledby?: string;
		label?: string;
		disabled?: boolean;
		onchange?: (value: number | string) => void;
		class?: string;
	}

	let { options, value = $bindable(), labelledby, label, disabled = false, onchange, class: className = '' }: Props = $props();
	let buttons: HTMLButtonElement[] = $state([]);

	function select(i: number, focus = false) {
		if (disabled) return;
		const changed = options[i].value !== value;
		value = options[i].value;
		if (changed) onchange?.(value);
		if (focus) buttons[i]?.focus();
	}

	function onkeydown(e: KeyboardEvent, i: number) {
		const n = options.length;
		const next =
			e.key === 'ArrowRight' || e.key === 'ArrowDown'
				? (i + 1) % n
				: e.key === 'ArrowLeft' || e.key === 'ArrowUp'
					? (i - 1 + n) % n
					: e.key === 'Home'
						? 0
						: e.key === 'End'
							? n - 1
							: -1;
		if (next >= 0) {
			e.preventDefault();
			select(next, true);
		}
	}
</script>

<div
	role="radiogroup"
	aria-labelledby={labelledby}
	aria-label={label}
	aria-disabled={disabled || undefined}
	class={cn('inline-flex h-10 w-fit shrink-0 items-center justify-center gap-0.5 rounded-lg bg-muted p-1 text-muted-foreground', className)}
>
	{#each options as option, i (option.value)}
		{@const active = option.value === value}
		<button
			type="button"
			role="radio"
			bind:this={buttons[i]}
			aria-checked={active}
			aria-label={option.description}
			tabindex={active ? 0 : -1}
			{disabled}
			class={cn(
				'inline-flex h-full min-w-0 flex-1 items-center justify-center rounded-md px-3 text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
				active ? 'bg-card text-foreground shadow-sm dark:bg-zinc-700/80' : 'hover:text-foreground'
			)}
			onclick={() => select(i)}
			onkeydown={(e) => onkeydown(e, i)}
		>
			{option.label}
		</button>
	{/each}
</div>
