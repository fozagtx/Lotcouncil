import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartPanel } from '@/components/ChartPanel';
import { CommandBar } from '@/components/CommandBar';
import { HowSheet } from '@/components/HowSheet';
import { Inspector } from '@/components/Inspector';
import { KpiStrip } from '@/components/KpiStrip';
import { NavColumn } from '@/components/NavColumn';
import { Rail } from '@/components/Rail';
import { RulePanel } from '@/components/RulePanel';
import { TestRows } from '@/components/TestRows';
import { TopBar } from '@/components/TopBar';
import { TradeTable } from '@/components/TradeTable';
import type { Rule } from '@/lib/types';
import { getSession, useCourtSession } from '@/lib/useCourt';

export default function App() {
	const session = useCourtSession();
	const [sheet, setSheet] = useState<'' | 'how' | 'audit'>('');
	const openerRef = useRef<Element | null>(null);
	function openSheet(kind: 'how' | 'audit') {
		openerRef.current = document.activeElement;
		setSheet(kind);
	}
	const ideaRef = useRef<HTMLTextAreaElement>(null);

	const result = session.result;
	const landedRef = useRef(false);
	useEffect(() => {
		const landed = !!(session.result || session.error);
		const was = landedRef.current;
		landedRef.current = landed;
		if (!landed || was) return;
		if (!window.matchMedia('(max-width: 1279px)').matches) return;
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		document.querySelector('[data-panel="inspector"]')?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
	}, [session.result, session.error]);

	const decimals = (() => {
		const last = result?.chart.close.at(-1) ?? 100;
		return last >= 100 ? 2 : last >= 1 ? 3 : 5;
	})();

	useEffect(() => {
		getSession().init();
	}, []);

	function runIdea(idea: string) {
		session.run({ idea });
	}

	function runRule(rule: Rule) {
		const same = session.reading && JSON.stringify(session.reading.rule) === JSON.stringify(rule);
		session.run({ rule, idea: same ? session.idea.trim() : '' });
	}

	function focusTrial() {
		document.querySelector('main')?.scrollTo({ top: 0 });
		ideaRef.current?.focus();
	}

	function showRecent() {
		(document.getElementById('nav-recent')?.querySelector('button') as HTMLButtonElement | null)?.focus();
	}

	return (
		<div className="flex h-screen overflow-hidden bg-background">
			<Rail onhow={() => openSheet('how')} onaudit={() => openSheet('audit')} onrecent={showRecent} ontrial={focusTrial} howOpen={sheet === 'how'} />
			<NavColumn />

			<main className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-4 [&>*]:shrink-0">
				<TopBar onhow={() => openSheet('how')} howOpen={sheet === 'how'} />

				<CommandBar ref={ideaRef} onrun={runIdea} />

				<KpiStrip result={result} running={session.running && !result} />

				<div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_440px]">
					<div className="flex min-w-0 flex-col gap-3">
						<ChartPanel />
						<Card className="gap-0 py-0" aria-label="Evidence" role="region">
							<Tabs defaultValue="tests">
								<TabsList className="w-full justify-start gap-0 rounded-none border-b border-border bg-transparent px-2 sm:px-3">
									{(
										[
											['tests', 'Tests'],
											['trades', `Trades${result ? ` (${result.chart.trades.length})` : ''}`],
											['rule', 'Rule'],
											['words', 'Plain words']
										] as const
									).map(([id, label]) => (
										<TabsTrigger
											key={id}
											value={id}
											className="min-h-9 rounded-none border-b-2 border-transparent px-3 text-[13px] font-semibold text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
										>
											{label}
										</TabsTrigger>
									))}
								</TabsList>
								<TabsContent value="tests" className="m-0">
									<TestRows result={result} markets={session.markets} />
								</TabsContent>
								<TabsContent value="trades" className="m-0">
									{result ? (
										<TradeTable trades={result.chart.trades} decimals={decimals} />
									) : (
										<div className="grid gap-2 p-3" aria-hidden="true">
											{[0, 1, 2, 3, 4].map((i) => (
												<Skeleton key={i} className="h-7" />
											))}
										</div>
									)}
								</TabsContent>
								<TabsContent value="rule" className="m-0">
									{result ? (
										<RulePanel
											key={session.reading ? JSON.stringify(session.reading.rule) : 'none'}
											reading={session.reading}
											ruleText={result.ruling.rule_text}
											showNotice={!!session.markets?.ai_enabled}
											running={session.running}
											onrun={runRule}
										/>
									) : (
										<p className="m-0 p-4 text-[13px] text-muted-foreground">No rule yet</p>
									)}
								</TabsContent>
								<TabsContent value="words" className="m-0">
									<div className="grid gap-2.5 p-3 lg:p-4" aria-busy={session.running && !session.explanation}>
										{session.explanation ? (
											<>
												<div className="flex flex-wrap items-center gap-2">
													<Badge variant="secondary" className={session.explanation.source === 'ai' ? 'bg-info-muted text-info-foreground' : 'bg-muted text-subtle'}>
														{session.explanation.source === 'ai' ? 'Written by AI from the court’s numbers' : 'Built-in summary'}
													</Badge>
												</div>
												<p className="m-0 max-w-prose text-[14px] leading-relaxed">{session.explanation.text}</p>
												{session.markets?.ai_enabled && session.explanation.notice && (
													<p className="m-0 text-[12.5px] text-muted-foreground">{session.explanation.notice}</p>
												)}
											</>
										) : session.running ? (
											<div className="grid gap-2" aria-hidden="true">
												<Skeleton className="h-4 w-full" />
												<Skeleton className="h-4 w-11/12" />
												<Skeleton className="h-4 w-4/5" />
											</div>
										) : (
											<p className="m-0 text-[13px] text-muted-foreground">Pick a token and press Judge</p>
										)}
										<p className="m-0 text-[12px] text-muted-foreground">
											The verdict comes from fixed code. The explanation is written from the court’s numbers and cannot change it.
										</p>
									</div>
								</TabsContent>
							</Tabs>
						</Card>
					</div>
					<Inspector className="order-first xl:order-none" />
				</div>
			</main>

			<p className="sr-only" aria-live="polite">
				{session.announcement}
			</p>

			<HowSheet open={sheet !== ''} onOpenChange={(v) => setSheet(v ? 'how' : '')} focusAudit={sheet === 'audit'} returnFocus={openerRef} />
		</div>
	);
}
