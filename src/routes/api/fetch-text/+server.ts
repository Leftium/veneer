import { gg } from '$lib/gg.js'
import { json } from '@sveltejs/kit'

import { GCP_API_KEY } from '$env/static/private'

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
	u.searchParams.set('key', GCP_API_KEY)

	return u.href
}

function infoFromGoogleUrl(url: string) {
	const googleUrlRegex = {
		sheet:
			/^https:\/\/(docs.google.com|sheets.googleapis.com\/v4)\/spreadsheets\/(d\/(e\/)?)?(?<id>[^/]*)/,
		form: /^https:\/\/(docs.google.com\/forms\/d\/e\/)(?<id>[^/]*)/,
	}

	let type = 'unknown'
	let id = ''
	let urlCanonical = ''
	let urlFetch = url

	let matches = url.match(googleUrlRegex.form)
	if (matches) {
		type = 'form'
		id = matches.groups?.id || ''

		if (id.length === 56) {
			urlCanonical = `https://docs.google.com/forms/d/e/${id}/viewform`
		}
	}

	matches = url.match(googleUrlRegex.sheet)
	if (matches) {
		type = 'sheet'
		id = matches.groups?.id || ''
		urlFetch = makeFetchSheetUrl(id)

		if (id.length === 44) {
			urlCanonical = `https://docs.google.com/spreadsheets/d/${id}`
		}
	}

	return { type, id, urlCanonical, urlFetch }
}

export const GET = async ({ url, fetch }) => {
	const urls = url.searchParams.getAll('u')

	const data = await Promise.all(
		urls.map(async (url) => {
			let urlFetched = ''

			// eslint-disable-next-line prefer-const
			let { type, id, urlCanonical, urlFetch } = infoFromGoogleUrl(url)

			if (type === 'unknown') {
				const fetched = await fetch(urlFetch, { method: 'HEAD' })
				urlFetched = fetched.url
				;({ type, id, urlCanonical } = infoFromGoogleUrl(urlFetched))
			}

			return {
				type,
				id,
				idLength: id.length,
				url,
				urlFetch,
				urlFetched,
				urlCanonical,
			}
		}),
	)

	return json({ urls, data })
}
