import { err, ok } from 'neverthrow'

const DOCUMENT_URL_REGEX = {
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

const DOCUMENT_ID_REGEX = /^(?<prefix>[sfgbh])\.(?<id>[a-zA-Z0-9_-]+)$/

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

export function urlFromDocumentId(documentId: string) {
	const [prefix, id] = documentId.split('.')

	if (prefix === 's' && id.length === 44) {
		return makeGoogleSheetUrl(id)
	}

	return URL_TEMPLATES[prefix].replace('{ID}', id)
}

// Extract Google document id from URL or veneer id.
// Follow shortened URL if necessary.
export async function getGoogleDocumentId(urlOrId: string) {
	let url = urlOrId

	const matches = urlOrId.match(DOCUMENT_ID_REGEX)
	if (matches) {
		const prefix = matches.groups?.prefix || ''
		const id = matches.groups?.id || ''
		if (prefix === 'f' || prefix === 's') {
			return ok(`${prefix}.${id}`)
		}

		url = URL_TEMPLATES[prefix].replaceAll('{ID}', id)
	}

	///gg(url)

	for (const [prefix, regex] of Object.entries(GOOGLE_FORM_OR_SHEET_REGEX)) {
		const matches = url.match(regex)
		if (matches) {
			return ok(`${prefix}.${matches.groups?.id || ''}`)
		}
	}

	const fetched = await fetch(`/api/final-url/?u=${url}`)
	const jsoned = await fetched.json()
	if (jsoned.status >= 400) {
		return err(`There was a problem fetching URL: ${url} (${jsoned.status}: ${jsoned.statusText})`)
	}

	if (jsoned.urlFinal) {
		for (const [prefix, regex] of Object.entries(GOOGLE_FORM_OR_SHEET_REGEX)) {
			const matches = jsoned.urlFinal.match(regex)
			if (matches) {
				return ok(`${prefix}.${matches.groups?.id || ''}`)
			}
		}
	}

	return err({ message: `Something went wrong... (${url})`, ...jsoned })
}
