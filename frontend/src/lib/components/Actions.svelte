<script lang="ts">
	import { getAudit } from '#lib/api.js';
	import { downloadBlob, shareCard } from '#lib/card.js';
	import type { CourtSession } from '#lib/court.svelte.js';
	import Icon from './Icon.svelte';

	let { session }: { session: CourtSession } = $props();

	let toast = $state('');
	let auditBusy = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	function say(message: string) {
		toast = message;
		clearTimeout(timer);
		timer = setTimeout(() => (toast = ''), 4000);
	}

	async function copyCard() {
		if (!session.result) return;
		const how = await shareCard(session.result);
		if (how === 'copied') say('Verdict card copied as an image. Paste it anywhere.');
		else if (how === 'shared') say('Verdict card shared.');
		else if (how === 'downloaded') say('Verdict card saved as an image.');
	}

	async function copyLink() {
		if (!session.result) return;
		const url = session.shareUrl();
		try {
			await navigator.clipboard.writeText(url);
			say('Link copied. It re-runs this exact ruling on the same candles.');
		} catch {
			try {
				await navigator.share({ url, title: 'Lotcouncil ruling' });
			} catch {
				say(url);
			}
		}
	}

	async function downloadAudit() {
		const r = session.result;
		if (!r) return;
		auditBusy = true;
		try {
			const blob = await getAudit({
				symbol: r.request.symbol,
				days: r.request.days,
				end: Math.floor(r.request.end / 1000),
				rule: r.request.rule,
				fee_pct: 100 * r.request.fee,
				idea: r.idea,
				parsed_by: r.request.parsed_by,
				explanation: session.explanation
			});
			downloadBlob(blob, `lotcouncil-${r.market.symbol.replace(/USDT$/, '')}-${r.ruling.verdict.toLowerCase()}.json`);
			say('Audit file saved. Re-run it under How this works, or with python -m lotcouncil rerun.');
		} catch (e) {
			say(`The audit file couldn’t be made: ${(e as Error).message}`);
		} finally {
			auditBusy = false;
		}
	}
</script>

<div class="grid gap-2">
	<div class="flex flex-wrap gap-2">
		<button type="button" class="btn btn-secondary" onclick={copyCard} disabled={!session.result}>
			<Icon name="image" class="size-[18px]" />Copy verdict card
		</button>
		<button type="button" class="btn btn-secondary" onclick={copyLink} disabled={!session.result}>
			<Icon name="link" class="size-[18px]" />Copy link
		</button>
		<button
			type="button"
			class="btn btn-secondary"
			onclick={downloadAudit}
			disabled={!session.result || auditBusy}
			aria-busy={auditBusy}
		>
			<Icon name={auditBusy ? 'spinner' : 'file'} class="size-[18px]" />Download audit file
		</button>
	</div>
	<p class="m-0 min-h-5 text-sm break-all text-subtle" role="status">{toast}</p>
</div>
