<script lang="ts">
	import { getAudit } from '#lib/api.js';
	import { downloadBlob, shareCard } from '#lib/card.js';
	import type { CourtSession, StepKey, StepState } from '#lib/court.svelte.js';
	import { feeLabel, fmtDate, int } from '#lib/format.js';
	import type { TestKey } from '#lib/types.js';
	import ErrorBox from './ErrorBox.svelte';
	import Icon from './Icon.svelte';
	import Alert from './ui/Alert.svelte';
	import Badge, { type BadgeVariant } from './ui/Badge.svelte';
	import BorderBeam from './ui/BorderBeam.svelte';
	import Button from './ui/Button.svelte';
	import Card from './ui/Card.svelte';
	import CardContent from './ui/CardContent.svelte';
	import CardDescription from './ui/CardDescription.svelte';
	import CardFooter from './ui/CardFooter.svelte';
	import CardHeader from './ui/CardHeader.svelte';
	import CardTitle from './ui/CardTitle.svelte';
	import CopyButton from './ui/CopyButton.svelte';
	import Skeleton from './ui/Skeleton.svelte';
	import Spinner from './ui/Spinner.svelte';

	interface Props {
		session: CourtSession;
		maxDays: number;
		onedit: () => void;
		onwiden: () => void;
		onexample: () => void;
		class?: string;
	}

	let { session, maxDays, onedit, onwiden, onexample, class: className = '' }: Props = $props();

	const result = $derived(session.result);
	const ruling = $derived(result?.ruling);
	const pass = $derived(ruling?.verdict === 'PASS');

	const caveat = $derived.by(() => {
		if (!ruling) return '';
		if (ruling.verdict === 'PASS') return 'Passed all three tests: not obviously luck on this history. It is not a prediction.';
		if (!ruling.gate.passed) {
			const made = ruling.gate.trades ? `it made ${ruling.gate.trades} trade${ruling.gate.trades === 1 ? '' : 's'}` : 'it never traded';
			return `Not judged: ${made}, and the court needs at least ${ruling.gate.min_trades}.`;
		}
		const failed = Object.values(ruling.tests).filter((t) => !t.passed).length;
		return `Failed ${failed} of 3 tests. An idea must pass all three.`;
	});

	const notes = $derived.by(() => {
		if (!result) return [];
		const out: string[] = [];
		if (result.market.source !== 'bitget') out.push(result.market.source_note);
		if (result.market.short_history)
			out.push(`Only ${result.market.days_available} days of history exist for ${result.market.label}, so all of it was used.`);
		return out;
	});

	type Mark = 'pass' | 'fail' | 'active' | 'skipped' | 'waiting';

	interface Step {
		key: StepKey;
		title: string;
		badge: { variant: BadgeVariant; text: string; live?: boolean };
		mark: Mark;
		detail: string;
		mono?: string;
		copy?: string;
	}

	const SOURCE_BADGE = { ai: 'AI', keywords: 'Keywords', user: 'Your numbers' } as const;
	const MARKET_BADGE = { bitget: 'Live', saved: 'Saved' } as const;

	function stateBadge(state: StepState, passed: boolean | undefined): Step['badge'] {
		if (state === 'active') return { variant: 'info', text: 'Running', live: true };
		if (state === 'skipped') return { variant: 'secondary', text: 'Skipped' };
		if (state === 'failed') return { variant: 'danger', text: 'Failed' };
		if (state === 'done') return passed === false ? { variant: 'danger', text: 'Failed' } : { variant: 'success', text: 'Passed' };
		return { variant: 'secondary', text: 'Waiting' };
	}

	function stateMark(state: StepState, passed: boolean | undefined): Mark {
		if (state === 'active') return 'active';
		if (state === 'skipped') return 'skipped';
		if (state === 'failed' || (state === 'done' && passed === false)) return 'fail';
		if (state === 'done') return 'pass';
		return 'waiting';
	}

	const steps = $derived.by((): Step[] => {
		const s = session.steps;
		const reading = session.reading;
		const m = result?.market;
		const tests = ruling?.tests;
		const testStep = (key: TestKey, title: string): Step => ({
			key,
			title,
			badge: stateBadge(s[key], tests?.[key]?.passed),
			mark: stateMark(s[key], tests?.[key]?.passed),
			detail: tests?.[key]?.sentence ?? (s[key] === 'skipped' ? 'Not run: too few trades to judge.' : session.markets?.tests[key].question ?? '')
		});
		return [
			{
				key: 'read',
				title: 'Rule read',
				badge:
					s.read === 'done' && reading
						? { variant: 'info', text: SOURCE_BADGE[reading.source] }
						: stateBadge(s.read, undefined),
				mark: stateMark(s.read, undefined),
				detail: ruling?.rule_text || reading?.rule_text || 'Turning the sentence into one of three rule types.'
			},
			{
				key: 'data',
				title: 'Prices loaded',
				badge:
					s.data === 'done' && m
						? { variant: m.source === 'bitget' ? 'success' : 'warning', text: MARKET_BADGE[m.source] }
						: stateBadge(s.data, undefined),
				mark: stateMark(s.data, undefined),
				detail: m
					? `${int(m.candles)} hourly candles, ${fmtDate(m.start / 1000)} to ${fmtDate(m.end / 1000)}.`
					: 'Finished hourly candles only.',
				mono: m ? `${m.hash.slice(0, 23)}…` : undefined,
				copy: m?.hash
			},
			{
				key: 'gate',
				title: 'Trade count',
				badge: stateBadge(s.gate, ruling?.gate.passed),
				mark: stateMark(s.gate, ruling?.gate.passed),
				detail: ruling?.gate.sentence ?? 'At least 10 trades are needed to judge.'
			},
			testStep('A', 'A · Unseen data'),
			testStep('B', 'B · Random timing'),
			testStep('C', 'C · Stress')
		];
	});

	// ----- actions -----
	let toast = $state('');
	let auditBusy = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	function say(message: string) {
		toast = message;
		clearTimeout(timer);
		timer = setTimeout(() => (toast = ''), 4000);
	}

	async function copyCard() {
		if (!session.result) return;
		const how = await shareCard(session.result);
		if (how === 'copied') say('Verdict card copied as an image.');
		else if (how === 'shared') say('Verdict card shared.');
		else if (how === 'downloaded') say('Verdict card saved as an image.');
	}

	let linkCopied = $state(false);
	$effect(() => {
		if (!linkCopied) return;
		const t = setTimeout(() => (linkCopied = false), 2000);
		return () => clearTimeout(t);
	});

	async function copyLink() {
		if (!session.result) return;
		const url = session.shareUrl();
		try {
			await navigator.clipboard.writeText(url);
			linkCopied = true;
			say('Link copied: it re-runs this exact ruling.');
		} catch {
			try {
				await navigator.share({ url, title: 'Lotcouncil ruling' });
			} catch {
				say(url);
			}
		}
	}

	async function exportAudit() {
		const r = session.result;
		if (!r) return;
		auditBusy = true;
		try {
			const blob = await getAudit({
				symbol: r.request.symbol,
				days: r.request.days,
				end: Math.floor(r.request.end / 1000),
				rule: r.request.rule,
				fee_pct: 100 * r.request.fee,
				idea: r.idea,
				parsed_by: r.request.parsed_by,
				explanation: session.explanation
			});
			downloadBlob(blob, `lotcouncil-${r.market.symbol.replace(/USDT$/, '')}-${r.ruling.verdict.toLowerCase()}.json`);
			say('Audit file saved. Anyone can re-run it.');
		} catch (e) {
			say(`The audit file couldn’t be made: ${(e as Error).message}`);
		} finally {
			auditBusy = false;
		}
	}
