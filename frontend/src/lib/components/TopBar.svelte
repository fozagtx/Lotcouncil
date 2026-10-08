<script lang="ts">
	import { toggleTheme } from '#lib/theme.js';
	import BrandMark from './BrandMark.svelte';
	import Icon from './Icon.svelte';
	import Button from './ui/Button.svelte';

	let { onhow }: { onhow: () => void } = $props();
</script>

<header class="relative z-30 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 lg:sticky lg:top-0">
	<div class="mx-auto flex h-11 max-w-[1760px] items-center gap-3 px-4 lg:gap-4 lg:px-5">
		<a href="./" class="flex shrink-0 items-center gap-2 rounded-md" aria-label="Lotcouncil home">
			<BrandMark class="size-6" />
			<span class="font-display text-sm font-semibold tracking-tight">Lotcouncil</span>
		</a>
		<span class="flex-1"></span>

		<div class="flex shrink-0 items-center gap-1.5">
			<Button variant="outline" size="sm" onclick={onhow} aria-label="How it works">
				<Icon name="book" /><span class="hidden sm:inline">How it works</span>
			</Button>
			<Button variant="ghost" size="icon" class="size-8" aria-label="Switch between light and dark mode" onclick={toggleTheme}>
				<Icon name="moon" class="size-4 dark:hidden" />
				<Icon name="sun" class="hidden size-4 dark:block" />
			</Button>
		</div>
	</div>
</header>
