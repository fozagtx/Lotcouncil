import type { CourtResult } from '@/lib/court';
import { int, pct, score } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Kpi {
	label: string;
	value: string;
	note: string;
	tone: 'pass' | 'fail' | 'plain';
}

const NOTES = ['needs > 0.5', 'needs 95%', 'needs > 0', 'needs 10+'];
const LABELS = ['Unseen score', 'Beat random', 'Score at 3x fees', 'Trades'];

export function KpiStrip({ result, running = false }: { result: CourtResult | null; running?: boolean }) {
	const kpis: Kpi[] = (() => {
		if (!result) return LABELS.map((label, i) => ({ label, value: '–', note: NOTES[i], tone: 'plain' }));
		const { tests, gate } = result.ruling;
		const tone = (ok: boolean | undefined): Kpi['tone'] => (ok === undefined ? 'plain' : ok ? 'pass' : 'fail');
		return [
			{
				label: 'Unseen score',
				value: tests.A ? score(tests.A.score_unseen) : '–',
				note: tests.A ? `needs > ${tests.A.threshold}` : 'not run',
				tone: tone(tests.A?.passed)
			},
			{
				label: 'Beat random',
				value: tests.B ? pct(tests.B.beat_share_pct) : '–',
				note: tests.B ? `of ${tests.B.copies} · needs ${pct(tests.B.threshold_pct)}` : 'not run',
				tone: tone(tests.B?.passed)
			},
			{
				label: 'Score at 3x fees',
				value: tests.C ? score(tests.C.score_stress) : '–',
				note: tests.C ? 'needs > 0' : 'not run',
				tone: tone(tests.C ? tests.C.fee_passed : undefined)
			},
			{ label: 'Trades', value: int(gate.trades), note: `needs ${gate.min_trades}+`, tone: tone(gate.passed) }
		];
	})();

	const TONE = { pass: 'text-success-foreground', fail: 'text-danger-foreground', plain: 'text-foreground' };

	return (
		<Card className="gap-0 py-0" aria-label="Key numbers" aria-busy={running} role="region">
			<dl className="m-0 grid grid-cols-2 sm:grid-cols-4">
				{running && !result
					? [0, 1, 2, 3].map((i) => (
							<div key={i} className="grid gap-1.5 px-3 py-2.5 lg:px-4" aria-hidden="true">
								<dt>
									<Skeleton className="h-2.5 w-20" />
								</dt>
								<dd className="m-0">
									<Skeleton className="h-5 w-14" />
								</dd>
								<dd className="m-0">
									<Skeleton className="h-2.5 w-24" />
								</dd>
							</div>
						))
					: kpis.map((k, i) => (
							<div
								key={k.label}
								className={cn(
									'min-w-0 border-border px-3 py-2.5 lg:px-4',
									i % 2 === 1 && 'border-l',
									i >= 2 && 'border-t',
									i >= 2 && 'sm:border-t-0',
									i !== 0 && 'sm:border-l'
								)}
							>
								<dt className="eyebrow truncate">{k.label}</dt>
								<dd className="m-0 mt-0.5 flex items-baseline gap-2">
									<span
										key={k.value}
										className={cn('num font-mono text-[20px] leading-none font-semibold tracking-tight', result && 'pop', result ? TONE[k.tone] : 'text-muted-foreground')}
										style={{ animationDelay: `${i * 70}ms` }}
									>
										{k.value}
									</span>
								</dd>
								<dd className="m-0 mt-0.5 truncate text-[11px] text-muted-foreground">{k.note}</dd>
							</div>
						))}
			</dl>
		</Card>
	);
}
