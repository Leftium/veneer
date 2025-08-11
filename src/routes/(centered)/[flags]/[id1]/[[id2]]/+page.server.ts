import { gg } from '@leftium/gg'

import { Err, isErr, isOk, Ok } from 'wellcrafted/result'
import * as linkify from 'linkifyjs'

import { m } from '$lib/paraglide/messages.js'

import { getGoogleDocumentId } from '$lib/google-document-util/url-id.js'
import { stripHidden } from '$lib/google-document-util/google-sheets.js'
import type { ResultGoogleForm, ResultGoogleSheet } from '$lib/google-document-util/types'
import { fetchWithDocumentId } from '$lib/google-document-util/fetch-document-with-id'
import { fail } from '@sveltejs/kit'

export const load = async ({ params, url }) => {
	// URL params that control inclusion of sheet data hidden by user:
	const allCols = url.searchParams.has('allcols')
	const allRows = url.searchParams.has('allrows')

	const skipSheetIdScan = url.searchParams.has('skipsheetidscan')

	// prettier-ignore
	const TABS: Record<string, [number, string, string]> ={
        info: [0b0001, 'ℹ️', m.info()],
        form: [0b0010, '✍', m.form()], 
        list: [0b0100, '📋', m.list()],
        raw:  [0b1000, '🔧', 'RAW'], 
        dev:  [0b1000, '🔧', m.dev()],
    }

	const flags = Number(params.flags)

	const warnings = []

	const numTabs = flags.toString(2).replace(/0/g, '').length

	let title = ''
	let info = ''
	let footers: string[] = []

	let form: ResultGoogleForm = Err({ message: `Initial form` })
	let sheet: ResultGoogleSheet = Err({ message: `Initial sheet` })

	const [document1, document2] = await Promise.all([
		fetchWithDocumentId(params.id1),
		fetchWithDocumentId(params.id2),
	])

	if (isErr(document1)) {
		if (!document1.error.type) {
			form = document1 as ResultGoogleForm
			sheet = document1 as ResultGoogleSheet
		}
		form = (document1.error.type === 'form' ? document1 : document2) as ResultGoogleForm
		sheet = (document1.error.type === 'sheet' ? document1 : document2) as ResultGoogleSheet
	} else {
		form = (document1.data.type === 'form' ? document1 : document2) as ResultGoogleForm
		sheet = (document1.data.type === 'sheet' ? document1 : document2) as ResultGoogleSheet

		if (isOk(form)) {
			// Set info to markdown of initial non-question fields.
			let skippedFirstTitle = false
			const infoAndFooters = form.data.fields
				.slice(0, form.data.firstInput === -1 ? undefined : form.data.firstInput)
				.map((f) => {
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
			form.data.fields = form.data.fields.filter((f) => f.inputIndex)
		}

		// Detect and load sheet if necessary.
		if (
			!skipSheetIdScan &&
			isOk(form) &&
			form.data.firstInput !== -1 &&
			isErr(sheet) &&
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
				if (isOk(googleDocumentId) && googleDocumentId.data.documentId[0] === 's') {
					const document = await fetchWithDocumentId(googleDocumentId.data.documentId)
					if (isOk(document) && document.data.type === 'sheet') {
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

		title = isOk(form) ? form.data.title : isOk(sheet) ? sheet.data.title : ''

		if (isOk(sheet)) {
			sheet = Ok(stripHidden(sheet.data, allCols, allRows))
		}
	}

	type TabsKey = keyof typeof TABS
	const navTabs = Object.entries(TABS).reduce(
		(acc, [hash, [bit, icon, name]]) => {
			const error =
				((hash === 'info' || hash === 'form') && isErr(form)) ||
				(hash === 'list' && isErr(sheet)) ||
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

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData()

		const documentId = formData.get('documentId')?.toString()

		if (!documentId) {
			return fail(555, {
				status: 555,
				statusText: `No documentId: <${documentId}>`,
			})
		}

		const fetchUrl = `https://docs.google.com/forms/d/e/${documentId.slice(2)}/formResponse`
		const resp = await fetch(fetchUrl, {
			method: 'POST',
			body: formData,
		})

		if (resp.status !== 200) {
			return fail(resp.status, {
				status: resp.status,
				statusText: resp.statusText,
			})
		}

		return { success: true }
	},
}
