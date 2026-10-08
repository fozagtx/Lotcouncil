import { fmtDateTime } from '@/lib/format';
import type { Trade } from '@/lib/types';
import { cn } from '@/lib/utils';

function Pill({ cls, children }: { cls: string; children: React.ReactNode }) {
	return <span className={cn('inline-flex h-5 items-center rounded-md px-2 text-xs font-medium', cls)}>{children}</span>;
}

export function TradeTable({ trades, decimals }: { trades: Trade[]; decimals: number }) {
	const sign = (x: number) => (x > 0 ? '+' : x < 0 ? '−' : '');
	const wins = trades.filter((t) => !t.open && t.return_pct > 0).length;
	const closed = trades.filter((t) => !t.open).length;
	const avgHours = trades.length ? Math.round(trades.reduce((a, t) => a + t.hours, 0) / trades.length) : 0;
	const best = trades.length ? Math.max(...trades.map((t) => t.return_pct)) : 0;
	const worst = trades.length ? Math.min(...trades.map((t) => t.return_pct)) : 0;

	if (trades.length === 0) {
		return (
			<div className="grid place-items-center gap-1 px-4 py-12 text-center">
				<p className="m-0 font-semibold">No trades</p>
				<p className="m-0 max-w-sm text-sm text-muted-foreground">The rule never bought in this window. Try a longer window or shorter lengths in the Rule tab.</p>
			</div>
		);
	}

	const statCells: [string, string, string][] = [
		['Win rate', closed ? `${Math.round((100 * wins) / closed)}%` : '–', `${wins} of ${closed} closed`],
		['Avg. hold', `${avgHours} h`, `${trades.length} trades`],
		['Best trade', `${sign(best)}${Math.abs(best).toFixed(2)}%`, 'after fees'],
		['Worst trade', `${sign(worst)}${Math.abs(worst).toFixed(2)}%`, 'after fees']
	];

	return (
		<>
			<dl className="m-0 grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-4">
				{statCells.map(([label, value, note]) => (
					<div key={label} className="bg-card px-4 py-2.5">
						<dt className="eyebrow">{label}</dt>
						<dd className="num m-0 text-[17px] font-bold">{value}</dd>
						<p className="m-0 text-xs text-muted-foreground">{note}</p>
					</div>
				))}
			</dl>
			<div className="max-h-[440px] overflow-auto" role="region" aria-label="Trade ledger" tabIndex={0}>
				<table className="w-full min-w-[720px] border-collapse text-[13px]">
					<caption className="sr-only">Every trade the rule made, oldest first. Returns include fees.</caption>
					<thead className="sticky top-0 z-10 bg-muted">
						<tr className="text-left">
							{['Trade', 'Entry', 'Exit', 'Held', 'Entry price', 'Exit price', 'Return', 'Part', 'Status'].map((h) => (
								<th
									key={h}
									scope="col"
									className={cn(
										'border-b border-border px-3 py-2 text-[11px] font-bold tracking-[0.06em] whitespace-nowrap text-muted-foreground uppercase',
										['Held', 'Entry price', 'Exit price', 'Return'].includes(h) && 'text-right'
									)}
								>
									{h}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{trades.map((t) => (
							<tr key={t.n} className="border-b border-border last:border-0 even:bg-muted/60">
								<td className="px-3 py-1.5 font-mono text-[12px] font-semibold text-info-foreground">T-{String(t.n).padStart(3, '0')}</td>
								<td className="num px-3 py-1.5 whitespace-nowrap">{fmtDateTime(t.entry_time)}</td>
								<td className="num px-3 py-1.5 whitespace-nowrap">{t.open ? '–' : fmtDateTime(t.exit_time)}</td>
								<td className="num px-3 py-1.5 text-right">{t.hours} h</td>
								<td className="num px-3 py-1.5 text-right">{t.entry_price.toFixed(decimals)}</td>
								<td className="num px-3 py-1.5 text-right">{t.exit_price.toFixed(decimals)}</td>
								<td className={cn('num px-3 py-1.5 text-right font-semibold', t.return_pct >= 0 ? 'text-success-foreground' : 'text-danger-foreground')}>
									{sign(t.return_pct)}
									{Math.abs(t.return_pct).toFixed(2)}%
								</td>
								<td className="px-3 py-1.5">
									<Pill cls={t.part === 'unseen' ? 'bg-info-muted text-info-foreground' : 'bg-muted text-subtle'}>{t.part === 'unseen' ? 'Never seen' : 'Seen'}</Pill>
								</td>
								<td className="px-3 py-1.5">
									{t.open ? (
										<Pill cls="bg-warning-muted text-warning-foreground">Open</Pill>
									) : t.return_pct > 0 ? (
										<Pill cls="bg-success-muted text-success-foreground">Win</Pill>
									) : (
										<Pill cls="bg-danger-muted text-danger-foreground">Loss</Pill>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<p className="m-0 border-t border-border px-4 py-2 text-xs text-muted-foreground">
				Bought at the close before the first held hour, sold at the close of the last one. Returns include both fees. An open trade was still held at the last candle.
			</p>
		</>
	);
}
