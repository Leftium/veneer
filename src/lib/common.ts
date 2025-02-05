const documentIdRegex = {
	// Google sheets
	s: /(?<beforeId>^https:\/\/docs.google.com\/spreadsheets\/(d\/(e\/)?)?)(?<id>[^/]*)/,
	// Google forms
	f: /(?<beforeId>^https:\/\/docs.google.com\/forms\/d\/e\/)(?<id>[^/]*)/,
	// Google forms shortened
	g: /(?<beforeId>^https:\/\/forms.gle\/)(?<id>[^/]*)/,
	// Bitly
	b: /(?<beforeId>^https:\/\/bit.ly\/)(?<id>[^/]*)/,
	// ShortUrl
	h: /(?<beforeId>^https:\/\/shorturl.at\/)(?<id>[^/]*)/,
}

export class DocumentId {
	url
	urlOrig
	id = ''
	idForm?: string
	idSheet?: string

	constructor(url: string) {
		this.urlOrig = url
		this.url = url
		for (const [prefix, regex] of Object.entries(documentIdRegex)) {
			const matches = url.match(regex)
			if (matches) {
				const matchId = `${matches.groups?.id}`
				const matchBeforeId = `${matches.groups?.beforeId}`

				if (prefix === 's') {
					this.idSheet = matchId
					if (matchId.length === 44) {
						this.url = `https://docs.google.com/spreadsheets/d/${matchId}`
					}
				} else if (prefix === 'f') {
					this.idForm = matchId
					if (matchId.length === 56) {
						this.url = `https://docs.google.com/forms/d/e/${matchId}/viewform`
					}
				} else {
					this.url = `${matchBeforeId}${matchId}`
				}

				this.id = `${prefix}.${matchId}`
			}
		}
	}
}
