import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { fmtDate, signedPct } from '@/lib/format';
import { useCourtSession } from '@/lib/useCourt';
import { CandleChart } from './charts/CandleChart';
import { LineChart } from './charts/LineChart';

export function ChartPanel() {
	const session = useCourtSession();
	const [view, setView] = useState<string>('candles');

	const result = session.result;
	const chart = result?.chart;
	const pair = !result ? '' : `${result.market.label}/USDT`;
	const windows = session.markets?.windows_days ?? [];
	const candleLabel = (() => {
		const h = chart?.candles?.hours ?? 1;
		return h === 24 ? '1D candles' : `${h}H candles`;
	})();
	const sourceLabel = !result ? '' : result.market.source === 'saved' ? 'Saved Bitget spot' : 'Bitget spot';

	return (
		<Card className="gap-0 py-0" aria-labelledby="chart-title" aria-busy={session.running && !result} data-panel="chart">
			<CardHeader className="flex min-h-10 flex-col gap-1.5 border-b border-border px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between lg:px-4">
				<div className="flex min-w-0 items-baseline gap-2">
					<h2 id="chart-title" className={`m-0 text-[11px] font-bold tracking-[0.07em]${result ? '' : ' uppercase'}`}>
						{result ? pair : 'Chart'}
					</h2>
					{result && (
						<span className="truncate text-[11px] text-muted-foreground">
							{sourceLabel} · {view === 'candles' ? candleLabel : 'result after fees'}
						</span>
					)}
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<ToggleGroup type="single" variant="outline" size="sm" value={view} onValueChange={(v) => v && setView(v)} aria-label="Chart view" className="gap-0.5">
						<ToggleGroupItem value="candles" aria-label="Show price candles" className="min-h-6 px-2 text-[12.5px]">
							Candles
						</ToggleGroupItem>
						<ToggleGroupItem value="result" aria-label="Show the rule’s result after fees" className="min-h-6 px-2 text-[12.5px]">
							Result
						</ToggleGroupItem>
					</ToggleGroup>
					<ToggleGroup
						type="single"
						variant="outline"
						size="sm"
						value={String(session.days)}
						onValueChange={(v) => v && !session.running && session.changeWindow(Number(v))}
						aria-label="Time window"
						className="hidden gap-0.5 sm:flex"
					>
						{windows.map((d) => (
							<ToggleGroupItem key={d} value={String(d)} aria-label={`Re-run on the last ${d} days`} disabled={session.running} className="min-h-6 px-2 text-[12.5px]">
								{d}D
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</div>
			</CardHeader>

			<div className="p-3">
				{result && chart ? (
					<div className="reveal">
						<div className="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground" aria-hidden="true">
							{view === 'candles' ? (
								<>
									<span className="inline-flex items-center gap-1.5">
										<i className="h-3 w-2 rounded-[2px] bg-[var(--candle-up)]" />
										Up
									</span>
									<span className="inline-flex items-center gap-1.5">
										<i className="h-3 w-2 rounded-[2px] bg-[var(--candle-down)]" />
										Down
									</span>
								</>
							) : (
								<span className="inline-flex items-center gap-1.5">
									<i className="h-0.5 w-4 rounded bg-chart-1" />
									Result after fees
								</span>
							)}
							<span className="inline-flex items-center gap-1.5">
								<i className="size-3 rounded-[3px] bg-[var(--holding-wash)] ring-1 ring-primary/40" />
								Rule holding
							</span>
							<span className="inline-flex items-center gap-1.5">
								<i className="size-3 rounded-[3px] bg-muted ring-1 ring-border-strong" />
								Never-seen 40%
							</span>
						</div>
						{view === 'candles' && chart.candles ? (
							<CandleChart
								candles={chart.candles}
								spans={chart.holding}
								split={chart.split_time}
								height={280}
								label={`${pair} price candles, with the rule's holding periods shaded and the never-seen last 40% marked.`}
							/>
						) : (
							<LineChart
								time={chart.time}
								values={chart.equity_pct}
								spans={chart.holding}
								split={chart.split_time}
								splitLabels={['Seen', 'Never seen']}
								zero
								height={280}
								yFormat={(v) => Math.round(v) + '%'}
								tip={(i) => ({ head: fmtDate(chart.time[i]), value: `Result after fees ${signedPct(chart.equity_pct[i])}` })}
								label="The rule's result after fees over time, with the never-seen last 40% shaded."
							/>
						)}
					</div>
				) : session.running ? (
					<Skeleton className="h-[280px]" aria-hidden="true" />
				) : (
					<div className="grid h-[280px] place-items-center">
						<p className="m-0 text-[13px] text-muted-foreground">Pick a token and press Judge</p>
					</div>
				)}
			</div>
		</Card>
	);
}
