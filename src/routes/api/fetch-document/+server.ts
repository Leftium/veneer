import { json } from '@sveltejs/kit'

import { gg } from '$lib/gg.js'
import { GoogleDocument } from '$lib/GoogleDocument.svelte'

import { GCP_API_KEY } from '$env/static/private'
import { adjustGoogleSheetData, stripHidden, type GoogleSheetData } from '$lib/google-sheets'

export const GET = async ({ url, fetch }) => {
	const targetUrl = url.searchParams.get('u') || ''
	const unhideRows = url.searchParams.has('allrows')
	const unhideCols = url.searchParams.has('allcols')

	const documentDownload = new GoogleDocument(targetUrl)
	if (documentDownload.url) {
		try {
			const fetched = await fetch(documentDownload.url.replace('GCP_API_KEY', GCP_API_KEY))
			if (fetched.ok) {
				const contentType = fetched.headers.get('content-type')
				const googleDocument = new GoogleDocument(fetched.url)
				googleDocument.idShort = documentDownload.idShort
				googleDocument.text = await fetched.text()

				try {
					if (contentType?.includes('application/json')) {
						googleDocument.json = stripHidden(
							adjustGoogleSheetData(JSON.parse(googleDocument.text)) as GoogleSheetData,
							unhideRows,
							unhideCols,
						)
						//googleDocument.text = ''
					} else if (googleDocument.type === 'form') {
						const textSplit = googleDocument.text.split('FB_PUBLIC_LOAD_DATA_ = ')[1]
						if (textSplit) {
							const formData = textSplit.substring(0, textSplit.lastIndexOf(';'))
							googleDocument.json = JSON.parse(formData)
							//googleDocument.text = ''
						}
					}
				} catch (error) {
					gg({ error })
				}

				return json(googleDocument)
			} else {
				return json({ error: 'Fetch failure.' }, { status: fetched.status })
			}
		} catch (error) {
			gg({ error })
			return json({ error }, { status: 555 })
		}
	}

	return json(
		{
			error: 'something went wrong...',
		},
		{ status: 555 },
	)
}
