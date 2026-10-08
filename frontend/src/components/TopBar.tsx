import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCourtSession } from '@/lib/useCourt';
import { cn } from '@/lib/utils';

function StatusBadge({ tone, live, children }: { tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info'; live?: boolean; children: React.ReactNode }) {
	const cls = {
		success: 'bg-success-muted text-success-foreground',
		warning: 'bg-warning-muted text-warning-foreground',
		danger: 'bg-danger-muted text-danger-foreground',
		neutral: 'bg-muted text-subtle',
		info: 'bg-info-muted text-info-foreground'
	}[tone];
	return (
		<Badge variant="secondary" className={cn('gap-1.5', cls)}>
			<span className={cn('size-1.5 rounded-full bg-current', live && 'motion-safe:animate-pulse')} aria-hidden="true" />
			{children}
		</Badge>
	);
}

export function TopBar({ onhow, howOpen }: { onhow: () => void; howOpen?: boolean }) {
	const session = useCourtSession();
	const market = session.result?.market;
	const source = (() => {
		if (session.error?.kind === 'data') return { tone: 'danger' as const, text: 'Bitget offline' };
		if (!market) return { tone: 'neutral' as const, text: session.running ? 'Loading' : 'Waiting' };
		if (market.source === 'bitget') return { tone: 'success' as const, text: 'Live Bitget' };
		return { tone: 'warning' as const, text: 'Saved Bitget' };
	})();

	return (
		<header className="flex flex-wrap items-center gap-3">
			<div className="min-w-0 flex-1">
				<h1 className="m-0 text-[14px] font-semibold tracking-tight">Strategy court</h1>
				<p className="m-0 text-[11px] text-muted-foreground">Fixed code rules PASS or FAIL on hourly Bitget stock-token prices.</p>
			</div>
			<div className="flex shrink-0 flex-wrap items-center justify-end gap-2 max-sm:w-full max-sm:justify-start" role="group" aria-label="Status">
				<StatusBadge tone={source.tone} live={session.running}>
					<span className="sr-only">Data: </span>
					{source.text}
				</StatusBadge>
				{session.markets && (
					<StatusBadge tone={session.markets.ai_enabled ? 'info' : 'neutral'}>
						{session.markets.ai_enabled ? `AI · ${session.markets.ai_model?.split('/').at(-1) ?? 'on'}` : 'AI off'}
					</StatusBadge>
				)}
				<Button variant="secondary" size="sm" onClick={onhow} data-state={howOpen ? 'open' : undefined} className="data-[state=open]:bg-accent" aria-expanded={howOpen}>
					How it works
				</Button>
			</div>
		</header>
	);
}
