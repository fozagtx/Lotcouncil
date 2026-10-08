import type { CourtResult } from '@/lib/court';
import { feeLabel, fmtDate, pct, score, signedPct } from '@/lib/format';
import type { Markets, TestKey } from '@/lib/types';
import { useCourtSession } from '@/lib/useCourt';
import { cn } from '@/lib/utils';
import { BarPair } from './charts/BarPair';
import { Histogram } from './charts/Histogram';
import { LineChart } from './charts/LineChart';
import { Skeleton } from '@/components/ui/skeleton';

const KEYS: TestKey[] = ['A', 'B', 'C'];

function status(t: { passed: boolean } | undefined, hasResult: boolean): { cls: string; text: string } {
	if (!hasResult) return { cls: 'bg-muted text-subtle', text: 'Waiting' };
	if (!t) return { cls: 'bg-muted text-subtle', text: 'Not run' };
	return t.passed
		? { cls: 'bg-success-muted text-success-foreground', text: 'Passed' }
		: { cls: 'bg-danger-muted text-danger-foreground', text: 'Failed' };
}

export function TestRows({ result, markets }: { result: CourtResult | null; markets: Markets | null }) {
	useCourtSession();
	const tests = result?.ruling.tests;

	return (
		<div className="grid divide-y divide-border">
			{KEYS.map((key) => {
				const t = tests?.[key];
				const info = markets?.tests[key];
				const st = status(t, !!result);
				return (
					<div key={key} className="flex min-h-[72px] flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 max-sm:gap-x-2 max-sm:px-2.5 lg:px-4">
						<span className="w-4 shrink-0 font-mono text-[13px] font-bold text-muted-foreground" aria-hidden="true">
							{key}
						</span>
						<div className="min-w-0 flex-1 max-sm:basis-[calc(100%-1.75rem)]">
							<p className="m-0 text-[13px] font-semibold">
								{info?.name ?? ''}
								<span className="font-normal text-muted-foreground">{' · '}{info?.question ?? ''}</span>
							</p>
							{result && t ? (
								<p className="m-0 mt-0.5 line-clamp-2 text-[12px] leading-snug text-subtle">{t.sentence}</p>
							) : result && !t ? (
								<p className="m-0 mt-0.5 text-[12px] text-subtle">Not run: too few trades to judge.</p>
							) : null}
						</div>
						<div className="hidden w-40 shrink-0 lg:block" aria-hidden="true">
							{!result ? (
								<Skeleton className="h-12 w-full" />
							) : key === 'A' && tests?.A ? (
								<LineChart
									time={result.chart.time}
									values={result.chart.equity_pct}
									split={result.chart.split_time}
									zero
									height={52}
									yFormat={(v) => Math.round(v) + '%'}
									tip={(i) => ({ head: fmtDate(result.chart.time[i]), value: signedPct(result.chart.equity_pct[i]) })}
									label="Result after fees over time; the never-seen last 40% is shaded."
								/>
							) : key === 'B' && tests?.B ? (
								<Histogram
									values={result.chart.copy_scores}
									marker={tests.B.score_real}
									threshold={tests.B.copy_score_p95}
									markerLabel={`This idea ${score(tests.B.score_real)}`}
									label={`Scores of ${tests.B.copies} random-timing copies, with this idea's score marked.`}
									height={52}
								/>
							) : key === 'C' && tests?.C ? (
								<BarPair
									dense
									rows={[
										{ label: feeLabel(tests.C.fee_pct), value: tests.C.score_base, valueLabel: score(tests.C.score_base), strong: true },
										{ label: feeLabel(tests.C.stress_fee_pct), value: tests.C.score_stress, valueLabel: score(tests.C.score_stress), strong: false }
									]}
									label={`Score at the normal fee and at ${tests.C.stress_fee_mult} times the fee.`}
								/>
							) : null}
						</div>
						<span className="num w-16 shrink-0 text-right font-mono text-[15px] font-semibold max-sm:ml-auto">
							{key === 'A' ? (tests?.A ? score(tests.A.score_unseen) : '–') : key === 'B' ? (tests?.B ? pct(tests.B.beat_share_pct) : '–') : tests?.C ? score(tests.C.score_stress) : '–'}
						</span>
						<span className="w-[74px] shrink-0 text-right">
							<span key={st.text} className={cn('swap inline-flex h-5 items-center rounded-md px-2 text-xs font-medium', st.cls)}>
								{st.text}
							</span>
						</span>
					</div>
				);
			})}
		</div>
	);
}
