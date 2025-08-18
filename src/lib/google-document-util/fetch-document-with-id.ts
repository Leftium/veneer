import { GCP_API_KEY } from '$env/static/private'
import { Err, isErr, isOk, Ok, type Result } from 'wellcrafted/result'
import { adjustGoogleFormData, parseGoogleForm } from './google-form'
import { adjustGoogleSheetData } from './google-sheets'
import type { GoogleSheet, GoogleFormDocument, GoogleDocumentError } from './types'
import { getGoogleDocumentId, urlFromVeneerId } from './url-id'
import { gg } from '@leftium/gg'

export async function fetchWithDocumentId(
	documentId?: string,
): Promise<Result<GoogleSheet | GoogleFormDocument, GoogleDocumentError>> {
	if (!documentId) {
		return Err({ message: `DocumentId not set: <${documentId}>` })
	}

	const { data: googleDocumentId, error } = await getGoogleDocumentId(documentId)
	if (error) {
		return Err(error)
	}
	const type = googleDocumentId.type

	const url = urlFromVeneerId(googleDocumentId.documentId)

	if (!googleDocumentId.type) {
		const message = `${googleDocumentId.documentId} not a Google form/sheet url: ${url}`
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
					documentId: googleDocumentId.documentId,
					veneerId: googleDocumentId.veneerId,
					...dataSheet.data,
				})
			: Err(dataSheet.error)
	}

	const dataForm = parseGoogleForm(text)

	if (isErr(dataForm)) {
		gg('ERROR', dataForm.error)
	}

	return isOk(dataForm)
		? Ok({
				type: 'form',
				documentId: googleDocumentId.documentId,
				veneerId: googleDocumentId.veneerId,
				...adjustGoogleFormData(dataForm.data),
			})
		: Err({ ...dataForm.error, type })
}
