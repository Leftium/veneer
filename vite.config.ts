import { paraglideVitePlugin } from '@inlang/paraglide-js'
import devtoolsJson from 'vite-plugin-devtools-json'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vitest/config'
import ggPlugins from '@leftium/gg/vite'

export default defineConfig({
	plugins: [
		sveltekit(),
		...ggPlugins(),
		devtoolsJson(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			strategy: ['cookie', 'preferredLanguage', 'baseLocale'],
		}),
	],
	css: {
		preprocessorOptions: {
			scss: {
				silenceDeprecations: ['if-function'],
			},
		},
	},
	test: {
		include: ['src/**/*.test.ts'],
	},
})
