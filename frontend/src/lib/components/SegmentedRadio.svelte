<script lang="ts">
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
	}

	let { options, value = $bindable(), labelledby, label, disabled = false, onchange }: Props = $props();
	let buttons: HTMLButtonElement[] = $state([]);

	function select(i: number, focus = false) {
		if (disabled) return;
		const changed = options[i].value !== value;
		value = options[i].value;
		if (changed) onchange?.(value);
		if (focus) buttons[i]?.focus();
	}

	// Arrow keys move between options, as in any radio group; only the selected one is a tab stop.
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
	class="inline-grid min-h-10 gap-1 rounded-control border border-border bg-muted p-1"
	style="grid-template-columns: repeat({options.length}, minmax(0, 1fr))"
>
	{#each options as option, i (option.value)}
		<button
			type="button"
			role="radio"
			bind:this={buttons[i]}
			aria-checked={option.value === value}
			aria-label={option.description}
			tabindex={option.value === value ? 0 : -1}
			{disabled}
			class="seg-option min-h-8 rounded-[6px] px-2.5 text-[13px] font-semibold text-muted-foreground aria-checked:bg-primary aria-checked:text-primary-foreground disabled:cursor-not-allowed"
			onclick={() => select(i)}
			onkeydown={(e) => onkeydown(e, i)}
		>
			{option.label}
		</button>
	{/each}
</div>
