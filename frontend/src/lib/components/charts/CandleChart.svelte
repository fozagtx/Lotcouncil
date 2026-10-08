<script lang="ts">
	import { fmtDate, fmtDateTime } from '#lib/format.js';
	import type { Candles } from '#lib/types.js';
	import { extent, nearest, scale, ticks } from './geometry';

	interface Props {
		candles: Candles;
		/** Periods the rule held the token, as [start, end] times (seconds). */
		spans: [number, number][];
		/** Time where the never-seen part starts. */
		split: number;
		height?: number;
		label: string;
	}

	let { candles, spans, split, height = 320, label }: Props = $props();

	let width = $state(0);
	let hover: number | null = $state(null);

	const W = $derived(Math.max(280, width || 700));
	const m = { l: 8, r: 58, t: 24, b: 26 };
	const step = $derived(candles.hours * 3600);

	const geo = $derived.by(() => {
		const n = candles.time.length;
		const t0 = candles.time[0];
		const t1 = candles.time[n - 1] + step;
		const x = scale(t0, t1, m.l, W - m.r);
		const [lo0, hi0] = extent([candles.low, candles.high]);
		const pad = (hi0 - lo0) * 0.06;
		const y = scale(lo0 - pad, hi0 + pad, height - m.b, m.t);
		const slot = (W - m.l - m.r) / n;
		const body = Math.max(1, Math.min(14, slot * 0.62));
		const yTicks = ticks(lo0 - pad, hi0 + pad, 5);
		const every = Math.max(1, Math.round((W - m.l - m.r) / 110));
		const xTicks = Array.from({ length: every + 1 }, (_, i) => t0 + ((t1 - t0) * i) / every);
		return { x, y, body, yTicks, xTicks, t0, t1, n };
	});

	const decimals = $derived.by(() => {
		const last = candles.close[candles.close.length - 1] ?? 100;
		return last >= 100 ? 2 : last >= 1 ? 3 : 5;
	});

	function holdingAt(t: number): boolean {
		let lo = 0;
		let hi = spans.length - 1;
		while (lo <= hi) {
			const mid = (lo + hi) >> 1;
			if (t + step <= spans[mid][0]) hi = mid - 1;
			else if (t > spans[mid][1]) lo = mid + 1;
			else return true;
		}
		return false;
	}

	function move(e: PointerEvent) {
		const box = (e.currentTarget as SVGRectElement).ownerSVGElement!.getBoundingClientRect();
		const px = ((e.clientX - box.left) / box.width) * W;
		const t = geo.t0 + ((px - m.l) / (W - m.l - m.r)) * (geo.t1 - geo.t0) - step / 2;
		hover = nearest(candles.time, t);
	}

	const fmt = (v: number) => (v >= 1000 ? Math.round(v).toLocaleString('en-US') : v.toFixed(v >= 100 ? 1 : 2));
</script>

