import { useEffect, useRef, useState } from 'react';
import { RULE_FIELDS, RULE_LABELS, ruleErrors, toRule } from '@/lib/rules';
import type { Reading, Rule, RuleType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
	reading: Reading | null;
	ruleText: string;
	showNotice: boolean;
	running: boolean;
	onrun: (rule: Rule) => void;
}

const SOURCE: Record<Reading['source'], string> = { ai: 'Read by AI', keywords: 'Keyword reader', user: 'Your numbers' };

export function RulePanel({ reading, ruleText, showNotice, running, onrun }: Props) {
	const [type, setType] = useState<RuleType>('ma_cross');
	const [values, setValues] = useState<Record<string, string>>({});
	const [errors, setErrors] = useState<Record<string, string>>({});
	const inputs = useRef<(HTMLInputElement | null)[]>([]);

	// Reset the editor whenever the court reads a new rule.
	useEffect(() => {
		if (!reading) return;
		setType(reading.rule.type);
		setValues(Object.fromEntries(RULE_FIELDS[reading.rule.type].map((f) => [f.key, String(reading.rule[f.key] ?? f.initial)])));
		setErrors({});
	}, [reading]);

	function changeType(next: string) {
		const t = next as RuleType;
		setType(t);
		setValues(Object.fromEntries(RULE_FIELDS[t].map((f) => [f.key, String(f.initial)])));
		setErrors({});
		inputs.current[0]?.focus();
	}

	function submit(e: React.FormEvent) {
		e.preventDefault();
		const errs = ruleErrors(type, values);
		setErrors(errs);
		const bad = Object.keys(errs)[0];
		if (bad) {
			document.getElementById(`rule-${bad}`)?.focus();
			return;
		}
		onrun(toRule(type, values));
	}

	return (
		<div className="grid gap-4 p-4">
			{reading && (
				<div className="grid gap-1.5">
					<div className="flex flex-wrap items-center gap-2">
						<span className="eyebrow">The court read your idea as</span>
						<span className="inline-flex h-5 items-center rounded-md bg-info-muted px-2 text-xs font-medium text-info-foreground">{SOURCE[reading.source]}</span>
					</div>
					<p className="m-0 text-[15px] leading-snug">{ruleText || reading.rule_text}</p>
					{showNotice && reading.notice && <p className="m-0 text-[13px] text-muted-foreground">{reading.notice}</p>}
				</div>
			)}

			<form id="rule-form" className="grid gap-3 rounded-lg border border-border bg-muted/50 p-3.5" onSubmit={submit} noValidate>
				<p className="m-0 text-[13px] text-subtle">Change the numbers and run again. The verdict always comes from the same fixed tests.</p>
				<div className="flex flex-wrap items-start gap-3">
					<div className="grid gap-1.5">
						<label htmlFor="rule-type" className="eyebrow">
							Rule
						</label>
						<Select value={type} onValueChange={changeType}>
							<SelectTrigger size="sm" id="rule-type" className="w-auto min-w-[150px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Object.entries(RULE_LABELS).map(([value, label]) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					{RULE_FIELDS[type].map((field, i) => (
						<div key={field.key} className="grid gap-1.5">
							<label htmlFor={`rule-${field.key}`} className="eyebrow">
								{field.label}
							</label>
							<div
								className={cn(
									'flex min-h-9 items-center gap-1.5 rounded-md border bg-background px-2.5 focus-within:outline-2 focus-within:outline-ring',
									errors[field.key] ? 'border-destructive' : 'border-border-strong'
								)}
							>
								<input
									id={`rule-${field.key}`}
									ref={(el) => {
										inputs.current[i] = el;
									}}
									value={values[field.key] ?? ''}
									onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
									type="text"
									inputMode={field.unit === '%' ? 'decimal' : 'numeric'}
									autoComplete="off"
									spellCheck={false}
									aria-invalid={errors[field.key] ? true : undefined}
									aria-describedby={errors[field.key] ? `rule-${field.key}-error` : undefined}
									className="num w-16 border-0 bg-transparent py-1 text-right text-[15px] font-semibold outline-none"
								/>
								<span className="text-[13px] text-muted-foreground">{field.unit === 'h' ? 'hours' : '%'}</span>
							</div>
							{errors[field.key] && (
								<p id={`rule-${field.key}-error`} className="m-0 text-xs text-danger-foreground">
									{errors[field.key]}
								</p>
							)}
						</div>
					))}
				</div>
				<div>
					<Button type="submit" size="sm" disabled={running} aria-busy={running}>
						Run these numbers
					</Button>
				</div>
			</form>
		</div>
	);
}
