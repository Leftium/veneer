import type { Plugin } from 'vite'

// Based on: https://github.com/yyx990803/launch-editor/blob/master/packages/launch-editor-middleware/index.js

import * as url from 'url'
import * as path from 'path'
import launch from 'launch-editor'

export default function openInEditorPlugin(
	specifiedEditor?: undefined,
	srcRoot?: string | undefined,
	onErrorCallback?: unknown,
): Plugin {
	if (typeof specifiedEditor === 'function') {
		onErrorCallback = specifiedEditor
		specifiedEditor = undefined
	}

	if (typeof srcRoot === 'function') {
		onErrorCallback = srcRoot
		srcRoot = undefined
	}

	srcRoot = srcRoot || process.cwd()

	return {
		name: 'open-in-editor',
		configureServer(server) {
			server.middlewares.use('/__open-in-editor', (req, res) => {
				const { file } = url.parse(req.url || '', true).query || {}
				if (!file) {
					res.statusCode = 500
					res.end(`launch-editor-middleware: required query param "file" is missing.`)
				} else {
					res.statusCode = 222
					launch(path.resolve(srcRoot, file as string), specifiedEditor, onErrorCallback)
					res.end('<p>You may safely close this window.</p><script>window.close()</script>')
				}
			})
		},
	}
}
