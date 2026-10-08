<script lang="ts">
	import { tick } from 'svelte';
	import { RULE_FIELDS, RULE_LABELS, ruleErrors, toRule } from '#lib/rules.js';
	import type { Reading, Rule, RuleType } from '#lib/types.js';
	import Badge from './Badge.svelte';

	interface Props {
		reading: Reading | null;
		ruleText: string;
		showNotice: boolean;
		running: boolean;
		onrun: (rule: Rule) => void;
	}

	let { reading, ruleText, showNotice, running, onrun }: Props = $props();

	let type: RuleType = $state('ma_cross');
	let values: Record<string, string> = $state({});
	let errors: Record<string, string> = $state({});
	let inputs: HTMLInputElement[] = $state([]);

	// Reset the editor whenever the court reads a new rule.
	$effect(() => {
		if (!reading) return;
		type = reading.rule.type;
		values = Object.fromEntries(RULE_FIELDS[reading.rule.type].map((f) => [f.key, String(reading.rule[f.key] ?? f.initial)]));
		errors = {};
	});

	async function changeType() {
		values = Object.fromEntries(RULE_FIELDS[type].map((f) => [f.key, String(f.initial)]));
		errors = {};
		await tick();
		inputs[0]?.focus();
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

<div class="grid gap-4 p-4">
	{#if reading}
		<div class="grid gap-1.5">
			<div class="flex flex-wrap items-center gap-2">
				<span class="field-label">The court read your idea as</span>
				<Badge tone="info">{SOURCE[reading.source]}</Badge>
			</div>
			<p class="m-0 text-[15px] leading-snug">{ruleText || reading.rule_text}</p>
			{#if showNotice && reading.notice}
				<p class="m-0 text-[13px] text-muted-foreground">{reading.notice}</p>
			{/if}
		</div>
	{/if}

	<form id="rule-form" class="grid gap-3 rounded-lg border border-border bg-card-raised p-3.5" onsubmit={submit} novalidate>
		<p class="m-0 text-[13px] text-subtle">Change the numbers and run again. The verdict always comes from the same fixed tests.</p>
		<div class="flex flex-wrap items-start gap-3">
			<div class="grid gap-1.5">
				<label for="rule-type" class="field-label">Rule</label>
				<select id="rule-type" class="select w-auto min-w-[150px]" bind:value={type} onchange={changeType}>
					{#each Object.entries(RULE_LABELS) as [value, label] (value)}
						<option {value}>{label}</option>
					{/each}
				</select>
			</div>
			{#each RULE_FIELDS[type] as field, i (field.key)}
				<div class="grid gap-1.5">
					<label for="rule-{field.key}" class="field-label">{field.label}</label>
					<div
						class="flex min-h-10 items-center gap-1.5 rounded-control border bg-input px-2.5 focus-within:outline-2 focus-within:outline-ring
							{errors[field.key] ? 'border-danger' : 'border-border-strong'}"
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
							class="num w-16 border-0 bg-transparent py-1 text-right text-[15px] font-semibold outline-none"
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
			<button type="submit" class="btn btn-primary" disabled={running} aria-busy={running}>Run these numbers</button>
		</div>
	</form>
</div>
