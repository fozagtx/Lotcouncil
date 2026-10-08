<script lang="ts">
	import type { CourtSession } from '#lib/court.svelte.js';
	import type { PastRuling } from '#lib/history.svelte.js';
	import { RULE_FIELDS } from '#lib/rules.js';
	import Icon from './Icon.svelte';
	import Badge from './ui/Badge.svelte';
	import Button from './ui/Button.svelte';
	import Card from './ui/Card.svelte';
	import CardDescription from './ui/CardDescription.svelte';
	import CardHeader from './ui/CardHeader.svelte';
	import CardTitle from './ui/CardTitle.svelte';
	import Empty from './ui/Empty.svelte';

	let { session, class: className = '' }: { session: CourtSession; class?: string } = $props();

	const items = $derived(session.history.items);
	const SHORT = { ma_cross: 'Avg', breakout: 'Breakout', dip_buy: 'Dip' } as const;

	function ruleCode(p: PastRuling): string {
		const nums = RULE_FIELDS[p.rule.type].map((f) => `${p.rule[f.key]}${f.unit === '%' ? '%' : ''}`);
		return `${SHORT[p.rule.type]} ${nums.join('/')}`;
	}

	function ago(ms: number): string {
		const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
		if (s < 60) return 'just now';
		if (s < 3600) return `${Math.floor(s / 60)} min ago`;
		if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
		return `${Math.floor(s / 86400)} d ago`;
	}
</script>

<Card id="recent" class={className} aria-labelledby="recent-title" tabindex={-1}>
	<CardHeader class="pb-3 sm:pb-3">
		<CardTitle id="recent-title">Recent rulings</CardTitle>
		<CardDescription>Saved in this browser. Open one to re-run it on the same candles.</CardDescription>
		{#snippet action()}
			{#if items.length}
				<Button variant="ghost" size="sm" onclick={() => session.history.clear()}>Clear</Button>
			{/if}
		{/snippet}
	</CardHeader>
	{#if items.length === 0}
		<Empty title="No rulings yet" description="Rulings you run appear here." class="pt-2 md:pt-4 md:pb-8">
			{#snippet media()}<Icon name="history" />{/snippet}
		</Empty>
	{:else}
		<ul class="m-0 max-h-[360px] list-none overflow-y-auto border-t p-0">
			{#each items as p (p.id)}
				<li class="border-b last:border-0">
					<button
						type="button"
						class="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset disabled:opacity-50 sm:px-6"
						onclick={() => session.reopen(p)}
						disabled={session.running}
						aria-label="Re-open {p.verdict} ruling: {p.label}, {ruleCode(p)}, {p.days} days"
					>
						<span
							class="grid size-9 place-items-center rounded-lg border text-[11px] font-semibold
								{p.verdict === 'PASS' ? 'border-success/30 bg-success-muted text-success-foreground' : 'border-danger/30 bg-danger-muted text-danger-foreground'}"
							aria-hidden="true"
						>
							{p.label.replace(/^r/, '').slice(0, 2).toUpperCase()}
						</span>
						<span class="min-w-0">
							<span class="block truncate text-sm font-medium">{p.label}/USDT</span>
							<span class="block truncate font-mono text-xs text-muted-foreground">{ruleCode(p)} · {p.days}D · {ago(p.at)}</span>
						</span>
						<Badge variant={p.verdict === 'PASS' ? 'success' : 'danger'}>{p.verdict}</Badge>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</Card>
