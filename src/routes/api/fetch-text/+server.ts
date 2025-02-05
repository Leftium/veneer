import { json } from '@sveltejs/kit'
import * as linkify from 'linkifyjs'

import { DocumentId } from '$lib/common'
import { gg } from '$lib/gg.js'

export const GET = async ({ url, fetch }) => {
	const urls = url.searchParams.getAll('u')

	const data = await Promise.all(
		urls.map(async (url) => {
			// eslint-disable-next-line prefer-const
			let { id, idForm, idSheet } = new DocumentId(url)

			const fetched = await fetch(url)
			const fetchedUrl = fetched.url
			const text = await fetched.text()

			if (!idForm && !idSheet) {
				const documentIdFetched = new DocumentId(fetchedUrl)
				idForm = documentIdFetched.idForm
				idSheet = documentIdFetched.idSheet
			}

			if (idForm && !idSheet) {
				// Search for a link to the sheets in the form
				const links = linkify.find(text)
				for (const { href } of links) {
					const documentIdLink = new DocumentId(href)
					if (documentIdLink.idSheet) {
						idSheet = documentIdLink.idSheet
						break
					} else if (documentIdLink.id && documentIdLink.url !== url) {
						gg(`fetch: ${documentIdLink.url}`)
						const fetched = await fetch(documentIdLink.url)
						const fetchedUrl = fetched.url
						const documentIdFetched = new DocumentId(fetchedUrl)
						if (documentIdFetched.idSheet) {
							idSheet = documentIdFetched.idSheet
							break
						}
					}
				}
			}

			return {
				url,
				id,
				idForm,
				idSheet,
				text,
			}
		}),
	)

	return json(data)
}
