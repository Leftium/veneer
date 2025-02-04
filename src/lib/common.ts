function makeFetchSheetUrl(id: string) {
	const u = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${id}`)

	u.searchParams.set('ranges', 'A:ZZZ')
	u.searchParams.set(
		'fields',
		[
			'properties(title)',
			'sheets.properties(title)',
			'sheets.data(columnMetadata.hiddenByUser,rowMetadata.hiddenByUser)',
			'sheets.data.rowData.values(formattedValue,effectiveValue.numberValue,userEnteredFormat.numberFormat)',
		].join(','),
	)
	u.searchParams.set('key', 'GCP_API_KEY')

	return u.href
}

export function infoFromGoogleUrl(url: string, oldId = '') {
	const googleUrlRegex = {
		sheet:
			/^https:\/\/(docs.google.com|sheets.googleapis.com\/v4)\/spreadsheets\/(d\/(e\/)?)?(?<id>[^/]*)/,
		form: /^https:\/\/((forms.gle\/)|(docs.google.com\/forms\/d\/e\/))(?<id>[^/]*)/,
	}

	let type = 'unknown'
	let id = ''
	let urlCanonical = ''
	let urlFetch = url

	let matches = url.match(googleUrlRegex.form)
	if (matches) {
		type = url.match('closedform') ? 'closedform' : 'form'
		id = matches.groups?.id || ''

		if (id.length === 56) {
			urlCanonical = `https://docs.google.com/forms/d/e/${id}/viewform`
		}

		// Prefer short id:
		id = oldId || id
	}

	matches = url.match(googleUrlRegex.sheet)
	if (matches) {
		type = 'sheet'
		id = matches.groups?.id || ''
		urlFetch = makeFetchSheetUrl(id)

		if (id.length === 44) {
			urlCanonical = `https://docs.google.com/spreadsheets/d/${id}`
		} else {
			type = 'publishedsheet'
		}
	}

	return { type, id, urlCanonical, urlFetch }
}
