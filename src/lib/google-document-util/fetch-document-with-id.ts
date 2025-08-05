import { GCP_API_KEY } from '$env/static/private'
import { Result, err, ok } from 'neverthrow'
import { adjustGoogleFormData, parseGoogleForm } from './google-form'
import { adjustGoogleSheetData } from './google-sheets'
import type { GoogleSheet, GoogleFormDocument, GoogleDocumentError } from './types'
import { getGoogleDocumentId, urlFromVeneerId, DOCUMENT_URL_REGEX } from './url-id'

export async function fetchWithDocumentId(
	documentId?: string,
): Promise<Result<GoogleSheet | GoogleFormDocument, GoogleDocumentError>> {
	if (!documentId) {
		return err({ message: `DocumentId not set: <${documentId}>` })
	}

	const googleDocumentId = await getGoogleDocumentId(documentId)
	if (googleDocumentId.isErr()) {
		return err({ documentId, message: googleDocumentId.error.message })
	}

	const url = urlFromVeneerId(googleDocumentId.value.documentId)
	const type = DOCUMENT_URL_REGEX.s.test(url)
		? 'sheet'
		: DOCUMENT_URL_REGEX.f.test(url)
			? 'form'
			: undefined

	if (!type) {
		const message = `${googleDocumentId.value} not a Google form/sheet url: ${url}`
		return err({ documentId, type, message })
	}

	const fetched = await fetch(url.replace('GCP_API_KEY', GCP_API_KEY))
	if (!fetched.ok) {
		const message = `[${fetched.status}: ${fetched.statusText}] while fetching ${googleDocumentId.value} (${url}).`
		return err({ documentId, type, message })
	}

	const text = await fetched.text()

	if (type === 'sheet') {
		const dataSheet = adjustGoogleSheetData(JSON.parse(text))
		return dataSheet.isOk()
			? ok({
					type: 'sheet',
					documentId: googleDocumentId.value.documentId,
					veneerId: googleDocumentId.value.veneerId,
					...dataSheet.value,
				})
			: err(dataSheet.error)
	}

	return ok({
		type: 'form',
		documentId: googleDocumentId.value.documentId,
		veneerId: googleDocumentId.value.veneerId,
		...adjustGoogleFormData(parseGoogleForm(text)),
	})
}
