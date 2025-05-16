import type { GoogleSheetData } from './google-sheets'

const documentIdRegex = /^(?<prefix>[sfgbh])\.(?<id>[a-zA-Z0-9_-]+)$/

const documentUrlRegex = {
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

const urlTemplates: Record<string, string> = {
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

export class GoogleDocument {
	idShort?: string = $state()
	idLong?: string = $state()
	text?: string = $state()
	json?: GoogleSheetData = $state()

	error? = $state()

	timeZone = $derived(this.json?.timeZone || 'UTC')

	title = $derived.by(() => {
		let title = ''
		if (this.json) {
			title = this.json?.title
		} else {
			title = this.text ? this.text.split(/<\/?title>/)[1] : ''
			if (!title && this.text) {
				const json = JSON.parse(this.text)
				return json?.properties?.title
			}
		}

		return title
	})

	url = $derived.by(() => {
		const thisId = this.idLong || this.idShort
		if (thisId) {
			const [prefix, id] = thisId.split('.')

			if (prefix === 's' && id.length === 44) {
				return makeGoogleSheetUrl(id)
			}

			return urlTemplates[prefix].replace('{ID}', id)
		}
		return ''
	})

	type = $derived.by(() => {
		if (this.idLong) {
			const [prefix] = this.idLong.split('.')

			if (prefix === 'f') {
				return 'form'
			} else if (prefix === 's') {
				return 'sheet'
			}
		}
		return 'unknown'
	})

	constructor(urlOrId: string) {
		let id = ''
		let prefix = ''

		const matches = urlOrId.match(documentIdRegex)
		if (matches) {
			prefix = matches.groups?.prefix || ''
			id = `${prefix}.${matches.groups?.id || ''}`
		} else {
			for (const [key, regex] of Object.entries(documentUrlRegex)) {
				const matches = urlOrId.match(regex)
				if (matches) {
					prefix = key
					id = `${prefix}.${matches.groups?.id || ''}`
					break
				}
			}
		}

		if (prefix === 'f' || prefix === 's') {
			this.idLong = id
		} else {
			this.idShort = id
		}
	}

	async fetch(customFetch = fetch, unhideCols = false, unhideRows = false) {
		const searchParams = new URLSearchParams({ u: this.url })
		if (unhideCols) {
			searchParams.set('allrows', 'true')
		}
		if (unhideRows) {
			searchParams.set('allcols', 'true')
		}
		const fetched = await customFetch(`/api/fetch-document?${searchParams}`)
		const jsoned = await fetched.json()
		if (fetched.ok) {
			this.idShort = jsoned.idShort
			this.idLong = jsoned.idLong
			//this.text = jsoned.text // hydration mis-match
			this.json = jsoned.json
		} else {
			this.error = {
				error: jsoned.error,
				status: fetched.status,
			}
		}
	}

	// https://stackoverflow.com/a/50785428/117030
	toJSON() {
		const jsonObj = Object.assign({}, this)
		const proto = Object.getPrototypeOf(this)
		for (const key of Object.getOwnPropertyNames(proto)) {
			const desc = Object.getOwnPropertyDescriptor(proto, key)
			const hasGetter = desc && typeof desc.get === 'function'
			if (hasGetter) {
				;(jsonObj as Record<string, unknown>)[key] = (this as Record<string, unknown>)[key]
			}
		}
		return jsonObj
	}
}
