<!-- Svelte port of VengeanceUI Button (MIT, github.com/Ashutoshx7/VengeanceUI). -->
<script lang="ts" module>
	import { cn } from './utils.js';

	export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
	export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

	const BASE =
		'cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,box-shadow,transform] duration-[var(--vng-transition-speed,150ms)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 motion-safe:active:translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4 pointer-coarse:min-h-10';

	const VARIANTS: Record<ButtonVariant, string> = {
		default: 'bg-primary text-primary-foreground shadow-sm shadow-black/20 hover:bg-primary-hover',
		destructive: 'bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90',
		outline: 'bg-card text-foreground shadow-sm shadow-black/15 ring-1 ring-foreground/10 hover:bg-muted/50 dark:ring-foreground/15',
		secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
		ghost: 'hover:bg-accent hover:text-accent-foreground',
		link: 'text-primary underline-offset-4 hover:underline'
	};

	const SIZES: Record<ButtonSize, string> = {
		default: 'h-9 px-4 py-2',
		sm: 'h-8 px-3 text-xs',
		lg: 'h-10 px-8',
		icon: 'size-9'
	};

	/** The class list for a button; also usable on links that should look like buttons. */
	export function buttonVariants({
		variant = 'default',
		size = 'default',
		class: className = ''
	}: { variant?: ButtonVariant; size?: ButtonSize; class?: string } = {}): string {
		return cn(BASE, VARIANTS[variant], SIZES[size], className);
	}
</script>

<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		variant?: ButtonVariant;
		size?: ButtonSize;
		ref?: HTMLButtonElement | null;
	}

	let { variant = 'default', size = 'default', class: className, type = 'button', ref = $bindable(null), children, ...rest }: Props =
		$props();
</script>

<button bind:this={ref} {type} data-slot="button" class={buttonVariants({ variant, size, class: className as string })} {...rest}>
	{@render children?.()}
</button>
