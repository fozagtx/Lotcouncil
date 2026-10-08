<script lang="ts">
	import type { CourtSession } from '#lib/court.svelte.js';
	import type { PastRuling } from '#lib/history.svelte.js';
	import { RULE_FIELDS } from '#lib/rules.js';
	import Badge from './Badge.svelte';

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

<section id="recent" class="panel {className}" aria-labelledby="recent-title" tabindex="-1">
	<header class="panel-head">
		<h2 id="recent-title" class="panel-title">Recent rulings</h2>
		{#if items.length}
			<button type="button" class="btn btn-ghost min-h-8 px-2 text-xs" onclick={() => session.history.clear()}>Clear</button>
		{/if}
	</header>
	{#if items.length === 0}
		<div class="px-4 py-8 text-center">
			<p class="m-0 text-sm font-semibold">No rulings yet</p>
			<p class="m-0 mt-1 text-[13px] text-muted-foreground">Rulings you run appear here. Open one to re-run it on the same candles.</p>
		</div>
	{:else}
		<ul class="m-0 max-h-[360px] list-none overflow-y-auto p-0">
			{#each items as p (p.id)}
				<li class="border-b border-border last:border-0">
					<button
						type="button"
						class="row-btn grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-left"
						onclick={() => session.reopen(p)}
						disabled={session.running}
						aria-label="Re-open {p.verdict} ruling: {p.label}, {ruleCode(p)}, {p.days} days"
					>
						<span
							class="grid size-8 place-items-center rounded-full text-[11px] font-bold
								{p.verdict === 'PASS' ? 'bg-success-muted text-success-foreground' : 'bg-danger-muted text-danger-foreground'}"
							aria-hidden="true"
						>
							{p.label.replace(/^r/, '').replace('Practice: ', '').slice(0, 2).toUpperCase()}
						</span>
						<span class="min-w-0">
							<span class="block truncate text-[13.5px] font-semibold">{p.label}{p.symbol.startsWith('PRACTICE') ? '' : '/USDT'}</span>
							<span class="block truncate font-mono text-[11.5px] text-muted-foreground">{ruleCode(p)} · {p.days}D · {ago(p.at)}</span>
						</span>
						<Badge tone={p.verdict === 'PASS' ? 'success' : 'danger'}>{p.verdict}</Badge>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</section>
