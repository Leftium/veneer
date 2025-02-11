import { GoogleDocument } from '$lib/GoogleDocument.svelte'

export const load = async ({ params, fetch }) => {
	let indexForm = null
	let indexSheet = null

	const googleDocuments = []
	for (const id of params.ids.split('/')) {
		if (id) {
			const googleDocument = new GoogleDocument(id)

			if (!indexForm || !indexSheet) {
				await googleDocument.fetch(fetch)
			}

			googleDocuments.push(googleDocument)

			if (!indexForm && googleDocument.type === 'form') {
				indexForm = googleDocuments.length - 1
			}
			if (!indexSheet && googleDocument.type === 'sheet') {
				indexSheet = googleDocuments.length - 1
			}
		}
	}

	return { indexForm, indexSheet, googleDocuments }
}
