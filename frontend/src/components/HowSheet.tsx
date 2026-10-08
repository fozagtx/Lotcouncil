import { useRef, useState } from 'react';
import { rerunAudit } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Icon } from './Icon';
import { cn } from '@/lib/utils';

export function HowSheet({ open, onOpenChange, focusAudit }: { open: boolean; onOpenChange: (v: boolean) => void; focusAudit?: boolean }) {
	const [rerun, setRerun] = useState<{ ok: boolean; text: string } | null>(null);
	const [checking, setChecking] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);

	async function onfile(e: React.ChangeEvent<HTMLInputElement>) {
		const input = e.currentTarget;
		const file = input.files?.[0];
		if (!file) return;
		setChecking(true);
		setRerun(null);
		try {
			const data = await rerunAudit(await file.text());
			setRerun(
				data.same
					? { ok: true, text: `Same ruling: ${data.verdict_now}. The candles match their fingerprint and every number matches.` }
					: {
							ok: false,
							text: `Different: the file says ${data.verdict_in_file}, the re-run gives ${data.verdict_now}.${
								data.hash_ok ? '' : ' The candles don’t match their fingerprint.'
							} ${data.differences.slice(0, 2).join('; ')}`
						}
			);
		} catch (err) {
			setRerun({ ok: false, text: `Couldn’t re-run that file: ${(err as Error).message}` });
		} finally {
			setChecking(false);
			input.value = '';
		}
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="w-[min(560px,100%)] overflow-y-auto sm:max-w-[560px]"
				onOpenAutoFocus={(e) => {
					if (focusAudit) {
						e.preventDefault();
						document.getElementById('check-title')?.scrollIntoView({ block: 'start' });
						fileRef.current?.focus();
					}
				}}
			>
				<SheetHeader className="pb-2">
					<p className="m-0 text-[12px] font-extrabold tracking-[0.14em] text-primary">LOTCOUNCIL</p>
					<SheetTitle className="text-xl font-bold tracking-tight">How the court works</SheetTitle>
					<SheetDescription className="sr-only">How rulings are made, what the AI does, and how to check an audit file.</SheetDescription>
				</SheetHeader>
				<div className="grid gap-2 px-4 pb-10 text-[15px] text-subtle [&_h3]:mt-4 [&_h3]:mb-0 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-foreground [&_p]:m-0">
					<p>
						An idea is ruled <b className="text-foreground">PASS</b> only if it makes at least 10 trades and passes all three tests. The thresholds are fixed
						in code, so the same prices, rule and fee always give the same ruling.
					</p>
					<h3>Score</h3>
					<p>
						The score is the average hourly return divided by how much those returns swing, scaled to a year. Traders call this an annualised{' '}
						<em>Sharpe ratio</em> (here with no risk-free rate). It is only used to compare the tests, and it counts every hour, including hours in cash.
					</p>
					<h3>A. Unseen data</h3>
					<p>
						The history is split 60/40 by time. Only the last 40% is judged, so a rule tuned on what you could see has to work on what came after. This is
						an <em>out-of-sample</em> test. It passes when the score on the last 40% is above 0.5.
					</p>
					<h3>B. Random timing</h3>
					<p>
						The court makes 500 copies of the rule’s positions, cuts them into 24-hour blocks and shuffles the blocks. Each copy holds the token for the
						same amount of time, but at random moments. If the real rule beats at least 95% of the copies, its timing is better than chance. This is a{' '}
						<em>block permutation test</em> at the 5% level. Fees are left out here because shuffling adds trades at block edges; test C handles fees.
					</p>
					<h3>C. Stress</h3>
					<p>
						Fees are tripled, and the score must stay above 0. Then weekend candles are checked on their own. Stock tokens trade all weekend, but the US
						market is shut from Friday 8pm to Sunday 8pm New York time, and Bitget says weekend prices come from a market maker. Losses on those candles
						must be under half the total result.
					</p>
					<h3>Trades and fees</h3>
					<p>
						Rules only buy or sit in cash; there is no short selling. A decision made at the close of one hourly candle is held during the next, so no rule
						can peek ahead. The fee is charged each time the position changes, so a round trip costs it twice.
					</p>
					<h3>What the AI does, and doesn’t</h3>
					<p>
						The AI reads your sentence into one of three rule types and explains the ruling in four sentences. It never sets PASS or FAIL, never picks the
						data, thresholds or fees, and its explanation is only shown if every number in it came from the court. With the AI off, a keyword reader and a
						template take over.
					</p>
					<h3>Data</h3>
					<p>
						Prices are hourly candles from Bitget’s public spot API for tokenized US stocks. Only finished candles are used. Volume is ignored because it
						may be missing before July 9, 2026.
					</p>
					<h3>Limits</h3>
					<p>
						A PASS says the idea is not obviously luck on this history. It does not say the idea will work next month. Tokenized stocks are new, so
						histories are short, and a few months of prices can still fool any test.
					</p>
					<h3 id="check-title">Check an audit file</h3>
					<p>
						Each ruling can be downloaded as an audit file: the idea, the rule, the exact candles, their fingerprint, the settings and the result. Re-run
						one here, or with <code className="rounded bg-muted px-1.5 font-mono text-[13px]">python -m lotcouncil rerun file.json</code>.
					</p>
					<div>
						<Button variant="secondary" size="sm" asChild>
							<label className="cursor-pointer border-dashed" aria-describedby="check-title">
								<Icon name={checking ? 'spinner' : 'file'} className="size-[18px]" />
								Choose an audit file
								<input ref={fileRef} id="audit-file" type="file" accept="application/json,.json" className="sr-only" onChange={onfile} />
							</label>
						</Button>
					</div>
					<p role="status" className={cn('font-semibold', rerun && (rerun.ok ? 'text-success-foreground' : 'text-danger-foreground'))}>
						{rerun?.text ?? ''}
					</p>
				</div>
			</SheetContent>
		</Sheet>
	);
}
