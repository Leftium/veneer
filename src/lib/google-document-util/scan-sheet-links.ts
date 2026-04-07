import { isOk, type Result } from 'wellcrafted/result'
import * as linkify from 'linkifyjs'
import { gg } from '@leftium/gg'
import { getGoogleDocumentId } from './url-id'
import { fetchWithDocumentId } from './fetch-document-with-id'
import type { GoogleSheet, GoogleDocumentError } from './types'

export type DetectedSheet = {
	veneerId: string
	title: string
	/** The full fetch result — available so callers can reuse without re-fetching. */
	result: Result<GoogleSheet, GoogleDocumentError>
}

/**
 * Scan a form's description content for links to Google Sheets.
 *
 * Extracts candidate URLs from the form's HTML description (href attributes)
 * and plain-text info (via linkifyjs), deduplicates them, and resolves each
 * to check if it points to a Google Sheet.
 *
 * @param descriptionHtml - The form's HTML description (may contain <a> tags)
 * @param descriptionText - Plain-text content (form info / description fallback)
 * @param options.all - If true, find ALL sheets (builder mode). Default: false (stop at first match).
 * @returns Array of detected sheets with veneerId, title, and full result.
 *          In default mode, returns at most one element.
 */
export async function scanSheetLinks(
	descriptionHtml: string | null,
	descriptionText: string,
	options?: { all?: boolean },
): Promise<{ sheets: DetectedSheet[]; numLinksChecked: number }> {
	const all = options?.all ?? false
	const sheets: DetectedSheet[] = []

	// Extract href URLs from HTML description (catches hyperlinks whose
	// display text differs from the URL, e.g. <a href="...sheet...">신청확인</a>)
	const htmlHrefs = [...(descriptionHtml ?? '').matchAll(/href="([^"]+)"/g)]
		.map((m) => m[1])
		.filter((href) => !/googleusercontent.com/.test(href))

	// Fallback: bare URLs from plain text (safety net for older forms or
	// cases where descriptionHtml is null but plain text has raw URLs)
	const textHrefs = linkify
		.find(descriptionText)
		.map((link) => link.href)
		.filter((href) => !/googleusercontent.com/.test(href))

	// Reorder text hrefs: move first link (usually the form's own URL) to 2nd slot
	const shifted = textHrefs.shift()
	if (shifted) {
		textHrefs.splice(1, 0, shifted)
	}

	// HTML hrefs first (higher signal), then reordered text hrefs as fallback
	const hrefs = [...new Set([...htmlHrefs, ...textHrefs])]

	let numLinksChecked = 0
	for (const href of hrefs) {
		gg(`Smart sheet ID scan #${++numLinksChecked}: ${href}`)
		const googleDocumentId = await getGoogleDocumentId(href)
		if (isOk(googleDocumentId) && googleDocumentId.data.documentId[0] === 's') {
			const document = await fetchWithDocumentId(googleDocumentId.data.documentId)
			if (isOk(document) && document.data.type === 'sheet') {
				sheets.push({
					veneerId: document.data.veneerId ?? googleDocumentId.data.documentId,
					title: document.data.title,
					result: document as Result<GoogleSheet, GoogleDocumentError>,
				})
				if (!all) break
			}
		}
	}

	return { sheets, numLinksChecked }
}
