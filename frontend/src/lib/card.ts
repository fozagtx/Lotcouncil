// The shareable verdict card: a 1200x630 image drawn on a canvas.
import { feeLabel, fmtLongDate, pct, score } from './format';
import type { CourtResult } from './court';

const W = 1200;
const H = 630;
const SANS = '"Inter Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const MONO = '"JetBrains Mono Variable", ui-monospace, Menlo, monospace';

/** Card colours. The card is always light so it reads the same in every feed. */
const C = {
	bg: '#f3f4f6',
	card: '#ffffff',
	ink: '#0f172a',
	ink2: '#334155',
	muted: '#5b6577',
	line: '#e5e7eb',
	pass: '#12957a',
	passInk: '#0b7a63',
	passBg: '#e6f6f1',
	fail: '#e5383b',
	failInk: '#c81e2c',
	failBg: '#fdecee',
	skip: '#8b95a7',
	series: '#2563eb',
	brand: '#ea580c',
	onBrand: '#ffffff',
	rail: '#0f1729'
};

type MarkState = 'pass' | 'fail' | 'skip';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
	const words = text.split(/\s+/).filter(Boolean);
	const lines: string[] = [];
	let line = '';
	for (const w of words) {
		const next = line ? `${line} ${w}` : w;
		if (ctx.measureText(next).width > maxWidth && line) {
			lines.push(line);
			line = w;
			if (lines.length === maxLines) break;
		} else line = next;
	}
	if (lines.length < maxLines && line) lines.push(line);
	if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) {
		let last = lines[maxLines - 1];
		while (ctx.measureText(last + '…').width > maxWidth && last.length) last = last.slice(0, -1);
		lines[maxLines - 1] = last.replace(/[\s,.;:]+$/, '') + '…';
	}
	return lines;
}

function mark(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, state: MarkState) {
	ctx.fillStyle = state === 'pass' ? C.pass : state === 'fail' ? C.fail : C.skip;
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = '#fff';
	ctx.lineWidth = 3.2;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	ctx.beginPath();
	if (state === 'pass') {
		ctx.moveTo(x - r * 0.42, y + r * 0.02);
		ctx.lineTo(x - r * 0.1, y + r * 0.34);
		ctx.lineTo(x + r * 0.45, y - r * 0.3);
	} else if (state === 'fail') {
		ctx.moveTo(x - r * 0.36, y - r * 0.36);
		ctx.lineTo(x + r * 0.36, y + r * 0.36);
		ctx.moveTo(x + r * 0.36, y - r * 0.36);
		ctx.lineTo(x - r * 0.36, y + r * 0.36);
	} else {
		ctx.moveTo(x - r * 0.4, y);
		ctx.lineTo(x + r * 0.4, y);
	}
	ctx.stroke();
}

export function testSummary(r: CourtResult): Record<'A' | 'B' | 'C', string | null> {
	const t = r.ruling.tests;
	return {
		A: t.A ? `Score ${score(t.A.score_unseen)} on never-seen data (needs > ${t.A.threshold})` : null,
		B: t.B ? `Beat ${pct(t.B.beat_share_pct)} of ${t.B.copies} random copies (needs ${pct(t.B.threshold_pct)})` : null,
		C: t.C
			? `Score ${score(t.C.score_stress)} at ${t.C.stress_fee_mult}x fees, ${t.C.weekend_passed ? 'weekends OK' : 'weekend losses too big'}`
			: null
	};
}

