import { json } from '@sveltejs/kit'

import { DocumentId, type DocumentText } from '$lib/common'
import { gg } from '$lib/gg.js'
import { stringify } from '$lib/util.js'

export const GET = async ({ url, fetch }) => {
	const targetUrl = url.searchParams.get('u') || ''

	const documentText: DocumentText = new DocumentId(targetUrl)

	try {
		const fetched = await fetch(documentText.url)
		documentText.status = fetched.status

		if (fetched.ok) {
			documentText.text = await fetched.text()

			const documentIdScan = new DocumentId(fetched.url)
			documentText.idForm = documentIdScan.idForm
			documentText.idSheet = documentIdScan.idSheet
		} else {
			documentText.status = fetched.status
			documentText.text = fetched.statusText
		}
	} catch (error) {
		gg({ error })
		documentText.status = 555
		documentText.text = stringify(error)
	}

	return json(documentText)
}
