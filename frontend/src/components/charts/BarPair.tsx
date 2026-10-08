import { useWidth } from '@/lib/useWidth';
import { extent, roundedEnd, scale } from './geometry';

export interface BarRow {
	label: string;
	value: number;
	valueLabel: string;
	strong?: boolean;
}

interface Props {
	rows: BarRow[];
	label: string;
	dense?: boolean;
}

export function BarPair({ rows, label, dense = false }: Props) {
	const { ref, width } = useWidth<HTMLDivElement>();
	const W = Math.max(dense ? 150 : 220, width || 300);
	const rowH = dense ? 16 : 30;
	const gap = dense ? 6 : 10;
	const H = rows.length * (rowH + gap) + 18;

	const [lo0, hi0] = extent([rows.map((r) => r.value), [0]]);
	const pad = (hi0 - lo0) * 0.08;
	const labelW = Math.min(110, W * 0.36);
	const x = scale(Math.min(0, lo0 - pad), Math.max(0, hi0 + pad), labelW, W - (dense ? 10 : 56));

	return (
		<div ref={ref} className="w-full">
			<svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={label} className="block overflow-visible">
				{rows.map((row, i) => {
					const yy = 4 + i * (rowH + gap);
					const neg = row.value < 0;
					const bar = dense ? 10 : 18;
					return (
						<g key={row.label}>
							<text x={0} y={yy + rowH / 2 + 4} className={`fill-subtle ${dense ? 'text-[10px]' : 'text-xs'}`}>
								{row.label}
							</text>
							<path
								d={roundedEnd(x(0), x(row.value), yy + (rowH - bar) / 2, bar, dense ? 3 : 4)}
								fill="var(--chart-1)"
								opacity={row.strong ? 1 : 0.55}
							/>
							{!dense && (
								<text
									x={x(row.value) + (neg ? -6 : 6)}
									y={yy + rowH / 2 + 4}
									textAnchor={neg ? 'end' : 'start'}
									className="fill-foreground text-xs font-semibold tabular-nums"
								>
									{row.valueLabel}
								</text>
							)}
						</g>
					);
				})}
				<line x1={x(0)} x2={x(0)} y1={0} y2={H - 16} stroke="var(--subtle-foreground)" />
				<text x={x(0)} y={H - 3} textAnchor="middle" className={`fill-muted-foreground ${dense ? 'text-[9px]' : 'text-xs'}`}>
					0
				</text>
			</svg>
		</div>
	);
}
