import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// During `npm run dev`, API calls go to the Python court on port 8000.
const API = process.env.LOTCOUNCIL_API ?? 'http://127.0.0.1:8000';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
			},
			adapter: adapter({ pages: 'build', assets: 'build', strict: true })
		})
	],
	server: {
		proxy: { '/api': API }
	}
});
