/** Flip between light and dark, remembering the choice (the page reads it before first paint). */
export function toggleTheme() {
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
