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
        info: [0b0001, 'ℹ️', 'Info'],
        form: [0b0010, '✍', 'Form'], 
        list: [0b0100, '📋', 'Responses'],
        dev:  [0b1000, '🔧', 'Dev'], 
    }

	const flags = Number(params.flags)

	const warnings = []

	const numTabs = flags.toString(2).replace(/0/g, '').length

	let title = ''
	let info = ''
	let footers: string[] = []

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

		if (form.isOk()) {
			// Set info to markdown of initial non-question fields.
			const infoAndFooters = form.value.fields
				.slice(0, form.value.firstInput === -1 ? undefined : form.value.firstInput)
				.map((f) => {
					let skippedFirstTitle = false
					let s = ''
					function add(t: string | null, prefix = '') {
						if (t) {
							s += `${prefix}${t}\n`
						}
					}
					if (f.type === 'TITLE_AND_DESCRIPTION') {
						if (!skippedFirstTitle) {
							skippedFirstTitle = true
						} else {
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
				.split(/^={3,}\s*(?<header>.*?)\s*={3,}$/m)

			footers = infoAndFooters
			info = footers.shift() || 'EMPTY'

			footers = footers.reduce((result, footer, i, footers) => {
				if (i % 2 === 0) {
					const header = footer ? `# ${footer}` : ''
					const body = footers[i + 1] || ''
					result.push(`${header}\n<div>${body}</div>`)
				}
				return result
			}, [] as string[])

			// Remove info fields from form.
			form.value.fields = form.value.fields.filter((f) => f.inputIndex)
		}

		// Detect and load sheet if necessary.
		if (
			!skipSheetIdScan &&
			form.isOk() &&
			form.value.firstInput !== -1 &&
			sheet.isErr() &&
			!sheet.error.documentId
		) {
			const links = linkify.find(info).filter((link) => !/googleusercontent.com/.test(link.href))

			// Reorder array to minimize expected number of url fetches:
			// Move first link (usually links to form itself) to 2nd slot.
			const shifted = links.shift()
			if (shifted) {
				links.splice(1, 0, shifted)
			}

			let numLinksChecked = 0
			for (const link of links) {
				gg(`Smart sheet ID scan #${++numLinksChecked}: ${link.href}`)
				const googleDocumentId = await getGoogleDocumentId(link.href)
				if (googleDocumentId.isOk() && googleDocumentId.value[0] === 's') {
					const document = await fetchWithDocumentId(googleDocumentId.value)
					if (document.isOk() && document.value.type === 'sheet') {
						sheet = document as ResultGoogleSheet
						break
					}
				}
			}
			if (numLinksChecked > 2) {
				warnings.push({
					message: `Smart sheet ID required many network requests. (Fetched ${numLinksChecked} links.)`,
				})
			}
		}

		title = form.isOk() ? form.value.title : sheet.isOk() ? sheet.value.title : ''

		if (sheet.isOk()) {
			sheet = ok(stripHidden(sheet.value, allCols, allRows))
		}
	}

	type TabsKey = keyof typeof TABS
	const navTabs = Object.entries(TABS).reduce(
		(acc, [hash, [bit, icon, name]]) => {
			const error =
				((hash === 'info' || hash === 'form') && form.isErr()) ||
				(hash === 'list' && sheet.isErr()) ||
				(hash === 'dev' && !!warnings.length)

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
		warnings,
		info,
		footers,
		navTabs,
		numTabs,
		skipSheetIdScan,
		title,
		form,
		sheet,
	}
}
