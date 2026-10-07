// Number and date formatting shared by the page and the verdict card.

const MINUS = '−';
const minus = (s: string) => s.replace('-', MINUS);

export const int = (n: number) => Number(n).toLocaleString('en-US');
export const score = (x: number) => minus(Number(x).toFixed(2));
export const pct = (x: number) =>
	minus((Math.abs(x) >= 10 ? Number(x).toFixed(0) : Number(x).toFixed(1)).replace(/\.0$/, '')) + '%';
export const signedPct = (x: number, digits = 1) =>
	(x > 0 ? '+' : '') + minus(Number(x).toFixed(Math.abs(x) < 1 ? 2 : digits)) + '%';
export const feeLabel = (f: number) => Number(f).toFixed(2) + '%';

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const dateTimeFmt = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: 'numeric',
	hour: 'numeric',
	timeZone: 'UTC'
});
const longDateFmt = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: 'numeric',
	year: 'numeric',
	timeZone: 'UTC'
});

export const fmtDate = (seconds: number) => dateFmt.format(new Date(seconds * 1000));
export const fmtDateTime = (seconds: number) => dateTimeFmt.format(new Date(seconds * 1000)) + ' UTC';
export const fmtLongDate = (ms: number) => longDateFmt.format(new Date(ms));