export function drawCard(r: CourtResult): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext('2d')!;
	const pass = r.ruling.verdict === 'PASS';

	ctx.fillStyle = C.bg;
	ctx.fillRect(0, 0, W, H);
	roundRect(ctx, 28, 28, W - 56, H - 56, 28);
	ctx.fillStyle = C.card;
	ctx.fill();
	ctx.strokeStyle = C.line;
	ctx.lineWidth = 2;
	ctx.stroke();
	ctx.save();
	roundRect(ctx, 28, 28, W - 56, H - 56, 28);
	ctx.clip();
	ctx.fillStyle = pass ? C.pass : C.fail;
	ctx.fillRect(28, 28, 12, H - 56);
	ctx.restore();

	// Faint price line beside the test rows.
	const close = r.chart.close;
	if (close.length > 2) {
		const [xs, xe, ys, ye] = [960, W - 72, 515, 395];
		const lo = Math.min(...close);
		const hi = Math.max(...close);
		ctx.strokeStyle = C.series;
		ctx.globalAlpha = 0.35;
		ctx.lineWidth = 2.5;
		ctx.lineJoin = 'round';
		ctx.beginPath();
		close.forEach((v, i) => {
			const px = xs + ((xe - xs) * i) / (close.length - 1);
			const py = ys + ((v - lo) / (hi - lo || 1)) * (ye - ys);
			if (i) ctx.lineTo(px, py);
			else ctx.moveTo(px, py);
		});
		ctx.stroke();
		ctx.globalAlpha = 1;
	}

	// Brand
	roundRect(ctx, 72, 66, 40, 40, 11);
	ctx.fillStyle = C.brand;
	ctx.fill();
	ctx.strokeStyle = C.onBrand;
	ctx.lineWidth = 2.4;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(81, 79);
	ctx.lineTo(103, 79);
	ctx.moveTo(92, 75);
	ctx.lineTo(92, 98);
	ctx.moveTo(85, 98);
	ctx.lineTo(99, 98);
	ctx.stroke();
	ctx.fillStyle = C.brand;
	ctx.font = `800 26px ${SANS}`;
	ctx.textBaseline = 'middle';
	ctx.letterSpacing = '4px';
	ctx.fillText('LOTCOUNCIL', 126, 87);
	ctx.letterSpacing = '0px';
	ctx.font = `500 22px ${SANS}`;
	ctx.fillStyle = C.muted;
	ctx.textAlign = 'right';
	ctx.fillText(`Ruled on data to ${fmtLongDate(r.market.end)}`, W - 72, 87);
	ctx.textAlign = 'left';

	// Stamp
	ctx.save();
	ctx.translate(270, 230);
	ctx.rotate((-3 * Math.PI) / 180);
	roundRect(ctx, -190, -78, 380, 156, 22);
	ctx.fillStyle = pass ? C.passBg : C.failBg;
	ctx.fill();
	ctx.lineWidth = 7;
	ctx.strokeStyle = pass ? C.pass : C.fail;
	ctx.stroke();
	ctx.fillStyle = pass ? C.passInk : C.failInk;
	ctx.font = `800 112px ${SANS}`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(r.ruling.verdict, 0, 8);
	ctx.restore();

	// Headline, idea, market
	const tx = 510;
	const tw = W - tx - 72;
	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = C.ink;
	ctx.font = `700 36px ${SANS}`;
	let y = 190;
	for (const l of wrap(ctx, r.ruling.headline, tw, 2)) {
		ctx.fillText(l, tx, y);
		y += 46;
	}
	ctx.font = `400 25px ${SANS}`;
	ctx.fillStyle = C.ink2;
	y += 6;
	for (const l of wrap(ctx, r.idea ? `“${r.idea}”` : r.ruling.rule_text, tw, 3)) {
		ctx.fillText(l, tx, y);
		y += 34;
	}
	const meta = `${r.market.label} · ${r.market.days_available} days of hourly candles · fee ${feeLabel(100 * r.request.fee)}`;
	ctx.font = `500 20px ${SANS}`;
	ctx.fillStyle = C.muted;
	y = Math.max(y + 8, 320);
	for (const l of wrap(ctx, meta, tw, 2)) {
		ctx.fillText(l, tx, y);
		y += 26;
	}

	// Tests
	const summary = testSummary(r);
	const rows: ['A' | 'B' | 'C', string][] = [
		['A', 'Unseen data'],
		['B', 'Random timing'],
		['C', 'Stress']
	];
	let ry = 420;
	for (const [k, name] of rows) {
		const t = r.ruling.tests[k];
		mark(ctx, 92, ry - 8, 15, !t ? 'skip' : t.passed ? 'pass' : 'fail');
		ctx.fillStyle = C.ink;
		ctx.font = `650 25px ${SANS}`;
		ctx.fillText(`${k}  ${name}`, 122, ry);
		ctx.font = `400 21px ${SANS}`;
		ctx.fillStyle = C.ink2;
		ctx.fillText(wrap(ctx, summary[k] ?? 'Not run: too few trades to judge', 534, 1)[0] ?? '', 400, ry);
		ry += 50;
	}

	ctx.font = `400 18px ${SANS}`;
	ctx.fillStyle = C.muted;
	ctx.fillText(
		pass ? 'Not obviously luck on this history. Not a prediction, not advice.' : 'Fixed-code verdict. Not advice.',
		72,
		H - 58
	);
	ctx.textAlign = 'right';
	ctx.font = `400 16px ${MONO}`;
	ctx.fillText(`${r.market.hash.slice(0, 19)}…`, W - 72, H - 58);
	return canvas;
}

/** Copy the card image, or share it on phones, or download it. */
export async function shareCard(r: CourtResult): Promise<'copied' | 'shared' | 'downloaded' | 'cancelled'> {
	const canvas = drawCard(r);
	// Hand the clipboard a promise right away: Safari needs the write inside the tap.
	const blobPromise = new Promise<Blob>((res, rej) =>
		canvas.toBlob((b) => (b ? res(b) : rej(new Error('no image'))), 'image/png')
	);
	const name = `lotcouncil-${r.ruling.verdict.toLowerCase()}.png`;
	try {
		if (navigator.clipboard && 'ClipboardItem' in window) {
			await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]);
			return 'copied';
		}
	} catch {
		/* fall through */
	}
	const blob = await blobPromise;
	try {
		const file = new File([blob], name, { type: 'image/png' });
		if (navigator.canShare?.({ files: [file] })) {
			await navigator.share({ files: [file], title: 'Lotcouncil ruling' });
			return 'shared';
		}
	} catch (e) {
		if ((e as Error).name === 'AbortError') return 'cancelled';
	}
	downloadBlob(blob, name);
	return 'downloaded';
}

export function downloadBlob(blob: Blob, name: string) {
	const a = document.createElement('a');
	a.href = URL.createObjectURL(blob);
	a.download = name;
	document.body.appendChild(a);
	a.click();
	setTimeout(() => {
		URL.revokeObjectURL(a.href);
		a.remove();
	}, 1000);
}
