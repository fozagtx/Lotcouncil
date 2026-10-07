<script lang="ts">
	interface Option {
		value: number;
		label: string;
		description: string;
	}

	interface Props {
		options: Option[];
		value: number;
		labelledby: string;
		onchange?: (value: number) => void;
	}

	let { options, value = $bindable(), labelledby, onchange }: Props = $props();
	let buttons: HTMLButtonElement[] = $state([]);

	function select(i: number, focus = false) {
		value = options[i].value;
		onchange?.(value);
		if (focus) buttons[i]?.focus();
	}

	// Arrow keys move between options, as in any radio group; only the selected one is a tab stop.
	function onkeydown(e: KeyboardEvent, i: number) {
		const last = options.length - 1;
		const next =
			e.key === 'ArrowRight' || e.key === 'ArrowDown'
				? (i + 1) % options.length
				: e.key === 'ArrowLeft' || e.key === 'ArrowUp'
					? (i - 1 + options.length) % options.length
					: e.key === 'Home'
						? 0
						: e.key === 'End'
							? last
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
	class="grid gap-1 rounded-control border border-border bg-input p-1"
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
			class="seg-option min-h-10 rounded-[7px] text-sm text-subtle aria-checked:bg-card aria-checked:font-semibold aria-checked:text-foreground aria-checked:shadow-sm"
			onclick={() => select(i)}
			onkeydown={(e) => onkeydown(e, i)}
		>
			{option.label}
		</button>
	{/each}
</div>
