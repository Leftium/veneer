import { paraglideVitePlugin } from '@inlang/paraglide-js'
import adapter from '@sveltejs/adapter-auto'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import devtoolsJson from 'vite-plugin-devtools-json'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vitest/config'
import ggPlugins from '@leftium/gg/vite'

export default defineConfig({
	plugins: [
		sveltekit({
			preprocess: [vitePreprocess()],
			adapter: adapter(),
			extensions: ['.svelte'],
			inspector: {
				toggleKeyCombo: 'alt-x',
				showToggleButton: 'always',
				toggleButtonPos: 'bottom-left',
			},
			onwarn: (warning, handler) => {
				if (
					warning.code === 'vite-plugin-svelte-preprocess-many-dependencies' &&
					warning.message.includes('open-props-scss')
				)
					return
				handler(warning)
			},
		}),
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
