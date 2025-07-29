import { GCP_API_KEY } from '$env/static/private'
import { adjustGoogleFormData, parseGoogleForm } from '$lib/google-document-util/google-form'
import {
	adjustGoogleSheetData,
	stripHidden,
	type GoogleSheetData,
} from '$lib/google-document-util/google-sheets'
import { GoogleDocument } from '$lib/GoogleDocument.svelte'
import { gg } from '@leftium/gg'

import { err, ok } from 'neverthrow'

export async function fetchDocumentServer(
	targetUrl: string,
	unhideRows?: boolean,
	unhideCols?: boolean,
) {
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
						googleDocument.text = ''
					} else if (googleDocument.type === 'form') {
						googleDocument.json = adjustGoogleFormData(parseGoogleForm(googleDocument.text))
						googleDocument.text = ''
					}
				} catch (error) {
					gg({ error })
				}

				return ok(googleDocument)
			} else {
				return err({ error: 'Fetch failure.' })
			}
		} catch (error) {
			gg({ error })
			return err(error)
		}
	}
	return err(`Something went wrong...`)
}
