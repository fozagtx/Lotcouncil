import { useRef, useState } from 'react';
import { getAudit } from '@/lib/api';
import { downloadBlob, shareCard } from '@/lib/card';
import type { StepKey, StepState } from '@/lib/court';
import { feeLabel, fmtDate, int, signedPct } from '@/lib/format';
import type { TestKey } from '@/lib/types';
import { useCourtSession } from '@/lib/useCourt';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBox } from './ErrorBox';
import { Icon } from './Icon';

type Tone = 'success' | 'danger' | 'info' | 'warning' | 'neutral';

const TONE_CLS: Record<Tone, string> = {
	success: 'bg-success-muted text-success-foreground',
	danger: 'bg-danger-muted text-danger-foreground',
	info: 'bg-info-muted text-info-foreground',
	warning: 'bg-warning-muted text-warning-foreground',
	neutral: 'bg-muted text-subtle'
};

function Pill({ tone, live, className, children }: { tone: Tone; live?: boolean; className?: string; children: React.ReactNode }) {
	return (
		<span className={cn('inline-flex h-5 items-center gap-1.5 rounded-md border border-border px-2 text-xs font-medium', TONE_CLS[tone], className)}>
			{live && <span className="size-1.5 rounded-full bg-current motion-safe:animate-pulse" aria-hidden="true" />}
			{children}
		</span>
	);
}

interface Step {
	key: StepKey;
	title: string;
	badge: { tone: Tone; text: string; live?: boolean };
	detail: string;
	mono?: string;
}

const SOURCE_BADGE = { ai: 'AI', keywords: 'Keywords', user: 'Your numbers' } as const;
const MARKET_BADGE = { bitget: 'Live', saved: 'Saved' } as const;

function stateBadge(state: StepState, passed: boolean | undefined): Step['badge'] {
	if (state === 'active') return { tone: 'info', text: 'Running', live: true };
	if (state === 'skipped') return { tone: 'neutral', text: 'Skipped' };
	if (state === 'failed') return { tone: 'danger', text: 'Failed' };
	if (state === 'done') return passed === false ? { tone: 'danger', text: 'Failed' } : { tone: 'success', text: 'Passed' };
	return { tone: 'neutral', text: 'Waiting' };
}

