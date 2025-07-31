import { gg } from '@leftium/gg'

import { err, ok } from 'neverthrow'
import * as linkify from 'linkifyjs'

import { getGoogleDocumentId } from '$lib/google-document-util/url-id.js'
import { stripHidden } from '$lib/google-document-util/google-sheets.js'
import type { ResultGoogleForm, ResultGoogleSheet } from '$lib/google-document-util/types'
import { fetchWithDocumentId } from '$lib/google-document-util/fetch-document-with-id'

export const load = async ({ params, url }) => {
	// URL params that control inclusion of sheet data hidden by user:
	const allCols = url.searchParams.has('allcols')
	const allRows = url.searchParams.has('allrows')

	const skipSheetIdScan = url.searchParams.has('skipsheetidscan')

	// prettier-ignore
	const TABS: Record<string, [number, string, string]> ={
        info:      [0b0001, 'ℹ️', 'Info'],
        form:      [0b0010, '✍', 'Form'], 
        responses: [0b0100, '📋', 'Responses'],
        dev:       [0b1000, '🔧', 'Dev'], 
    }

	const flags = Number(params.flags)

	const numTabs = flags.toString(2).replace(/0/g, '').length

	let title = ''
	let info = ''

	let form: ResultGoogleForm = err({ message: `Initial form` })
	let sheet: ResultGoogleSheet = err({ message: `Initial sheet` })

	const [document1, document2] = await Promise.all([
		fetchWithDocumentId(params.id1),
		fetchWithDocumentId(params.id2),
	])

	if (document1.isErr()) {
		if (!document1.error.type) {
			form = document1 as ResultGoogleForm
			sheet = document1 as ResultGoogleSheet
		}
		form = (document1.error.type === 'form' ? document1 : document2) as ResultGoogleForm
		sheet = (document1.error.type === 'sheet' ? document1 : document2) as ResultGoogleSheet
	} else {
		form = (document1.value.type === 'form' ? document1 : document2) as ResultGoogleForm
		sheet = (document1.value.type === 'sheet' ? document1 : document2) as ResultGoogleSheet

		// Detect and load sheet if necessary.
		if (!skipSheetIdScan && form.isOk() && sheet.isErr() && !sheet.error.documentId) {
			const links = form.value.fields.map((field) => linkify.find(field.description || '')).flat()

			// Reorder array to minimize expected number of url fetches:
			// Move first link to last place: usually link to form itself.
			const shifted = links.shift()
			if (shifted) {
				links.push(shifted)
			}

			for (const link of links) {
				gg(`Checking for sheet id: ${link.href}`)
				const googleDocumentId = await getGoogleDocumentId(link.href)
				if (googleDocumentId.isOk() && googleDocumentId.value[0] === 's') {
					const document = await fetchWithDocumentId(googleDocumentId.value)
					if (document.isOk() && document.value.type === 'sheet') {
						sheet = document as ResultGoogleSheet
						break
					}
				}
			}
		}

		title = form.isOk() ? form.value.title : sheet.isOk() ? sheet.value.title : ''

		if (form.isOk()) {
			// Set info to markdown of initial non-question fields.
			info = form.value.fields
				.slice(0, form.value.firstInput)
				.map((f, index) => {
					let s = ''
					function add(t: string | null, prefix = '') {
						if (t) {
							s += `${prefix}${t}\n`
						}
					}
					if (f.type === 'TITLE_AND_DESCRIPTION') {
						if (index > 0) {
							add(f.title, '# ')
						}
						add(f.description)
					} else if (f.type === 'IMAGE') {
						add(f.title, '# ')
						add(`![](${f.imgUrl?.replace(/=w\d+$/i, '')})`)
					}
					return s
				})
				.join('\n')

			// Remove info fields from form.
			form.value.fields = form.value.fields.filter((f) => f.inputIndex)
		}

		if (sheet.isOk()) {
			sheet = ok(stripHidden(sheet.value, allCols, allRows))
		}
	}

	type TabsKey = keyof typeof TABS
	const navTabs = Object.entries(TABS).reduce(
		(acc, [hash, [bit, icon, name]]) => {
			const error =
				((hash === 'info' || hash === 'form') && form.isErr()) ||
				(hash === 'responses' && sheet.isErr())

			acc[hash] = {
				name,
				icon: (flags & bit) > 0 ? icon : '',
				error,
			}
			return acc
		},
		{} as Record<TabsKey, { name: string; icon: string; error: boolean }>,
	)

	return {
		navTabs,
		numTabs,
		skipSheetIdScan,
		title,
		info,
		form,
		sheet,
	}
}