<div class="relative w-full touch-pan-y" bind:clientWidth={width}>
	<svg viewBox="0 0 {W} {height}" width="100%" {height} role="img" aria-label={label} class="block overflow-visible">
		<!-- never-seen part -->
		<rect x={geo.x(split)} y={m.t} width={W - m.r - geo.x(split)} height={height - m.b - m.t} fill="var(--unseen-wash)" />
		{#each geo.yTicks as v (v)}
			<line x1={m.l} x2={W - m.r} y1={geo.y(v)} y2={geo.y(v)} stroke="var(--chart-grid)" shape-rendering="crispEdges" />
			<text x={W - m.r + 8} y={geo.y(v) + 4} class="num fill-muted-foreground text-xs">{fmt(v)}</text>
		{/each}
		{#each geo.xTicks as tv, i (i)}
			<line x1={geo.x(tv)} x2={geo.x(tv)} y1={m.t} y2={height - m.b} stroke="var(--chart-grid)" shape-rendering="crispEdges" />
			<text
				x={geo.x(tv)}
				y={height - 7}
				text-anchor={i === 0 ? 'start' : i === geo.xTicks.length - 1 ? 'end' : 'middle'}
				class="fill-muted-foreground text-xs">{fmtDate(tv)}</text
			>
		{/each}
		<!-- holding periods -->
		{#each spans as [a, b], i (i)}
			<rect x={geo.x(a)} y={m.t} width={Math.max(1.5, geo.x(b) - geo.x(a))} height={height - m.b - m.t} fill="var(--holding-wash)" />
		{/each}
		<!-- split marker -->
		<line x1={geo.x(split)} x2={geo.x(split)} y1={m.t - 16} y2={height - m.b} stroke="var(--subtle-foreground)" shape-rendering="crispEdges" />
		<text x={geo.x(split) - 6} y={m.t - 6} text-anchor="end" class="fill-muted-foreground text-xs">Seen</text>
		<text x={geo.x(split) + 6} y={m.t - 6} class="fill-foreground text-xs font-semibold">Never seen</text>
		<!-- candles -->
		{#each candles.time as t, i (t)}
			{@const up = candles.close[i] >= candles.open[i]}
			{@const cx = geo.x(t + step / 2)}
			{@const yo = geo.y(candles.open[i])}
			{@const yc = geo.y(candles.close[i])}
			<line x1={cx} x2={cx} y1={geo.y(candles.high[i])} y2={geo.y(candles.low[i])} stroke={up ? 'var(--candle-up)' : 'var(--candle-down)'} stroke-width="1.2" />
			<rect
				x={cx - geo.body / 2}
				y={Math.min(yo, yc)}
				width={geo.body}
				height={Math.max(1, Math.abs(yc - yo))}
				rx="1"
				fill={up ? 'var(--candle-up)' : 'var(--candle-down)'}
			/>
		{/each}
		{#if hover !== null}
			{@const cx = geo.x(candles.time[hover] + step / 2)}
			<line x1={cx} x2={cx} y1={m.t} y2={height - m.b} stroke="var(--muted-foreground)" stroke-width="1" shape-rendering="crispEdges" />
			<line x1={m.l} x2={W - m.r} y1={geo.y(candles.close[hover])} y2={geo.y(candles.close[hover])} stroke="var(--muted-foreground)" shape-rendering="crispEdges" />
			<rect x={W - m.r + 2} y={geo.y(candles.close[hover]) - 10} width={m.r - 4} height="20" rx="4" fill="var(--tooltip)" />
			<text x={W - m.r + 8} y={geo.y(candles.close[hover]) + 4} class="num fill-tooltip-foreground text-xs font-semibold">{fmt(candles.close[hover])}</text>
		{/if}
		<rect
			x={m.l}
			y="0"
			width={W - m.l - m.r}
			{height}
			fill="transparent"
			role="presentation"
			onpointermove={move}
			onpointerdown={move}
			onpointerleave={() => (hover = null)}
		/>
	</svg>
	{#if hover !== null}
		{@const i = hover}
		{@const up = candles.close[i] >= candles.open[i]}
		<div class="pointer-events-none absolute top-1 left-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md bg-card/90 px-2 py-1 text-xs backdrop-blur-sm">
			<span class="font-semibold">{fmtDateTime(candles.time[i])}</span>
			<span class="num text-muted-foreground">O <b class="font-semibold text-foreground">{candles.open[i].toFixed(decimals)}</b></span>
			<span class="num text-muted-foreground">H <b class="font-semibold text-foreground">{candles.high[i].toFixed(decimals)}</b></span>
			<span class="num text-muted-foreground">L <b class="font-semibold text-foreground">{candles.low[i].toFixed(decimals)}</b></span>
			<span class="num text-muted-foreground"
				>C <b class="font-semibold {up ? 'text-success-foreground' : 'text-danger-foreground'}">{candles.close[i].toFixed(decimals)}</b></span
			>
			<span class={holdingAt(candles.time[i]) ? 'font-semibold text-primary' : 'text-muted-foreground'}>
				{holdingAt(candles.time[i]) ? 'Holding' : 'In cash'}
			</span>
		</div>
	{/if}
</div>
