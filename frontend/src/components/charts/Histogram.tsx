import { useMemo, useState } from 'react';
import { useWidth } from '@/lib/useWidth';
import { extent, roundedTop, scale, ticks } from './geometry';

interface Props {
	values: number[];
	marker: number;
	threshold: number;
	markerLabel: string;
	label: string;
	height?: number;
}

export function Histogram({ values, marker, threshold, markerLabel, label, height = 140 }: Props) {
	const { ref, width } = useWidth<HTMLDivElement>();
	const [hover, setHover] = useState<number | null>(null);
	const W = Math.max(220, width || 300);
	const m = { l: 8, r: 8, t: 26, b: 22 };

	const geo = useMemo(() => {
		let [lo, hi] = extent([values, [marker, threshold]]);
		const pad = (hi - lo) * 0.05;
		lo -= pad;
		hi += pad;
		const x = scale(lo, hi, m.l, W - m.r);
		const bins = Math.max(10, Math.min(28, Math.floor((W - m.l - m.r) / 11)));
		const bw = (hi - lo) / bins;
		const counts = new Array<number>(bins).fill(0);
		for (const v of values) counts[Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / bw)))]++;
		const y = scale(0, Math.max(...counts), height - m.b, m.t + 4);
		const bars = counts.map((c, i) => {
			const x0 = x(lo + i * bw) + 1;
			const x1 = x(lo + (i + 1) * bw) - 1;
			return { c, x0, x1, top: y(c), from: lo + i * bw, to: lo + (i + 1) * bw };
		});
		return { x, bars, xTicks: ticks(lo, hi, 4) };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [values, marker, threshold, W, height]);

	const mx = geo.x(marker);
	const labelRight = mx > W * 0.62;
	const hot = hover === null ? null : geo.bars[hover];

	return (
		<div ref={ref} className="relative w-full">
			<svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} role="img" aria-label={label} className="block overflow-visible">
				{geo.xTicks.map((v) => (
					<text key={v} x={geo.x(v)} y={height - 6} textAnchor="middle" className="fill-muted-foreground text-xs tabular-nums">
						{Math.round(v * 10) / 10}
					</text>
				))}
				<line x1={m.l} x2={W - m.r} y1={height - m.b + 0.5} y2={height - m.b + 0.5} stroke="var(--border)" />
				{geo.bars.map((bar, i) =>
					bar.c ? (
						<g key={i}>
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
								onPointerEnter={() => setHover(i)}
								onPointerDown={() => setHover(i)}
								onPointerLeave={() => setHover(null)}
							/>
						</g>
					) : null
				)}
				<line x1={geo.x(threshold)} x2={geo.x(threshold)} y1={m.t - 2} y2={height - m.b} stroke="var(--subtle-foreground)" />
				<line x1={mx} x2={mx} y1={m.t - 2} y2={height - m.b} stroke="var(--foreground)" strokeWidth={1.5} />
				<circle cx={mx} cy={m.t - 2} r={5} fill="var(--chart-1)" stroke="var(--card)" strokeWidth={2} />
				<text x={mx + (labelRight ? -9 : 9)} y={m.t - 10} textAnchor={labelRight ? 'end' : 'start'} className="fill-foreground text-xs font-semibold">
					{markerLabel}
				</text>
			</svg>
			{hot && (
				<div
					className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-lg bg-foreground px-2 py-1.5 text-xs whitespace-nowrap text-background shadow-md"
					style={{ left: `clamp(80px, ${((hot.x0 + hot.x1) / 2 / W) * 100}%, calc(100% - 80px))`, top: hot.top }}
				>
					<b className="font-semibold">{hot.c}</b> cop{hot.c === 1 ? 'y' : 'ies'} scored {hot.from.toFixed(2)} to {hot.to.toFixed(2)}
				</div>
			)}
		</div>
	);
}
