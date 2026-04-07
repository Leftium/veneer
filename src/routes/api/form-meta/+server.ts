import { json, type RequestHandler } from '@sveltejs/kit'
import { isOk } from 'wellcrafted/result'
import { fetchWithDocumentId } from '$lib/google-document-util/fetch-document-with-id'

export const GET: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get('id')
	if (!id) {
		return json({ title: '', headerImageUrl: null, accentColor: null, bgColor: null })
	}

	const result = await fetchWithDocumentId(id)

	if (isOk(result) && result.data.type === 'form') {
		return json({
			type: 'form' as const,
			title: result.data.title,
			headerImageUrl: result.data.headerImageUrl,
			accentColor: result.data.accentColor ?? null,
			bgColor: result.data.bgColor ?? null,
		})
	}

	if (isOk(result) && result.data.type === 'sheet') {
		return json({
			type: 'sheet' as const,
			title: result.data.title,
			headerImageUrl: null,
			accentColor: null,
			bgColor: null,
		})
	}

	// Error — degrade gracefully
	return json({ type: null, title: '', headerImageUrl: null, accentColor: null, bgColor: null })
}
