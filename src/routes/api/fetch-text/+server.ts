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

// https://stackoverflow.com/a/16233621/117030
function excelDateToJsDate(serial: number) {
	const utc_days = Math.floor(serial - 25569)
	const utc_value = utc_days * 86400
	const date_info = new Date(utc_value * 1000)

	const fractional_day = serial - Math.floor(serial) + 0.0000001

	let total_seconds = Math.floor(86400 * fractional_day)

	const seconds = total_seconds % 60

	total_seconds -= seconds

	const hours = Math.floor(total_seconds / (60 * 60))
	const minutes = Math.floor(total_seconds / 60) % 60

	return new Date(
		date_info.getFullYear(),
		date_info.getMonth(),
		date_info.getDate(),
		hours,
		minutes,
		seconds,
	)
}

type GoogleSheetsApiResult = {
	properties: { title: string }
	sheets: {
		properties: { title: string }
		data: {
			rowData: {
				values: {
					formattedValue: string
					effectiveValue: {
						numberValue?: number
					}
				}[]
			}[]
			rowMetadata: { hiddenByUser?: boolean }[]
			columnMetadata: { hiddenByUser?: boolean }[]
		}[]
	}[]
}

function adjustGoogleSheetData(json: GoogleSheetsApiResult) {
	const data = json?.sheets?.[0]?.data[0]
	if (!data) {
		return json
	}

	const title = json.properties.title
	const sheetTitle = json.sheets[0].properties.title

	const hiddenColumns = data.columnMetadata.flatMap((cm, i) => (cm.hiddenByUser ? i : []))
	const hiddenRows = data.rowMetadata.flatMap((rm, i) => (rm.hiddenByUser ? i : []))

	const values = data.rowData.map((rowDatum) => {
		return rowDatum.values.map((value) => {
			const excelSerialDate = value?.effectiveValue?.numberValue
			return excelSerialDate
				? [value.formattedValue, excelDateToJsDate(excelSerialDate)]
				: value.formattedValue
		})
	})

	return { title, sheetTitle, values, hiddenColumns, hiddenRows }
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

			const fetched = await fetch(urlFetch)
			const text = await fetched.text()

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			let json: any = {}

			if (type === 'form') {
				const textSplit = text.split('FB_PUBLIC_LOAD_DATA_ = ')[1]
				const formData = textSplit.substring(0, textSplit.lastIndexOf(';'))
				json = JSON.parse(formData)
			}

			if (type === 'sheet') {
				json = JSON.parse(text)
				json = adjustGoogleSheetData(json)
			}

			return {
				type,
				id,
				idLength: id.length,
				url,
				urlFetch,
				urlFetched,
				urlCanonical,
				text,
				json,
			}
		}),
	)

	return json({ urls, data })
}
