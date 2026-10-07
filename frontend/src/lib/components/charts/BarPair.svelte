<script lang="ts">
	import { extent, roundedEnd, scale } from './geometry';

	interface Row {
		label: string;
		value: number;
		valueLabel: string;
		strong: boolean;
	}

	let { rows, label }: { rows: Row[]; label: string } = $props();

	let width = $state(0);
	const W = $derived(Math.max(220, width || 300));
	const rowH = 30;
	const gap = 10;
	const H = $derived(rows.length * (rowH + gap) + 18);

	const geo = $derived.by(() => {
		const labelW = Math.min(110, W * 0.36);
		const anyNeg = rows.some((r) => r.value < 0);
		const anyPos = rows.some((r) => r.value > 0);
		const m = { l: labelW + (anyNeg ? 46 : 0), r: anyPos ? 46 : 12 };
		let [lo, hi] = extent([rows.map((r) => r.value), [0]]);
		lo = Math.min(lo, 0);
		hi = Math.max(hi, 0);
		return { x: scale(lo, hi, m.l, W - m.r) };
	});
</script>

<div class="w-full" bind:clientWidth={width}>
	<svg viewBox="0 0 {W} {H}" width="100%" height={H} role="img" aria-label={label} class="block overflow-visible">
		{#each rows as row, i (row.label)}
			{@const yy = 4 + i * (rowH + gap)}
			{@const neg = row.value < 0}
			<text x="0" y={yy + rowH / 2 + 4} class="fill-subtle text-xs">{row.label}</text>
			<path
				d={roundedEnd(geo.x(0), geo.x(row.value), yy + (rowH - 18) / 2, 18, 4)}
				fill="var(--chart-1)"
				opacity={row.strong ? 1 : 0.55}
			/>
			<text
				x={geo.x(row.value) + (neg ? -6 : 6)}
				y={yy + rowH / 2 + 4}
				text-anchor={neg ? 'end' : 'start'}
				class="fill-foreground text-xs font-semibold tabular-nums">{row.valueLabel}</text
			>
		{/each}
		<line x1={geo.x(0)} x2={geo.x(0)} y1="0" y2={H - 16} stroke="var(--subtle-foreground)" />
		<text x={geo.x(0)} y={H - 3} text-anchor="middle" class="fill-muted-foreground text-xs">0</text>
	</svg>
</div>
