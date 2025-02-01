import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

import openInEditorPlugin from './src/lib/open-in-editor'

export default defineConfig({
	plugins: [sveltekit(), openInEditorPlugin()],
	esbuild: {
		supported: {
			'top-level-await': true, //browsers can handle top-level-await features
		},
	},
})