export function Inspector() {
	const session = useCourtSession();
	const result = session.result;
	const ruling = result?.ruling;
	const pass = ruling?.verdict === 'PASS';
	const judged = !!ruling?.gate.passed;
	const statusText = !ruling ? '' : !judged ? 'Not judged' : pass ? 'Passed' : 'Failed';
	const statusTone: Tone = !ruling ? 'neutral' : !judged ? 'neutral' : pass ? 'success' : 'danger';

	const notes: string[] = (() => {
		if (!result) return [];
		const out: string[] = [];
		if (result.market.source !== 'bitget') out.push(result.market.source_note);
		if (result.market.short_history) out.push(`Only ${result.market.days_available} days of history exist for ${result.market.label}, so all of it was used.`);
		return out;
	})();

	const steps: Step[] = (() => {
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
				badge: s.read === 'done' && reading ? { tone: 'info', text: SOURCE_BADGE[reading.source] } : stateBadge(s.read, undefined),
				detail: ruling?.rule_text || reading?.rule_text || 'Turning the sentence into one of three rule types.'
			},
			{
				key: 'data',
				title: 'Prices loaded',
				badge: s.data === 'done' && m ? { tone: m.source === 'bitget' ? 'success' : 'warning', text: MARKET_BADGE[m.source] } : stateBadge(s.data, undefined),
				detail: m ? `${int(m.candles)} hourly candles, ${fmtDate(m.start / 1000)} to ${fmtDate(m.end / 1000)}.` : 'Finished hourly candles only.',
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
	})();

	// ----- actions -----
	const [toast, setToast] = useState('');
	const [auditBusy, setAuditBusy] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
	function say(message: string) {
		setToast(message);
		clearTimeout(timer.current);
		timer.current = setTimeout(() => setToast(''), 4000);
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
		setAuditBusy(true);
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
			setAuditBusy(false);
		}
	}

	return (
		<Card className="flex flex-col gap-0 py-0" aria-labelledby="ruling-title" aria-busy={!result && !session.error} data-panel="inspector">
			<CardHeader className="flex min-h-10 items-center justify-between border-b border-border px-3 py-2 lg:px-4">
				<h2 id="ruling-title" className="m-0 text-[11px] font-bold tracking-[0.07em] uppercase">
					Ruling inspector
				</h2>
			</CardHeader>

			<div className="grid gap-3 p-3 lg:p-4">
				{session.error ? (
					<ErrorBox failure={session.error} onretry={() => session.retry()} />
				) : ruling && result ? (
					<div className="reveal grid gap-1">
						<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
							<Pill key={statusText} tone={statusTone} className="swap border-0">
								{statusText}
							</Pill>
							<p
								key={ruling.verdict}
								className={cn(
									'swap m-0 font-mono text-[24px] leading-none font-semibold tracking-tight',
									pass && judged ? 'text-success-foreground' : judged ? 'text-danger-foreground' : 'text-muted-foreground'
								)}
								aria-label={`Verdict: ${ruling.verdict}`}
							>
								{judged ? ruling.verdict : '–'}
							</p>
							<p className="m-0 min-w-0 flex-1 basis-48 text-[14px] leading-snug font-semibold">{ruling.headline}</p>
						</div>
						<p className="m-0 text-[13px] break-words">“{result.idea || ruling.rule_text}”</p>
						<p className="m-0 text-[11px] text-muted-foreground">
							{result.market.label} · {result.market.days_available} days · fee {feeLabel(100 * result.request.fee)}
						</p>
						<p className="num m-0 font-mono text-[12px] text-subtle">
							Result after fees {signedPct(ruling.stats.total_return_pct)} · Just holding {signedPct(ruling.stats.buy_hold_return_pct)}
						</p>
					</div>
				) : session.running ? (
					<div className="grid gap-2" aria-hidden="true">
						<div className="flex items-center gap-3">
							<Skeleton className="h-5 w-16" />
							<Skeleton className="h-7 w-24" />
						</div>
						<Skeleton className="h-3.5 w-4/5" />
						<Skeleton className="h-3 w-full" />
						<Skeleton className="h-3 w-2/3" />
					</div>
				) : (
					<p className="m-0 text-[13px] text-muted-foreground">No ruling yet</p>
				)}

				{notes.length > 0 && (
					<p className="m-0 flex gap-2 rounded-md bg-warning-muted px-2.5 py-1.5 text-[12.5px] text-warning-foreground">
						<Icon name="alert" className="mt-0.5 size-3.5 shrink-0" />
						<span>{notes.join(' ')}</span>
					</p>
				)}

				<div>
					<div className="mb-1.5 flex items-center justify-between gap-2">
						<h3 className="eyebrow m-0">Court timeline</h3>
						<span className="num text-[11px] font-semibold tracking-[0.06em] text-info-foreground uppercase">
							{session.elapsedMs !== null ? `Total ${int(session.elapsedMs)} ms` : session.running ? 'Running…' : ''}
						</span>
					</div>
					<ol className="m-0 grid list-none gap-1.5 p-0">
						{steps.map((step) => (
							<li key={step.key} className="rounded-md border border-border bg-muted/50 px-2.5 py-2">
								<div className="flex items-start justify-between gap-2">
									<p className="m-0 text-[12.5px] font-semibold">
										<span className="num mr-1.5 font-mono text-[11px] font-medium text-primary">
											T+{session.stepTimes[step.key] ?? '–'}
											{session.stepTimes[step.key] !== null ? ' ms' : ''}
										</span>
										{step.title}
									</p>
									<Pill tone={step.badge.tone} live={step.badge.live}>
										{step.badge.text}
									</Pill>
								</div>
								<p className="m-0 mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{step.detail}</p>
								{step.mono && <p className="m-0 mt-0.5 font-mono text-[11px] break-all text-muted-foreground">{step.mono}</p>}
							</li>
						))}
					</ol>
				</div>
			</div>

			<div className="mt-auto border-t border-border p-3 lg:p-4">
				<div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
					<Button size="sm" onClick={exportAudit} disabled={!result || auditBusy} aria-busy={auditBusy}>
						<Icon name={auditBusy ? 'spinner' : 'file'} className="size-4" />
						Export audit
					</Button>
					<Button variant="secondary" size="sm" onClick={copyLink} disabled={!result}>
						<Icon name="link" className="size-4" />
						Copy link
					</Button>
					<Button variant="secondary" size="sm" className="hidden xl:inline-flex" onClick={copyCard} disabled={!result}>
						<Icon name="image" className="size-4" />
						Verdict card
					</Button>
				</div>
				<p className="m-0 mt-1.5 min-h-4 text-[12px] break-all text-subtle" role="status">
					{toast}
				</p>
				<p className="m-0 mt-0.5 text-[11px] text-muted-foreground">Not financial advice. A PASS means not obviously luck on this history.</p>
			</div>
		</Card>
	);
}
