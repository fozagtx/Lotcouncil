<!-- Svelte port of VengeanceUI Button (MIT, github.com/Ashutoshx7/VengeanceUI). -->
<script lang="ts" module>
	import { cn } from './utils.js';

	export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
	export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

	const BASE =
		'cursor-pointer inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-[10px] text-sm font-medium transition-[color,background-color,box-shadow,transform] duration-200 ease-out outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground/50 disabled:shadow-none motion-safe:active:translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4 pointer-coarse:min-h-10';

	// AlignUI button: primary/neutral/error x filled/stroke/lighter/ghost.
	const VARIANTS: Record<ButtonVariant, string> = {
		default: 'bg-primary text-primary-foreground hover:bg-primary-hover',
		destructive: 'bg-destructive text-destructive-foreground hover:bg-red-700',
		outline:
			'bg-card text-subtle shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] ring-1 ring-border ring-inset hover:bg-muted hover:text-foreground hover:shadow-none hover:ring-transparent dark:ring-border-strong',
		secondary:
			'bg-muted text-subtle hover:bg-card hover:text-foreground hover:shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] hover:ring-1 hover:ring-border hover:ring-inset',
		ghost: 'bg-transparent text-subtle hover:bg-muted hover:text-foreground',
		link: 'text-primary underline-offset-4 hover:underline'
	};

	const SIZES: Record<ButtonSize, string> = {
		default: 'h-9 px-3.5',
		sm: 'h-8 rounded-lg px-2.5 text-xs',
		lg: 'h-10 px-4',
		icon: 'size-9 rounded-lg'
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