</script>

<Card class="relative flex flex-col {className}" aria-labelledby="ruling-title" aria-busy={session.running}>
	{#if session.running}<BorderBeam size={160} duration={4} />{/if}
	<CardHeader>
		<CardTitle id="ruling-title">Ruling</CardTitle>
		<CardDescription>
			{#if result}{result.market.label} · {result.market.days_available} days · fee {feeLabel(100 * result.request.fee)}{:else}Every step the court takes, as it happens.{/if}
		</CardDescription>
		{#snippet action()}
			{#if session.example && result}<Badge variant="secondary">Example</Badge>{/if}
		{/snippet}
	</CardHeader>

	<CardContent class="grid gap-3.5">
		{#if session.error}
			<ErrorBox failure={session.error} onretry={() => session.retry()} {onexample} />
		{:else if ruling && result}
			<div
				class="verdict-block relative rounded-lg border p-4 {pass ? 'border-success/30 bg-success-muted' : 'border-danger/30 bg-danger-muted'}"
			>
				<BorderBeam
					size={90}
					duration={8}
					borderWidth={1.5}
					colorFrom={pass ? '#4ade80' : '#fb7185'}
					colorTo={pass ? '#16a34a' : '#dc2626'}
				/>
				<div class="flex items-center gap-3">
					<span
						class="grid size-9 shrink-0 place-items-center rounded-full shadow-sm {pass ? 'bg-success text-white dark:text-zinc-950' : 'bg-danger text-white'}"
						aria-hidden="true"
					>
						<Icon name={pass ? 'check' : 'x'} class="size-5" />
					</span>
					<div>
						<p class="m-0 text-[11px] font-medium text-subtle">Verdict</p>
						<p
							class="m-0 font-display text-4xl leading-none font-semibold tracking-tighter {pass ? 'text-success-foreground' : 'text-danger-foreground'}"
							aria-label="Verdict: {ruling.verdict}"
							role="img"
						>
							{ruling.verdict}
						</p>
					</div>
				</div>
				<p id="verdict-headline" class="mt-3 mb-1 text-[15px] leading-snug font-medium">{ruling.headline}</p>
				<p class="m-0 text-[13px] text-subtle">{caveat}</p>
			</div>

			<blockquote
				class="m-0 truncate border-l-2 pl-3 text-sm leading-snug text-subtle italic"
				title={result.idea || ruling.rule_text}
			>
				“{result.idea || ruling.rule_text}”
			</blockquote>

			{#if notes.length}
				<Alert variant="warning" role="note">
					{#snippet icon()}<Icon name="alert" />{/snippet}
					<p>{notes.join(' ')}</p>
				</Alert>
			{/if}

			{#if !ruling.gate.passed}
				<div class="flex flex-wrap gap-2">
					{#if result.request.days < maxDays}
						<Button variant="outline" onclick={onwiden}>Try the {maxDays}-day window</Button>
					{/if}
					<Button variant="outline" onclick={onedit}>Edit the numbers</Button>
				</div>
			{/if}
		{:else if !session.started}
			<div class="grid gap-2 rounded-lg border border-dashed p-4">
				<p class="m-0 text-sm font-medium">No ruling yet</p>
				<p class="m-0 text-[13px] text-muted-foreground">
					Type an idea on the left and put it on trial. The verdict and every step land here.
				</p>
			</div>
		{:else}
			<div class="grid gap-3 rounded-lg border p-4" aria-hidden="true">
				<div class="flex items-center gap-3">
					<Skeleton class="size-9 rounded-full" />
					<div class="grid gap-2"><Skeleton class="h-3 w-14" /><Skeleton class="h-9 w-28" /></div>
				</div>
				<Skeleton class="h-4 w-4/5" />
				<Skeleton class="h-3.5 w-full" />
			</div>
		{/if}

		<div>
			<div class="mb-2 flex items-center justify-between gap-2">
				<h3 class="m-0 text-sm font-semibold tracking-tight">How the court ruled</h3>
				<span class="num text-xs text-muted-foreground">
					{session.elapsedMs !== null ? `Computed in ${int(session.elapsedMs)} ms` : session.running ? 'Running…' : ''}
				</span>
			</div>
			<ol class="m-0 grid list-none p-0">
				{#each steps as step, i (step.key)}
					<li class="relative flex gap-3 pb-2.5 last:pb-0">
						{#if i < steps.length - 1}
							<span class="absolute top-6 bottom-0 left-[11.5px] w-px bg-border" aria-hidden="true"></span>
						{/if}
						<span
							class="relative grid size-6 shrink-0 place-items-center rounded-full border
								{step.mark === 'pass'
								? 'border-transparent bg-success text-white dark:text-zinc-950'
								: step.mark === 'fail'
									? 'border-transparent bg-danger text-white'
									: step.mark === 'active'
										? 'border-info/40 bg-info-muted text-info-foreground'
										: 'bg-card text-muted-foreground'}"
							aria-hidden="true"
						>
							{#if step.mark === 'pass'}
								<Icon name="check" class="size-3.5" />
							{:else if step.mark === 'fail'}
								<Icon name="x" class="size-3.5" />
							{:else if step.mark === 'active'}
								<Spinner class="size-3.5" />
							{:else if step.mark === 'skipped'}
								<Icon name="dash" class="size-3.5" />
							{:else}
								<span class="size-1.5 rounded-full bg-neutral-mark"></span>
							{/if}
						</span>
						<div class="min-w-0 flex-1">
							<div class="flex items-start justify-between gap-2">
								<p class="m-0 text-sm font-medium">{step.title}</p>
								<Badge variant={step.badge.variant} dot={step.badge.live ? 'info' : undefined} live={step.badge.live}>{step.badge.text}</Badge>
							</div>
							<p class="m-0 mt-0.5 text-[13px] leading-snug text-muted-foreground">{step.detail}</p>
							{#if step.mono}
								<div class="mt-1.5 flex min-w-0 items-center gap-1.5">
									<code class="truncate font-mono text-xs text-muted-foreground">{step.mono}</code>
									{#if step.copy}
										<CopyButton
											text={step.copy}
											label="Copy the data fingerprint"
											class="size-6"
											oncopy={(ok) => ok && say('Data fingerprint copied.')}
										/>
									{/if}
								</div>
							{/if}
						</div>
					</li>
				{/each}
			</ol>
		</div>
	</CardContent>

	<CardFooter class="mt-auto grid gap-2 border-t pt-3.5">
		<div class="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
			<Button variant="outline" onclick={copyCard} disabled={!result}>
				<Icon name="image" />Verdict card
			</Button>
			<Button variant="outline" onclick={copyLink} disabled={!result}>
				<Icon name={linkCopied ? 'check' : 'link'} />Copy link
			</Button>
			<Button variant="outline" onclick={exportAudit} disabled={!result || auditBusy} aria-busy={auditBusy}>
				{#if auditBusy}<Spinner />{:else}<Icon name="file" />{/if}Export audit
			</Button>
		</div>
		<p class="m-0 min-h-5 text-[13px] break-all text-muted-foreground" role="status">{toast}</p>
	</CardFooter>
</Card>
