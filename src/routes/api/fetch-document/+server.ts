import { json } from '@sveltejs/kit'

import { fetchDocumentServer } from './fetchDocument.js'

export const GET = async ({ url }) => {
	const targetUrl = url.searchParams.get('u') || ''
	const unhideRows = url.searchParams.has('allrows')
	const unhideCols = url.searchParams.has('allcols')

	return json(fetchDocumentServer(targetUrl, unhideRows, unhideCols))
}
