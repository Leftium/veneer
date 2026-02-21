import { json, type RequestHandler } from '@sveltejs/kit'
import { isOk } from 'wellcrafted/result'
import { fetchWithDocumentId } from '$lib/google-document-util/fetch-document-with-id'

export const GET: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get('id')
	if (!id) {
		return json({ title: '', headerImageUrl: null })
	}

	const result = await fetchWithDocumentId(id)

	if (isOk(result) && result.data.type === 'form') {
		return json({
			title: result.data.title,
			headerImageUrl: result.data.headerImageUrl,
		})
	}

	// Sheet or error — degrade gracefully
	return json({ title: '', headerImageUrl: null })
}
