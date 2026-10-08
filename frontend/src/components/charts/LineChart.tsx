import { useMemo, useState } from 'react';
import { fmtDate } from '@/lib/format';
import { useWidth } from '@/lib/useWidth';
import { extent, nearest, scale, ticks } from './geometry';

export interface Tip {
	head: string;
	value: string;
}

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

export function LineChart({ time, values, spans = [], split, splitLabels, zero = false, height = 220, yFormat, tip, label }: Props) {
	const { ref, width } = useWidth<HTMLDivElement>();
	const [hover, setHover] = useState<number | null>(null);

	const W = Math.max(260, width || 600);
	const m = { l: 46, r: 12, t: splitLabels ? 22 : 10, b: 24 };

	const geo = useMemo(() => {
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [time, values, W, height, zero, splitLabels]);

	function move(e: React.PointerEvent<SVGRectElement>) {
		const box = (e.currentTarget as SVGRectElement).ownerSVGElement!.getBoundingClientRect();
		const px = ((e.clientX - box.left) / box.width) * W;
		const t = time[0] + ((px - m.l) / (W - m.l - m.r)) * (time[time.length - 1] - time[0]);
		setHover(nearest(time, t));
	}

	const tipData = hover === null ? null : tip(hover);

	return (
		<div ref={ref} className="relative w-full touch-pan-y">
			<svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} role="img" aria-label={label} className="block overflow-visible">
				{split !== undefined && (
					<rect x={geo.x(split)} y={m.t} width={W - m.r - geo.x(split)} height={height - m.b - m.t} fill="var(--unseen-wash)" />
				)}
				{geo.yTicks.map((v) => (
					<g key={v}>
						<line x1={m.l} x2={W - m.r} y1={geo.y(v)} y2={geo.y(v)} stroke="var(--chart-grid)" shapeRendering="crispEdges" />
						<text x={m.l - 8} y={geo.y(v) + 4} textAnchor="end" className="num fill-muted-foreground text-xs">
							{yFormat(v)}
						</text>
					</g>
				))}
				{geo.xTicks.map((tv, i) => (
					<text
						key={i}
						x={geo.x(tv)}
						y={height - 6}
						textAnchor={i === 0 ? 'start' : i === geo.xTicks.length - 1 ? 'end' : 'middle'}
						className="fill-muted-foreground text-xs"
					>
						{fmtDate(tv)}
					</text>
				))}
				{zero && geo.lo < 0 && geo.hi > 0 && (
					<line x1={m.l} x2={W - m.r} y1={geo.y(0)} y2={geo.y(0)} stroke="var(--border)" shapeRendering="crispEdges" />
				)}
				{spans.map(([a, b], i) => (
					<rect key={i} x={geo.x(a)} y={m.t} width={Math.max(1, geo.x(b) - geo.x(a))} height={height - m.b - m.t} fill="var(--holding-wash)" />
				))}
				{split !== undefined && (
					<g>
						<line
							x1={geo.x(split)}
							x2={geo.x(split)}
							y1={m.t - (splitLabels ? 14 : 0)}
							y2={height - m.b}
							stroke="var(--subtle-foreground)"
							shapeRendering="crispEdges"
						/>
						{splitLabels && (
							<g>
								<text x={geo.x(split) - 6} y={12} textAnchor="end" className="fill-subtle text-xs">
									{splitLabels[0]}
								</text>
								<text x={geo.x(split) + 6} y={12} className="fill-foreground text-xs font-semibold">
									{splitLabels[1]}
								</text>
							</g>
						)}
					</g>
				)}
				<path d={geo.d} fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
				<circle
					cx={geo.x(time[geo.n - 1])}
					cy={geo.y(values[geo.n - 1])}
					r={4}
					fill="var(--chart-1)"
					stroke="var(--card)"
					strokeWidth={2}
				/>
				{hover !== null && (
					<g>
						<line
							x1={geo.x(time[hover])}
							x2={geo.x(time[hover])}
							y1={m.t}
							y2={height - m.b}
							stroke="var(--muted-foreground)"
							shapeRendering="crispEdges"
						/>
						<circle cx={geo.x(time[hover])} cy={geo.y(values[hover])} r={4.5} fill="var(--chart-1)" stroke="var(--card)" strokeWidth={2} />
					</g>
				)}
				<rect
					x={m.l}
					y={0}
					width={W - m.l - m.r}
					height={height}
					fill="transparent"
					role="presentation"
					onPointerMove={move}
					onPointerDown={move}
					onPointerLeave={() => setHover(null)}
				/>
			</svg>
			{tipData && hover !== null && (
				<div
					className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg bg-foreground px-2 py-1.5 text-xs leading-snug whitespace-nowrap text-background shadow-md"
					style={{ left: `clamp(70px, ${(geo.x(time[hover]) / W) * 100}%, calc(100% - 70px))`, top: geo.y(values[hover]) }}
				>
					{tipData.head}
					<br />
					<b className="font-semibold">{tipData.value}</b>
				</div>
			)}
		</div>
	);
}
