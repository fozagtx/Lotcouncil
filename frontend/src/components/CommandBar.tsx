import { forwardRef, useEffect } from 'react';
import { Icon } from './Icon';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Textarea } from '@/components/ui/textarea';
import { feeLabel } from '@/lib/format';
import { useCourtSession } from '@/lib/useCourt';

function grow(el: HTMLTextAreaElement | null) {
	if (!el) return;
	el.style.height = 'auto';
	el.style.height = `${Math.min(el.scrollHeight, 54)}px`; // 1 row, at most 2
}

export const CommandBar = forwardRef<HTMLTextAreaElement, { onrun: (idea: string) => void }>(function CommandBar({ onrun }, textareaRef) {
	const session = useCourtSession();
	const markets = session.markets;

	function submit(e: React.FormEvent) {
		e.preventDefault();
		const idea = session.idea.trim();
		if (!idea) return;
		onrun(idea);
	}

	const ref = (textareaRef as React.RefObject<HTMLTextAreaElement | null>) ?? null;
	useEffect(() => {
		grow(ref?.current);
	}, [session.idea, ref]);

	return (
		<Card className="gap-0 py-0" aria-label="New trial" role="region">
			<form className="flex flex-col gap-2 p-3 lg:flex-row lg:items-center lg:gap-3" onSubmit={submit} autoComplete="off">
				<Textarea
					id="idea"
					ref={textareaRef}
					value={session.idea}
					onChange={(e) => {
						session.setIdea(e.target.value);
						grow(e.target);
					}}
					onKeyDown={(e) => {
						if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
							e.preventDefault();
							e.currentTarget.form?.requestSubmit();
						}
					}}
					rows={1}
					maxLength={400}
					required
					aria-label="Your idea"
					placeholder="buy when the 10 hour average crosses above the 40 hour average"
					className="min-h-9 flex-1 resize-none overflow-hidden py-1.5 text-[13.5px] leading-[1.4]"
				/>
				<div className="flex flex-wrap items-center gap-2 max-lg:w-full">
					{markets && (
						<>
							<Select value={session.symbol} onValueChange={(v) => session.setSymbol(v)}>
								<SelectTrigger size="sm" aria-label="Token" className="w-auto">
									<SelectValue placeholder="Token" />
								</SelectTrigger>
								<SelectContent>
									{markets.tokens.map((t) => (
										<SelectItem key={t.symbol} value={t.symbol}>
											{t.label}/USDT{t.name ? ` · ${t.name}` : ''}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Select value={String(session.feePct)} onValueChange={(v) => session.setFeePct(Number(v))}>
								<SelectTrigger size="sm" aria-label="Fee per trade" className="w-auto">
									<SelectValue placeholder="Fee" />
								</SelectTrigger>
								<SelectContent>
									{markets.fees_pct.map((f) => (
										<SelectItem key={f} value={String(f)}>
											{feeLabel(f)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<ToggleGroup
								type="single"
								variant="outline"
								size="sm"
								value={String(session.days)}
								onValueChange={(v) => v && session.setDays(Number(v))}
								aria-label="History"
								className="gap-0.5"
							>
								{markets.windows_days.map((d) => (
									<ToggleGroupItem key={d} value={String(d)} aria-label={`Last ${d} days`} className="min-h-6 px-2 text-[12.5px]">
										{d}D
									</ToggleGroupItem>
								))}
							</ToggleGroup>
						</>
					)}
				</div>
				<Button type="submit" className="min-h-9 px-4 text-[13.5px] max-lg:w-full lg:shrink-0" disabled={session.running} aria-busy={session.running}>
					<Icon name={session.running ? 'spinner' : 'gavel'} className="size-4" />
					<span>{session.running ? 'Ruling…' : 'Judge'}</span>
				</Button>
			</form>
		</Card>
	);
});
