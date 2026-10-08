<!-- Lucide icons (the set VengeanceUI uses), by short name. -->
<script lang="ts" module>
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import ChartCandlestick from '@lucide/svelte/icons/chart-candlestick';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import Check from '@lucide/svelte/icons/check';
	import Clock from '@lucide/svelte/icons/clock';
	import Code from '@lucide/svelte/icons/code';
	import CornerDownLeft from '@lucide/svelte/icons/corner-down-left';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import FileDown from '@lucide/svelte/icons/file-down';
	import Gavel from '@lucide/svelte/icons/gavel';
	import History from '@lucide/svelte/icons/history';
	import Image from '@lucide/svelte/icons/image';
	import Link from '@lucide/svelte/icons/link';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Minus from '@lucide/svelte/icons/minus';
	import Moon from '@lucide/svelte/icons/moon';
	import RotateCw from '@lucide/svelte/icons/rotate-cw';
	import Scale from '@lucide/svelte/icons/scale';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Sun from '@lucide/svelte/icons/sun';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';
	import Zap from '@lucide/svelte/icons/zap';

	const ICONS = {
		arrow: ArrowRight,
		book: BookOpen,
		candles: ChartCandlestick,
		line: ChartLine,
		check: Check,
		clock: Clock,
		code: Code,
		enter: CornerDownLeft,
		external: ExternalLink,
		file: FileDown,
		gavel: Gavel,
		history: History,
		image: Image,
		link: Link,
		spinner: LoaderCircle,
		dash: Minus,
		moon: Moon,
		retry: RotateCw,
		scales: Scale,
		shield: ShieldCheck,
		sun: Sun,
		alert: TriangleAlert,
		x: X,
		close: X,
		bolt: Zap
	} as const;

	export type IconName = keyof typeof ICONS;
</script>

<script lang="ts">
	interface Props {
		name: IconName;
		class?: string;
		/** Accessible name; leave empty for decorative icons. */
		label?: string;
	}

	let { name, class: className = 'size-5', label }: Props = $props();

	const Glyph = $derived(ICONS[name]);
	const cls = $derived(name === 'spinner' ? `${className} animate-spin` : className);
</script>

{#if label}
	<Glyph class={cls} role="img" aria-label={label} />
{:else}
	<Glyph class={cls} />
{/if}
