import { paraglideVitePlugin } from '@inlang/paraglide-js'
import devtoolsJson from 'vite-plugin-devtools-json'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'


export default defineConfig({
	plugins: [
		sveltekit(),
		devtoolsJson(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
		}),
	],
	esbuild: {
		supported: {
			'top-level-await': true, //browsers can handle top-level-await features
		},
	},
})
