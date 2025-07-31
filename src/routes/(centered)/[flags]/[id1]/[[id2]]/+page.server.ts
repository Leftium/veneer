import { err, ok, Result } from 'neverthrow'
import * as linkify from 'linkifyjs'

import {
	DOCUMENT_URL_REGEX,
	getGoogleDocumentId,
	urlFromDocumentId,
} from '$lib/google-document-util/url-id.js'
import { gg } from '@leftium/gg'
import { adjustGoogleFormData, parseGoogleForm } from '$lib/google-document-util/google-form.js'
import { GCP_API_KEY } from '$env/static/private'
import { adjustGoogleSheetData, stripHidden } from '$lib/google-document-util/google-sheets.js'
import type {
	GoogleDocumentError,
	GoogleFormDocument,
	GoogleSheet,
} from '$lib/google-document-util/types'

async function fetchWithDocumentId(
	documentId?: string,
): Promise<Result<GoogleSheet | GoogleFormDocument, GoogleDocumentError>> {
	if (!documentId) {
		return err({ message: `DocumentId not set: <${documentId}>` })
	}

	const googleDocumentId = await getGoogleDocumentId(documentId)
	if (googleDocumentId.isErr()) {
		return err({ documentId, message: googleDocumentId.error.message })
	}

	const url = urlFromDocumentId(googleDocumentId.value)
	const type = DOCUMENT_URL_REGEX.s.test(url)
		? 'sheet'
		: DOCUMENT_URL_REGEX.f.test(url)
			? 'form'
			: undefined

	if (!type) {
		const message = `${googleDocumentId.value} not a Google form/sheet url: ${url}`
		return err({ documentId, type, message })
	}

	const fetched = await fetch(url.replace('GCP_API_KEY', GCP_API_KEY))
	if (!fetched.ok) {
		const message = `[${fetched.status}: ${fetched.statusText}] while fetching ${googleDocumentId.value} (${url}).`
		return err({ documentId, type, message })
	}

	const text = await fetched.text()

	if (type === 'sheet') {
		const dataSheet = adjustGoogleSheetData(JSON.parse(text))
		return dataSheet.isOk()
			? ok({
					type: 'sheet',
					documentId: googleDocumentId.value,
					...dataSheet.value,
				})
			: err(dataSheet.error)
	}

	return ok({
		type: 'form',
		documentId: googleDocumentId.value,
		...adjustGoogleFormData(parseGoogleForm(text)),
	})
}

export const load = async ({ params }) => {
	// prettier-ignore
	const TAB_BITS = {
		info:      0b0001,
		form:      0b0010,
		responses: 0b0100,
		dev:       0b1000,
	}
	const ALL_TABS_MASK = Object.values(TAB_BITS).reduce((acc, bit) => acc | bit, 0)

	const FLAG_SKIP_SCAN_SHEET_ID_SCAN = 0b1_0000

	const flags = Number(params.flags)

	type TabBitsKey = keyof typeof TAB_BITS
	const visibleTabs = Object.entries(TAB_BITS).reduce(
		(acc, [key, bit]) => {
			acc[key as TabBitsKey] = (flags & bit) > 0
			return acc
		},
		{} as Record<TabBitsKey, boolean>,
	)

	const skipSheetIdScan = (flags & FLAG_SKIP_SCAN_SHEET_ID_SCAN) > 0

	const commonResponse = {
		visibleTabs,
		numTabs: (flags & ALL_TABS_MASK).toString(2).replace(/0/g, '').length,
		skipSheetIdScan,
	}

	const [document1, document2] = await Promise.all([
		fetchWithDocumentId(params.id1),
		fetchWithDocumentId(params.id2),
	])

	if (document1.isErr()) {
		if (!document1.error.type) {
			return { ...commonResponse, form: document1, sheet: document2 }
		}
		const form = document1.error.type === 'form' ? document1 : document2
		const sheet = document1.error.type === 'sheet' ? document1 : document2
		return { ...commonResponse, form, sheet }
	}
	const form = (document1.value.type === 'form' ? document1 : document2) as Result<
		GoogleFormDocument,
		GoogleDocumentError
	>
	let sheet = (document1.value.type === 'sheet' ? document1 : document2) as Result<
		GoogleSheet,
		GoogleDocumentError
	>

	// TODO: detect and load sheet if necessary.
	if (!skipSheetIdScan && form.isOk() && sheet.isErr() && !sheet.error.documentId) {
		const links = form.value.fields.map((field) => linkify.find(field.description || '')).flat()

		// Reorder array to minimize expected number of url fetches:
		// Move first link to last place: usually link to form itself.
		const shifted = links.shift()
		if (shifted !== undefined) {
			links.push(shifted)
		}

		for (const link of links) {
			gg(`Trying: ${link.href}`)
			const googleDocumentId = await getGoogleDocumentId(link.href)
			if (googleDocumentId.isOk() && googleDocumentId.value[0] === 's') {
				const document = await fetchWithDocumentId(googleDocumentId.value)
				if (document.isOk() && document.value.type === 'sheet') {
					sheet = document as Result<GoogleSheet, GoogleDocumentError>
					break
				}
			}
		}
	}

	const title = form.isOk() ? form.value.title : sheet.isOk() ? sheet.value.title : null

	const info = form.isErr()
		? null
		: form.value.fields
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
	if (form.isOk()) {
		form.value.fields = form.value.fields.filter((f) => f.inputIndex)
	}

	if (sheet.isOk()) {
		sheet = ok(stripHidden(sheet.value) as GoogleSheet)
	}

	return {
		...commonResponse,
		title,
		info,
		form,
		sheet,
	}
}
