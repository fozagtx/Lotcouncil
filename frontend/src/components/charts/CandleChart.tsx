import { useMemo, useState } from 'react';
import { fmtDate, fmtDateTime } from '@/lib/format';
import type { Candles } from '@/lib/types';
import { useWidth } from '@/lib/useWidth';
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

export function CandleChart({ candles, spans, split, height = 320, label }: Props) {
	const { ref, width } = useWidth<HTMLDivElement>();
	const [hover, setHover] = useState<number | null>(null);

	const W = Math.max(280, width || 700);
	const m = { l: 8, r: 58, t: 24, b: 26 };
	const step = candles.hours * 3600;

	const geo = useMemo(() => {
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [candles, W, height]);

	const decimals = (() => {
		const last = candles.close[candles.close.length - 1] ?? 100;
		return last >= 100 ? 2 : last >= 1 ? 3 : 5;
	})();

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

	function move(e: React.PointerEvent<SVGRectElement>) {
		const box = (e.currentTarget as SVGRectElement).ownerSVGElement!.getBoundingClientRect();
		const px = ((e.clientX - box.left) / box.width) * W;
		const t = geo.t0 + ((px - m.l) / (W - m.l - m.r)) * (geo.t1 - geo.t0) - step / 2;
		setHover(nearest(candles.time, t));
	}

	const fmt = (v: number) => (v >= 1000 ? Math.round(v).toLocaleString('en-US') : v.toFixed(v >= 100 ? 1 : 2));

	return (
		<div ref={ref} className="relative w-full touch-pan-y">
			<div className="flex min-h-6 flex-wrap items-center gap-x-3 gap-y-0.5 px-1 text-xs" aria-hidden="true">
				{hover !== null && (
					<>
						<span className="font-semibold">{fmtDateTime(candles.time[hover])}</span>
						<span className="num text-muted-foreground">
							O <b className="font-semibold text-foreground">{candles.open[hover].toFixed(decimals)}</b>
						</span>
						<span className="num text-muted-foreground">
							H <b className="font-semibold text-foreground">{candles.high[hover].toFixed(decimals)}</b>
						</span>
						<span className="num text-muted-foreground">
							L <b className="font-semibold text-foreground">{candles.low[hover].toFixed(decimals)}</b>
						</span>
						<span className="num text-muted-foreground">
							C{' '}
							<b className={`font-semibold ${candles.close[hover] >= candles.open[hover] ? 'text-success-foreground' : 'text-danger-foreground'}`}>
								{candles.close[hover].toFixed(decimals)}
							</b>
						</span>
						<span className={holdingAt(candles.time[hover]) ? 'font-semibold text-primary' : 'text-muted-foreground'}>
							{holdingAt(candles.time[hover]) ? 'Holding' : 'In cash'}
						</span>
					</>
				)}
			</div>
			<svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} role="img" aria-label={label} className="block overflow-visible">
				<rect x={geo.x(split)} y={m.t} width={W - m.r - geo.x(split)} height={height - m.b - m.t} fill="var(--unseen-wash)" />
				{geo.yTicks.map((v) => (
					<g key={v}>
						<line x1={m.l} x2={W - m.r} y1={geo.y(v)} y2={geo.y(v)} stroke="var(--chart-grid)" shapeRendering="crispEdges" />
						<text x={W - m.r + 8} y={geo.y(v) + 4} className="num fill-muted-foreground text-xs">
							{fmt(v)}
						</text>
					</g>
				))}
				{geo.xTicks.map((tv, i) => (
					<g key={i}>
						<line x1={geo.x(tv)} x2={geo.x(tv)} y1={m.t} y2={height - m.b} stroke="var(--chart-grid)" shapeRendering="crispEdges" />
						<text
							x={geo.x(tv)}
							y={height - 7}
							textAnchor={i === 0 ? 'start' : i === geo.xTicks.length - 1 ? 'end' : 'middle'}
							className="fill-muted-foreground text-xs"
						>
							{fmtDate(tv)}
						</text>
					</g>
				))}
				{spans.map(([a, b], i) => (
					<rect key={i} x={geo.x(a)} y={m.t} width={Math.max(1.5, geo.x(b) - geo.x(a))} height={height - m.b - m.t} fill="var(--holding-wash)" />
				))}
				<line x1={geo.x(split)} x2={geo.x(split)} y1={m.t - 16} y2={height - m.b} stroke="var(--subtle-foreground)" shapeRendering="crispEdges" />
				<text x={geo.x(split) - 6} y={m.t - 6} textAnchor="end" className="fill-muted-foreground text-xs">
					Seen
				</text>
				<text x={geo.x(split) + 6} y={m.t - 6} className="fill-foreground text-xs font-semibold">
					Never seen
				</text>
				{candles.time.map((t, i) => {
					const up = candles.close[i] >= candles.open[i];
					const cx = geo.x(t + step / 2);
					const yo = geo.y(candles.open[i]);
					const yc = geo.y(candles.close[i]);
					return (
						<g key={t}>
							<line x1={cx} x2={cx} y1={geo.y(candles.high[i])} y2={geo.y(candles.low[i])} stroke={up ? 'var(--candle-up)' : 'var(--candle-down)'} strokeWidth={1.2} />
							<rect
								x={cx - geo.body / 2}
								y={Math.min(yo, yc)}
								width={geo.body}
								height={Math.max(1, Math.abs(yc - yo))}
								rx={1}
								fill={up ? 'var(--candle-up)' : 'var(--candle-down)'}
							/>
						</g>
					);
				})}
				{hover !== null && (
					<g>
						<line x1={geo.x(candles.time[hover] + step / 2)} x2={geo.x(candles.time[hover] + step / 2)} y1={m.t} y2={height - m.b} stroke="var(--muted-foreground)" strokeWidth={1} shapeRendering="crispEdges" />
						<line x1={m.l} x2={W - m.r} y1={geo.y(candles.close[hover])} y2={geo.y(candles.close[hover])} stroke="var(--muted-foreground)" shapeRendering="crispEdges" />
						<rect x={W - m.r + 2} y={geo.y(candles.close[hover]) - 10} width={m.r - 4} height={20} rx={4} fill="var(--foreground)" />
						<text x={W - m.r + 8} y={geo.y(candles.close[hover]) + 4} className="num fill-background text-xs font-semibold">
							{fmt(candles.close[hover])}
						</text>
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
		</div>
	);
}
