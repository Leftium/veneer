import { paraglideVitePlugin } from '@inlang/paraglide-js'
import devtoolsJson from 'vite-plugin-devtools-json'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vitest/config'
import { openInEditorPlugin } from '@leftium/gg'

export default defineConfig({
	plugins: [
		sveltekit(),
		openInEditorPlugin(),
		devtoolsJson(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			strategy: ['cookie', 'preferredLanguage', 'baseLocale'],
		}),
	],
	test: {
		include: ['src/**/*.test.ts'],
	},
})
