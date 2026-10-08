import { RULE_FIELDS } from '@/lib/rules';
import type { PastRuling } from '@/lib/history';
import { useCourtSession } from '@/lib/useCourt';
import { cn } from '@/lib/utils';

const SHORT = { ma_cross: 'Avg', breakout: 'Breakout', dip_buy: 'Dip' } as const;

function ruleCode(p: PastRuling): string {
	const nums = RULE_FIELDS[p.rule.type].map((f) => `${p.rule[f.key]}${f.unit === '%' ? '%' : ''}`);
	return `${SHORT[p.rule.type]} ${nums.join('/')}`;
}

function label(p: PastRuling): string {
	return p.idea.trim() || `${p.label} ${ruleCode(p)}`;
}

export function NavColumn() {
	const session = useCourtSession();
	const tokens = session.markets?.tokens ?? [];
	const items = session.history.items;

	return (
		<aside className="hidden w-56 shrink-0 flex-col overflow-y-auto border-r border-border bg-card xl:flex" aria-label="Markets and recent rulings">
			<p className="eyebrow m-0 px-3 pt-3 pb-1.5">Markets</p>
			<ul className="m-0 list-none p-0 pb-2">
				{tokens.map((t) => (
					<li key={t.symbol}>
						<button
							type="button"
							className={cn(
								'flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-left transition-colors hover:bg-muted',
								session.symbol === t.symbol && 'bg-muted'
							)}
							onClick={() => session.setSymbol(t.symbol)}
							aria-pressed={session.symbol === t.symbol}
						>
							<span className="truncate text-[13px] font-medium">{t.label}</span>
							<span className="shrink-0 font-mono text-[11px] text-muted-foreground">{t.symbol}</span>
						</button>
					</li>
				))}
			</ul>

			<p className="eyebrow m-0 border-t border-border px-3 pt-3 pb-1.5">Recent</p>
			{items.length === 0 ? (
				<p className="m-0 px-3 py-1.5 text-[12.5px] text-muted-foreground">No rulings yet</p>
			) : (
				<ul id="nav-recent" className="m-0 list-none p-0" tabIndex={-1}>
					{items.map((p) => (
						<li key={p.id}>
							<button
								type="button"
								className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-left transition-colors hover:bg-muted disabled:opacity-50"
								onClick={() => session.reopen(p)}
								disabled={session.running}
								aria-label={`Re-open ${p.verdict} ruling: ${label(p)}`}
							>
								<span className="min-w-0 truncate text-[12.5px]">{label(p)}</span>
								<span className={cn('num shrink-0 font-mono text-[11px] font-bold', p.verdict === 'PASS' ? 'text-success-foreground' : 'text-danger-foreground')}>
									{p.verdict}
								</span>
							</button>
						</li>
					))}
				</ul>
			)}
		</aside>
	);
}
