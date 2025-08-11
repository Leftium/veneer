import { GCP_API_KEY } from '$env/static/private'
import { Err, isOk, Ok, type Result } from 'wellcrafted/result'
import { adjustGoogleFormData, parseGoogleForm } from './google-form'
import { adjustGoogleSheetData } from './google-sheets'
import type { GoogleSheet, GoogleFormDocument, GoogleDocumentError } from './types'
import { getGoogleDocumentId, urlFromVeneerId, DOCUMENT_URL_REGEX } from './url-id'

export async function fetchWithDocumentId(
	documentId?: string,
): Promise<Result<GoogleSheet | GoogleFormDocument, GoogleDocumentError>> {
	if (!documentId) {
		return Err({ message: `DocumentId not set: <${documentId}>` })
	}

	const { data, error } = await getGoogleDocumentId(documentId)
	if (error) {
		return Err(error)
	}

	const url = urlFromVeneerId(data.documentId)
	const type = DOCUMENT_URL_REGEX.s.test(url)
		? 'sheet'
		: DOCUMENT_URL_REGEX.f.test(url)
			? 'form'
			: undefined

	if (!type) {
		const message = `${data.documentId} not a Google form/sheet url: ${url}`
		return Err({ documentId, type, message })
	}

	const fetched = await fetch(url.replace('GCP_API_KEY', GCP_API_KEY))
	if (!fetched.ok) {
		const message = `[${fetched.status}: ${fetched.statusText}] while fetching ${documentId} (${url}).`
		return Err({ documentId, type, message })
	}

	const text = await fetched.text()

	if (type === 'sheet') {
		const dataSheet = adjustGoogleSheetData(JSON.parse(text))
		return isOk(dataSheet)
			? Ok({
					type: 'sheet',
					documentId: data.documentId,
					veneerId: data.veneerId,
					...dataSheet.data,
				})
			: Err(dataSheet.error)
	}

	return Ok({
		type: 'form',
		documentId: data.documentId,
		veneerId: data.veneerId,
		...adjustGoogleFormData(parseGoogleForm(text)),
	})
}
