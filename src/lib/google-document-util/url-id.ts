import { Err, Ok } from 'wellcrafted/result'
import { finalUrl } from '../../routes/api/final-url/finalurl'
//import { gg } from '@leftium/gg'

// Definition of different ID types:

// Veneer ID: {prefix}.{id}

// DocumentId: {f|s}.{id} (subset of Veneer ID)

export const DOCUMENT_URL_REGEX = {
	// Google sheets
	s: /(?<beforeId>^https:\/\/(docs.google.com|sheets.googleapis.com\/v4)\/spreadsheets\/(d\/(e\/)?)?)(?<id>[^?/]+)/,
	// Google forms
	f: /(?<beforeId>^https:\/\/docs.google.com\/forms\/d\/e\/)(?<id>[^/]+)/,
	// Google forms shortened
	g: /(?<beforeId>^https:\/\/forms.gle\/)(?<id>[^/]+)/,
	// Bitly
	b: /(?<beforeId>^https:\/\/bit.ly\/)(?<id>[^/]+)/,
	// ShortUrl
	h: /(?<beforeId>^https:\/\/shorturl.at\/)(?<id>[^/]+)/,
}

const GOOGLE_FORM_OR_SHEET_REGEX = {
	s: DOCUMENT_URL_REGEX.s,
	f: DOCUMENT_URL_REGEX.f,
}

export const VENEER_ID_REGEX = /^(?<prefix>[sfgbh])\.(?<id>[a-zA-Z0-9_-]+)$/

export const URL_TEMPLATES: Record<string, string> = {
	s: 'https://docs.google.com/spreadsheets/d/{ID}',
	f: 'https://docs.google.com/forms/d/e/{ID}/viewform',
	g: 'https://forms.gle/{ID}',
	b: 'https://bit.ly/{ID}',
	h: 'https://shorturl.at/{ID}',
}

function makeGoogleSheetUrl(id: string) {
	const searchParams = new URLSearchParams({
		ranges: 'A:ZZZ',
		fields: [
			'properties(title,timeZone)',
			'sheets.properties(title)',
			'sheets.data(columnMetadata.hiddenByUser,rowMetadata.hiddenByUser)',
			'sheets.data.rowData.values(formattedValue,effectiveValue.numberValue,userEnteredFormat.numberFormat)',
		].join(','),
		key: 'GCP_API_KEY',
	})
	return `https://sheets.googleapis.com/v4/spreadsheets/${id}?${searchParams}`
}

export function urlFromVeneerId(veneerId: string, apiUrl = true) {
	const [prefix, id] = veneerId.split('.')

	if (apiUrl && prefix === 's' && id.length === 44) {
		return makeGoogleSheetUrl(id)
	}

	return URL_TEMPLATES[prefix].replace('{ID}', id)
}

export function googleDocumentIdFromUrl(url: string) {
	for (const [prefix, regex] of Object.entries(GOOGLE_FORM_OR_SHEET_REGEX)) {
		const matches = url.match(regex)
		if (matches) {
			return `${prefix}.${matches.groups?.id || ''}`
		}
	}
	return null
}

// Extract Google document id from URL or veneer id.
// Follow (shortened) URL redirect if necessary.
export async function getGoogleDocumentId(urlOrId: string) {
	let url = urlOrId
	let veneerId = null
	let documentId = null
	let type: 'sheet' | 'form' | undefined

	// First try to match a Veneer document id:
	const matches = urlOrId.match(VENEER_ID_REGEX)
	if (matches) {
		const prefix = matches.groups?.prefix || ''
		const id = matches.groups?.id || ''
		if (prefix === 'f' || prefix === 's') {
			documentId = `${prefix}.${id}`
			type = prefix === 'f' ? 'form' : 'sheet'
		}
		veneerId = `${prefix}.${id}`

		url = URL_TEMPLATES[prefix].replaceAll('{ID}', id)
	}

	if (!documentId) {
		// Then try to match a Google form/sheet URL:
		documentId = googleDocumentIdFromUrl(url)
	}

	if (!documentId && veneerId) {
		// Finally try any (shortened) URL redirects:
		const jsoned = await finalUrl(url)
		if (jsoned.urlFinal) {
			documentId = googleDocumentIdFromUrl(jsoned.urlFinal)
		}
	}

	if (documentId) {
		const url = urlFromVeneerId(documentId)
		type = DOCUMENT_URL_REGEX.s.test(url)
			? 'sheet'
			: DOCUMENT_URL_REGEX.f.test(url)
				? 'form'
				: undefined
		return Ok({ type, documentId, veneerId })
	}
	return Err({ message: `Unable to get Google document id for: (${url})`, type })
}
