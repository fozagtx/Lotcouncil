// Small helpers shared by the hand-drawn SVG charts.

export const scale = (d0: number, d1: number, r0: number, r1: number) => {
	const span = d1 - d0 || 1;
	return (v: number) => r0 + ((v - d0) * (r1 - r0)) / span;
};

function niceStep(span: number, count: number) {
	const raw = span / Math.max(1, count);
	const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
	const norm = raw / mag;
	return (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
}

export function ticks(min: number, max: number, count: number): number[] {
	const step = niceStep(max - min, count);
	const out: number[] = [];
	for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(+v.toFixed(10));
	return out;
}

export function extent(arrays: number[][]): [number, number] {
	let lo = Infinity;
	let hi = -Infinity;
	for (const a of arrays) {
		for (const v of a) {
			if (v < lo) lo = v;
			if (v > hi) hi = v;
		}
	}
	if (!Number.isFinite(lo)) return [0, 1];
	if (lo === hi) return [lo - 1, hi + 1];
	return [lo, hi];
}

/** Index of the value in a sorted array closest to x. */
export function nearest(sorted: number[], x: number): number {
	let lo = 0;
	let hi = sorted.length - 1;
	while (hi - lo > 1) {
		const mid = (lo + hi) >> 1;
		if (sorted[mid] < x) lo = mid;
		else hi = mid;
	}
	return Math.abs(sorted[lo] - x) <= Math.abs(sorted[hi] - x) ? lo : hi;
}

/** A column rounded at the top (the data end) and square at the baseline. */
export function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
	if (h <= 0) return '';
	r = Math.min(r, w / 2, h);
	return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** A horizontal bar from x0 (the baseline) to x1, rounded at the data end only. */
export function roundedEnd(x0: number, x1: number, y: number, h: number, r: number): string {
	const w = Math.abs(x1 - x0);
	if (w < 0.5) return '';
	r = Math.min(r, w, h / 2);
	if (x1 >= x0)
		return `M${x0},${y}H${x1 - r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 - r},${y + h}H${x0}Z`;
	return `M${x0},${y}H${x1 + r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 + r},${y + h}H${x0}Z`;
}
