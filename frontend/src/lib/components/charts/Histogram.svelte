<script lang="ts">
	import { extent, roundedTop, scale, ticks } from './geometry';

	interface Props {
		values: number[];
		marker: number;
		threshold: number;
		markerLabel: string;
		label: string;
		height?: number;
	}

	let { values, marker, threshold, markerLabel, label, height = 140 }: Props = $props();

	let width = $state(0);
	let hover: number | null = $state(null);
	const W = $derived(Math.max(220, width || 300));
	const m = { l: 8, r: 8, t: 26, b: 22 };

	const geo = $derived.by(() => {
		let [lo, hi] = extent([values, [marker, threshold]]);
		const pad = (hi - lo) * 0.05;
		lo -= pad;
		hi += pad;
		const x = scale(lo, hi, m.l, W - m.r);
		const bins = Math.max(10, Math.min(28, Math.floor((W - m.l - m.r) / 11)));
		const bw = (hi - lo) / bins;
		const counts = new Array(bins).fill(0);
		for (const v of values) counts[Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / bw)))]++;
		const y = scale(0, Math.max(...counts), height - m.b, m.t + 4);
		const bars = counts.map((c, i) => {
			const x0 = x(lo + i * bw) + 1;
			const x1 = x(lo + (i + 1) * bw) - 1;
			return { c, x0, x1, top: y(c), from: lo + i * bw, to: lo + (i + 1) * bw };
		});
		return { x, bars, xTicks: ticks(lo, hi, 4) };
	});

	const mx = $derived(geo.x(marker));
	const labelRight = $derived(mx > W * 0.62);
	const hot = $derived(hover === null ? null : geo.bars[hover]);
</script>

<div class="relative w-full" bind:clientWidth={width}>
	<svg viewBox="0 0 {W} {height}" width="100%" {height} role="img" aria-label={label} class="block overflow-visible">
		{#each geo.xTicks as v (v)}
			<text x={geo.x(v)} y={height - 6} text-anchor="middle" class="fill-muted-foreground text-xs tabular-nums"
				>{Math.round(v * 10) / 10}</text
			>
		{/each}
		<line x1={m.l} x2={W - m.r} y1={height - m.b + 0.5} y2={height - m.b + 0.5} stroke="var(--border)" />
		{#each geo.bars as bar, i (i)}
			{#if bar.c}
				<path
					d={roundedTop(bar.x0, bar.top, Math.max(1, bar.x1 - bar.x0), height - m.b - bar.top, 3)}
					fill={hover === i ? 'var(--chart-copies-hot)' : 'var(--chart-copies)'}
				/>
				<rect
					x={bar.x0 - 1}
					y={m.t}
					width={bar.x1 - bar.x0 + 2}
					height={height - m.b - m.t}
					fill="transparent"
					role="presentation"
					onpointerenter={() => (hover = i)}
					onpointerdown={() => (hover = i)}
					onpointerleave={() => (hover = null)}
				/>
			{/if}
		{/each}
		<line x1={geo.x(threshold)} x2={geo.x(threshold)} y1={m.t - 2} y2={height - m.b} stroke="var(--subtle-foreground)" />
		<line x1={mx} x2={mx} y1={m.t - 2} y2={height - m.b} stroke="var(--foreground)" stroke-width="1.5" />
		<circle cx={mx} cy={m.t - 2} r="5" fill="var(--chart-1)" stroke="var(--card)" stroke-width="2" />
		<text x={mx + (labelRight ? -9 : 9)} y={m.t - 10} text-anchor={labelRight ? 'end' : 'start'} class="fill-foreground text-xs font-semibold"
			>{markerLabel}</text
		>
	</svg>
	{#if hot}
		<div
			class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-lg bg-tooltip px-2 py-1.5 text-xs whitespace-nowrap text-tooltip-foreground shadow-md"
			style="left: clamp(80px, {(((hot.x0 + hot.x1) / 2) / W) * 100}%, calc(100% - 80px)); top: {hot.top}px"
		>
			<b class="font-semibold">{hot.c}</b> cop{hot.c === 1 ? 'y' : 'ies'} scored {hot.from.toFixed(2)} to {hot.to.toFixed(2)}
		</div>
	{/if}
</div>
