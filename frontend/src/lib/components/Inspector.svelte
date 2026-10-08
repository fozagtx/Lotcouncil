<script lang="ts">
	import { getAudit } from '#lib/api.js';
	import { downloadBlob, shareCard } from '#lib/card.js';
	import type { CourtSession, StepKey, StepState } from '#lib/court.svelte.js';
	import { feeLabel, fmtDate, int } from '#lib/format.js';
	import type { TestKey } from '#lib/types.js';
	import Badge, { type Tone } from './Badge.svelte';
	import ErrorBox from './ErrorBox.svelte';
	import Icon from './Icon.svelte';

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

	interface Step {
		key: StepKey;
		title: string;
		badge: { tone: Tone; text: string; live?: boolean };
		detail: string;
		mono?: string;
	}

	const SOURCE_BADGE = { ai: 'AI', keywords: 'Keywords', user: 'Your numbers' } as const;
	const MARKET_BADGE = { bitget: 'Live', saved: 'Saved', practice: 'Practice' } as const;

	function stateBadge(state: StepState, passed: boolean | undefined): Step['badge'] {
		if (state === 'active') return { tone: 'info', text: 'Running', live: true };
		if (state === 'skipped') return { tone: 'neutral', text: 'Skipped' };
		if (state === 'failed') return { tone: 'danger', text: 'Failed' };
		if (state === 'done') return passed === false ? { tone: 'danger', text: 'Failed' } : { tone: 'success', text: 'Passed' };
		return { tone: 'neutral', text: 'Waiting' };
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
			detail: tests?.[key]?.sentence ?? (s[key] === 'skipped' ? 'Not run: too few trades to judge.' : session.markets?.tests[key].question ?? '')
		});
		return [
			{
				key: 'read',
				title: 'Rule read',
				badge:
					s.read === 'done' && reading
						? { tone: 'info', text: SOURCE_BADGE[reading.source] }
						: stateBadge(s.read, undefined),
				detail: ruling?.rule_text || reading?.rule_text || 'Turning the sentence into one of three rule types.'
			},
			{
				key: 'data',
				title: 'Prices loaded',
				badge: s.data === 'done' && m ? { tone: m.source === 'bitget' ? 'success' : 'warning', text: MARKET_BADGE[m.source] } : stateBadge(s.data, undefined),
				detail: m
					? `${int(m.candles)} hourly candles, ${fmtDate(m.start / 1000)} to ${fmtDate(m.end / 1000)}.`
					: 'Finished hourly candles only.',
				mono: m ? `${m.hash.slice(0, 23)}…` : undefined
			},
			{
				key: 'gate',
				title: 'Trade count',
				badge: stateBadge(s.gate, ruling?.gate.passed),
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

	async function copyLink() {
		if (!session.result) return;
		const url = session.shareUrl();
		try {
			await navigator.clipboard.writeText(url);
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

<section class="panel flex flex-col {className}" aria-labelledby="ruling-title" aria-busy={!result && !session.error}>
	<header class="panel-head">
		<h2 id="ruling-title" class="panel-title">Ruling</h2>
		{#if session.example && result}
			<Badge tone="neutral">Example</Badge>
		{/if}
	</header>

	<div class="grid gap-4 p-4">
		{#if session.error}
			<ErrorBox
				failure={session.error}
				onretry={() => session.retry()}
				{onexample}
			/>
		{:else if ruling && result}
			<div
				class="verdict-block rounded-lg border p-4 {pass ? 'border-success/35 bg-success-muted' : 'border-danger/35 bg-danger-muted'}"
			>
				<div class="flex items-center gap-3.5">
					<span
						class="mark grid size-12 shrink-0 place-items-center rounded-full text-white {pass ? 'bg-success' : 'bg-danger'}"
						aria-hidden="true"
					>
						<Icon name={pass ? 'check' : 'x'} class="size-6" />
					</span>
					<div>
						<p class="eyebrow m-0">Verdict</p>
						<p
							class="m-0 text-[44px] leading-none font-extrabold tracking-tight {pass ? 'text-success-foreground' : 'text-danger-foreground'}"
							aria-label="Verdict: {ruling.verdict}"
							role="img"
						>
							{ruling.verdict}
						</p>
					</div>
				</div>
				<p id="verdict-headline" class="mt-3 mb-1 text-[17px] leading-snug font-semibold">{ruling.headline}</p>
				<p class="m-0 text-[13.5px] text-subtle">{caveat}</p>
			</div>

			<div class="grid gap-1">
				<p class="m-0 text-[14.5px] break-words">“{result.idea || ruling.rule_text}”</p>
				<p class="m-0 text-xs text-muted-foreground">
					{result.market.label} · {result.market.days_available} days · fee {feeLabel(100 * result.request.fee)}
				</p>
			</div>

			{#if notes.length}
				<p class="m-0 flex gap-2 rounded-md bg-warning-muted px-3 py-2 text-[13px] text-warning-foreground">
					<Icon name="alert" class="mt-0.5 size-4 shrink-0" /><span>{notes.join(' ')}</span>
				</p>
			{/if}

			{#if !ruling.gate.passed}
				<div class="flex flex-wrap gap-2">
					{#if result.request.days < maxDays}
						<button type="button" class="btn btn-secondary" onclick={onwiden}>Try the {maxDays}-day window</button>
					{/if}
					<button type="button" class="btn btn-secondary" onclick={onedit}>Edit the numbers</button>
				</div>
			{/if}
		{:else}
			<div class="grid gap-3 rounded-lg border border-border p-4" aria-hidden="true">
				<div class="flex items-center gap-3.5">
					<div class="skeleton size-12 rounded-full"></div>
					<div class="grid gap-2"><div class="skeleton h-3 w-16"></div><div class="skeleton h-10 w-32"></div></div>
				</div>
				<div class="skeleton h-4 w-4/5"></div>
				<div class="skeleton h-3.5 w-full"></div>
			</div>
		{/if}

		<div>
			<div class="mb-2 flex items-center justify-between gap-2">
				<h3 class="m-0 text-sm font-semibold">How the court ruled</h3>
				<span class="text-xs text-muted-foreground">
					{session.elapsedMs !== null ? `Computed in ${int(session.elapsedMs)} ms` : session.running ? 'Running…' : ''}
				</span>
			</div>
			<ol class="m-0 grid list-none gap-2 p-0">
				{#each steps as step (step.key)}
					<li class="rounded-lg border border-border bg-card-raised px-3 py-2.5">
						<div class="flex items-start justify-between gap-2">
							<p class="m-0 text-[13.5px] font-semibold">
								{step.title}
							</p>
							<Badge tone={step.badge.tone} live={step.badge.live} dot={step.badge.live}>{step.badge.text}</Badge>
						</div>
						<p class="m-0 mt-1 text-[12.5px] leading-snug text-muted-foreground">{step.detail}</p>
						{#if step.mono}
							<p class="m-0 mt-1 font-mono text-[11.5px] break-all text-muted-foreground">{step.mono}</p>
						{/if}
					</li>
				{/each}
			</ol>
		</div>
	</div>

	<footer class="mt-auto grid gap-2 border-t border-border p-4">
		<div class="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
			<button type="button" class="btn btn-secondary" onclick={copyCard} disabled={!result}>
				<Icon name="image" class="size-4" />Verdict card
			</button>
			<button type="button" class="btn btn-secondary" onclick={copyLink} disabled={!result}>
				<Icon name="link" class="size-4" />Copy link
			</button>
			<button type="button" class="btn btn-secondary" onclick={exportAudit} disabled={!result || auditBusy} aria-busy={auditBusy}>
				<Icon name={auditBusy ? 'spinner' : 'file'} class="size-4" />Export audit
			</button>
		</div>
		<p class="m-0 min-h-5 text-[13px] break-all text-subtle" role="status">{toast}</p>
	</footer>
</section>
