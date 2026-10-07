<script lang="ts">
	import BrandMark from './BrandMark.svelte';
	import Icon from './Icon.svelte';

	let { onHow }: { onHow: () => void } = $props();

	function toggleTheme() {
		const root = document.documentElement;
		const isDark = root.dataset.theme
			? root.dataset.theme === 'dark'
			: window.matchMedia('(prefers-color-scheme: dark)').matches;
		root.dataset.theme = isDark ? 'light' : 'dark';
		try {
			localStorage.setItem('lc-theme', root.dataset.theme);
		} catch {
			/* private mode: the choice lasts for this page only */
		}
	}
</script>

<header class="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
	<a href="./" class="inline-flex min-h-10 items-center gap-2.5 font-serif text-xl font-semibold no-underline">
		<BrandMark />
		<span>Lotcouncil</span>
	</a>
	<nav class="flex items-center gap-2" aria-label="Site">
		<button type="button" class="btn btn-secondary rounded-full font-medium text-subtle" onclick={onHow}>
			How this works
		</button>
		<button
			type="button"
			class="btn btn-secondary size-10 rounded-full p-0 text-subtle"
			onclick={toggleTheme}
			aria-label="Switch between light and dark mode"
		>
			<Icon name="moon" class="size-[18px]" />
		</button>
	</nav>
</header>
