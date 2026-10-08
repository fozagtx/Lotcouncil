<script lang="ts" module>
	export interface Tip {
		head: string;
		value: string;
	}
</script>

<script lang="ts">
	import { fmtDate } from '#lib/format.js';
	import { extent, nearest, scale, ticks } from './geometry';

	interface Props {
		time: number[];
		values: number[];
		/** Periods to shade, as [start, end] times. */
		spans?: [number, number][];
		/** Time where the never-seen part starts. */
		split?: number;
		splitLabels?: [string, string];
		zero?: boolean;
		height?: number;
		yFormat: (v: number) => string;
		tip: (i: number) => Tip;
		label: string;
	}

	let { time, values, spans = [], split, splitLabels, zero = false, height = 220, yFormat, tip, label }: Props = $props();

	let width = $state(0);
	let hover: number | null = $state(null);

	const W = $derived(Math.max(260, width || 600));
	const m = $derived({ l: 46, r: 12, t: splitLabels ? 22 : 10, b: 24 });

	const geo = $derived.by(() => {
		const n = time.length;
		const x = scale(time[0], time[n - 1], m.l, W - m.r);
		const [lo0, hi0] = extent(zero ? [values, [0]] : [values]);
		const pad = (hi0 - lo0) * 0.06;
		const y = scale(lo0 - pad, hi0 + pad, height - m.b, m.t);
		const yTicks = ticks(lo0 - pad, hi0 + pad, 4);
		const every = Math.max(1, Math.round((W - m.l - m.r) / 120));
		const span = time[n - 1] - time[0];
		const xTicks = Array.from({ length: every + 1 }, (_, i) => time[0] + (span * i) / every);
		let d = '';
		values.forEach((v, i) => (d += (i ? 'L' : 'M') + x(time[i]).toFixed(1) + ',' + y(v).toFixed(1)));
		return { x, y, yTicks, xTicks, d, n, lo: lo0 - pad, hi: hi0 + pad };
	});

	function move(e: PointerEvent) {
		const box = (e.currentTarget as SVGRectElement).ownerSVGElement!.getBoundingClientRect();
		const px = ((e.clientX - box.left) / box.width) * W;
		const t = time[0] + ((px - m.l) / (W - m.l - m.r)) * (time[time.length - 1] - time[0]);
		hover = nearest(time, t);
	}

	const tipData = $derived(hover === null ? null : tip(hover));
</script>

<div class="relative w-full touch-pan-y" bind:clientWidth={width}>
	<svg viewBox="0 0 {W} {height}" width="100%" {height} role="img" aria-label={label} class="block overflow-visible">
		{#if split !== undefined}
			<rect x={geo.x(split)} y={m.t} width={W - m.r - geo.x(split)} height={height - m.b - m.t} fill="var(--unseen-wash)" />
		{/if}
		{#each geo.yTicks as v (v)}
			<line x1={m.l} x2={W - m.r} y1={geo.y(v)} y2={geo.y(v)} stroke="var(--chart-grid)" shape-rendering="crispEdges" />
			<text x={m.l - 8} y={geo.y(v) + 4} text-anchor="end" class="num fill-muted-foreground text-xs">{yFormat(v)}</text>
		{/each}
		{#each geo.xTicks as tv, i (i)}
			<text
				x={geo.x(tv)}
				y={height - 6}
				text-anchor={i === 0 ? 'start' : i === geo.xTicks.length - 1 ? 'end' : 'middle'}
				class="fill-muted-foreground text-xs">{fmtDate(tv)}</text
			>
		{/each}
		{#if zero && geo.lo < 0 && geo.hi > 0}
			<line x1={m.l} x2={W - m.r} y1={geo.y(0)} y2={geo.y(0)} stroke="var(--border)" shape-rendering="crispEdges" />
		{/if}
		{#each spans as [a, b], i (i)}
			<rect x={geo.x(a)} y={m.t} width={Math.max(1, geo.x(b) - geo.x(a))} height={height - m.b - m.t} fill="var(--holding-wash)" />
		{/each}
		{#if split !== undefined}
			{@const sx = geo.x(split)}
			<line x1={sx} x2={sx} y1={m.t - (splitLabels ? 14 : 0)} y2={height - m.b} stroke="var(--subtle-foreground)" shape-rendering="crispEdges" />
			{#if splitLabels}
				<text x={sx - 6} y="12" text-anchor="end" class="fill-subtle text-xs">{splitLabels[0]}</text>
				<text x={sx + 6} y="12" class="fill-foreground text-xs font-semibold">{splitLabels[1]}</text>
			{/if}
		{/if}
		<path d={geo.d} fill="none" stroke="var(--chart-1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
		<circle cx={geo.x(time[geo.n - 1])} cy={geo.y(values[geo.n - 1])} r="4" fill="var(--chart-1)" stroke="var(--card)" stroke-width="2" />
		{#if hover !== null}
			{@const cx = geo.x(time[hover])}
			<line x1={cx} x2={cx} y1={m.t} y2={height - m.b} stroke="var(--muted-foreground)" shape-rendering="crispEdges" />
			<circle {cx} cy={geo.y(values[hover])} r="4.5" fill="var(--chart-1)" stroke="var(--card)" stroke-width="2" />
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
	{#if tipData && hover !== null}
		{@const left = (geo.x(time[hover]) / W) * 100}
		<div
			class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg bg-tooltip px-2 py-1.5 text-xs leading-snug whitespace-nowrap text-tooltip-foreground shadow-md"
			style="left: clamp(70px, {left}%, calc(100% - 70px)); top: {geo.y(values[hover])}px"
		>
			{tipData.head}<br /><b class="font-semibold">{tipData.value}</b>
		</div>
	{/if}
</div>
