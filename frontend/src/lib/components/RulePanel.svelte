<script lang="ts">
	import { tick } from 'svelte';
	import { RULE_FIELDS, RULE_LABELS, ruleErrors, toRule } from '#lib/rules.js';
	import type { Reading, Rule, RuleType } from '#lib/types.js';

	interface Props {
		reading: Reading;
		ruleText: string;
		showNotice: boolean;
		open: boolean;
		onrun: (rule: Rule) => void;
	}

	let { reading, ruleText, showNotice, open = $bindable(), onrun }: Props = $props();

	let type: RuleType = $state('ma_cross');
	let values: Record<string, string> = $state({});
	let errors: Record<string, string> = $state({});
	let inputs: HTMLInputElement[] = $state([]);

	// Reset the editor whenever the court reads a new rule.
	$effect(() => {
		type = reading.rule.type;
		values = Object.fromEntries(RULE_FIELDS[reading.rule.type].map((f) => [f.key, String(reading.rule[f.key] ?? f.initial)]));
		errors = {};
	});

	function changeType() {
		values = Object.fromEntries(RULE_FIELDS[type].map((f) => [f.key, String(f.initial)]));
		errors = {};
	}

	async function toggle() {
		open = !open;
		if (open) {
			await tick();
			inputs[0]?.focus();
		}
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		errors = ruleErrors(type, values);
		const bad = Object.keys(errors)[0];
		if (bad) {
			document.getElementById(`rule-${bad}`)?.focus();
			return;
		}
		onrun(toRule(type, values));
	}

	const SOURCE: Record<Reading['source'], string> = { ai: 'Read by AI', keywords: 'Keyword reader', user: 'Your numbers' };
</script>

<section class="card grid gap-2.5 px-4 py-3" aria-label="How the court read your idea">
	<div class="flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5">
		<span class="field-label">Read as</span>
		<p class="m-0 min-w-0 flex-[1_1_240px] text-[14.5px]">{ruleText || reading.rule_text}</p>
		<span class="tag">{SOURCE[reading.source]}</span>
		<button
			type="button"
			class="link-btn min-h-10 text-sm font-semibold text-link underline underline-offset-3"
			aria-expanded={open}
			aria-controls="rule-form"
			onclick={toggle}
		>
			{open ? 'Hide numbers' : 'Edit numbers'}
		</button>
	</div>

	{#if open}
		<form id="rule-form" class="grid gap-3" onsubmit={submit} novalidate>
			<div class="flex flex-wrap items-start gap-3">
				<div class="grid gap-1">
					<label for="rule-type" class="field-label">Rule</label>
					<select id="rule-type" class="select w-auto" bind:value={type} onchange={changeType}>
						{#each Object.entries(RULE_LABELS) as [value, label] (value)}
							<option {value}>{label}</option>
						{/each}
					</select>
				</div>
				{#each RULE_FIELDS[type] as field, i (field.key)}
					<div class="grid gap-1">
						<label for="rule-{field.key}" class="field-label">{field.label}</label>
						<div
							class="flex min-h-10 items-center gap-1.5 rounded-control border bg-input px-2.5 focus-within:outline-2 focus-within:outline-ring
								{errors[field.key] ? 'border-danger' : 'border-border'}"
						>
							<input
								id="rule-{field.key}"
								bind:this={inputs[i]}
								bind:value={values[field.key]}
								type="text"
								inputmode={field.unit === '%' ? 'decimal' : 'numeric'}
								autocomplete="off"
								spellcheck="false"
								aria-invalid={errors[field.key] ? 'true' : undefined}
								aria-describedby={errors[field.key] ? `rule-${field.key}-error` : undefined}
								class="w-16 border-0 bg-transparent py-1 text-right text-[15px] font-semibold tabular-nums outline-none"
							/>
							<span class="text-[13px] text-muted-foreground">{field.unit === 'h' ? 'hours' : '%'}</span>
						</div>
						{#if errors[field.key]}
							<p id="rule-{field.key}-error" class="m-0 text-xs text-danger-foreground">{errors[field.key]}</p>
						{/if}
					</div>
				{/each}
			</div>
			<div>
				<button type="submit" class="btn btn-secondary">Run these numbers</button>
			</div>
		</form>
	{/if}

	{#if showNotice && reading.notice}
		<p class="notice m-0">{reading.notice}</p>
	{/if}
</section>
