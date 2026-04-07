import { json, type RequestHandler } from '@sveltejs/kit'
import { isOk } from 'wellcrafted/result'
import { fetchWithDocumentId } from '$lib/google-document-util/fetch-document-with-id'
import { scanSheetLinks } from '$lib/google-document-util/scan-sheet-links'

type AutoSheet = { veneerId: string; title: string }

export const GET: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get('id')
	if (!id) {
		return json({ title: '', headerImageUrl: null, accentColor: null, bgColor: null })
	}

	const result = await fetchWithDocumentId(id)

	if (isOk(result) && result.data.type === 'form') {
		// Scan for linked sheets in form description (builder mode: find all)
		const descriptionText = result.data.fields
			.map((f) => [f.title, f.description].filter(Boolean).join('\n'))
			.join('\n')

		const { sheets } = await scanSheetLinks(result.data.descriptionHtml, descriptionText, {
			all: true,
		})

		const autoSheets: AutoSheet[] = sheets.map(({ veneerId, title }) => ({ veneerId, title }))

		return json({
			type: 'form' as const,
			title: result.data.title,
			headerImageUrl: result.data.headerImageUrl,
			accentColor: result.data.accentColor ?? null,
			bgColor: result.data.bgColor ?? null,
			autoSheets,
		})
	}

	if (isOk(result) && result.data.type === 'sheet') {
		return json({
			type: 'sheet' as const,
			title: result.data.title,
			headerImageUrl: null,
			accentColor: null,
			bgColor: null,
			autoSheets: [] as AutoSheet[],
		})
	}

	// Error — degrade gracefully
	return json({
		type: null,
		title: '',
		headerImageUrl: null,
		accentColor: null,
		bgColor: null,
		autoSheets: [] as AutoSheet[],
	})
}
