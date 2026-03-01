import { dev } from '$app/environment'
import { gg } from '@leftium/gg'

import { Err, isErr, isOk, Ok } from 'wellcrafted/result'
import * as linkify from 'linkifyjs'

import { m } from '$lib/paraglide/messages.js'
import {
	PRESETS,
	resolvePresetName,
	GOOGLE_FORM_ACCENT,
	GOOGLE_FORM_BG,
	darkenHex,
} from '$lib/presets'

import { getGoogleDocumentId } from '$lib/google-document-util/url-id.js'
import { stripHidden } from '$lib/google-document-util/google-sheets.js'
import type {
	GoogleSheet,
	GoogleFormDocument,
	GoogleDocumentError,
	ResultGoogleForm,
	ResultGoogleSheet,
} from '$lib/google-document-util/types'
import type { Result } from 'wellcrafted/result'
import { fetchWithDocumentId } from '$lib/google-document-util/fetch-document-with-id'
import { detectSheetType, type SheetType } from '$lib/google-document-util/detect-sheet-type'
import { getLocale } from '$lib/paraglide/runtime.js'
import { addBilingualData, splitBilingualLabel } from '$lib/locale-content'

type DocumentResult = Result<GoogleSheet | GoogleFormDocument, GoogleDocumentError>

const ALL_TABS = ['info', 'form', 'list', 'table', 'raw', 'dev']

/** If info content has at least this many lines, auto-show the info tab. */
const INFO_LINE_THRESHOLD = 30

/**
 * Parse the ?tabs= parameter into a resolved tab list.
 *
 * Two modes:
 * - **Absolute** (no +/- anywhere): plain tab names separated by `.` → replaces entire list
 * - **Modifier** (+/- present): add/remove from a base set
 *
 * Bases for modifier mode:
 * - bare (no prefix) → computedTabs (heuristic defaults)
 * - `*`              → ALL_TABS
 * - `~`              → presetTabs (raw preset.tabs before heuristics)
 *
 * Final order always follows canonical ALL_TABS order.
 */
function parseTabs(
	param: string,
	computedTabs: string[],
	presetTabs: string[] | undefined,
): string[] | null {
	if (!param) return null

	// No +/- anywhere → absolute mode (backward compatible)
	if (!param.includes('+') && !param.includes('-')) {
		// Bare `*` → all tabs (replaces old redirect behavior)
		if (param === '*') return [...ALL_TABS]
		return param.split('.').filter((t) => ALL_TABS.includes(t))
	}

	// Modifier mode: determine base
	let base: string[]
	let expr = param
	if (expr.startsWith('*')) {
		base = [...ALL_TABS]
		expr = expr.slice(1)
	} else if (expr.startsWith('~')) {
		base = [...(presetTabs ?? computedTabs)]
		expr = expr.slice(1)
	} else {
		base = [...computedTabs]
	}

	// Parse +/- segments
	const ops = expr.match(/[+-][a-z]+/gi) || []
	const result = new Set(base)
	for (const op of ops) {
		const name = op.slice(1)
		if (!ALL_TABS.includes(name)) continue
		if (op[0] === '+') result.add(name)
		else result.delete(name)
	}

	// Preserve canonical tab order
	return ALL_TABS.filter((t) => result.has(t))
}

/** Compute default visible tabs from sheet type and info length. */
function computeDefaultTabs(sheetType: SheetType, infoLines: number): string[] {
	let tabs: string[]
	switch (sheetType) {
		case 'dance-event':
			tabs = ['form', 'list']
			break
		case 'playlist':
			tabs = ['form', 'list', 'table']
			break
		default:
			tabs = ['form', 'table']
			break
	}
	if (infoLines >= INFO_LINE_THRESHOLD) {
		tabs = ['info', ...tabs]
	}
	return tabs
}

/** Return 'white' or 'black' for readable text on a given hex background. */
function contrastText(hex: string | null): string | null {
	if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return null
	const r = parseInt(hex.slice(1, 3), 16) / 255
	const g = parseInt(hex.slice(3, 5), 16) / 255
	const b = parseInt(hex.slice(5, 7), 16) / 255
	// sRGB relative luminance (WCAG formula)
	const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
	const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
	return L > 0.179 ? '#212529' : 'white' // #212529 = Open Props $gray-9
}

export const load = async ({ cookies, locals, params, url }) => {
	// Flash cookie set by the form action on successful submission — consume it once.
	const successParty = cookies.get('yay') === '1'
	if (successParty) cookies.delete('yay', { path: '/' })

	// --- Resolve preset for tab visibility ---
	const hostname = ((dev && url.searchParams.get('hostname')) || url.hostname).replace(/^www\./, '')
	const presetName = url.searchParams.get('preset') || resolvePresetName(hostname) || 'base'
	const preset = PRESETS[presetName] || PRESETS['base']

	// ?tabs= parsed after sheetType and info are known (parseTabs needs computed defaults).
	const tabsParam = url.searchParams.get('tabs')

	// Phase 3a: ?showErrors — defaults to true in dev, false in prod
	const showErrorsParam = url.searchParams.get('showErrors')
	const showErrors = showErrorsParam !== null ? showErrorsParam !== 'false' : dev

	// Phase 3b: header param overrides
	const headerImageParam = url.searchParams.get('headerImage')
	const headerColorParam = url.searchParams.get('headerColor')
	const headerHeightParam = url.searchParams.get('headerHeight')
	const headerTextColor = url.searchParams.get('headerTextColor') ?? preset.headerTextColor
	const headerImageFit = url.searchParams.get('headerImageFit') ?? preset.headerImageFit
	// headerImage and headerHeight resolved after form is loaded (image needed for 'form' sentinel;
	// height defaults to '0' when there is no header image)

	// ?ogImage= override: 'header' | 'first' | 'none' | <url>
	const ogImageParam = url.searchParams.get('ogImage')

	// Phase 5: accent/background color param overrides
	const accentColorParam = url.searchParams.get('accentColor')
	const bgColorParam = url.searchParams.get('bgColor')

	// URL params that control inclusion of sheet data hidden by user:
	const allCols = url.searchParams.has('allcols')
	const allRows = url.searchParams.has('allrows')

	const skipSheetIdScan = url.searchParams.has('skipsheetidscan')

	// prettier-ignore
	const TABS: Record<string, [string, string]> = {
		info: ['ℹ️', m.info()],
		form: ['✍', m.form()],
		list:  ['📋', m.list()],
		table: ['▦', m.table()],
		raw:   ['🔧', 'RAW'],
		dev:  ['🔧', m.dev()],
	}

	// numTabs computed after navTabs (error-hidden tabs reduce the count)

	const warnings = []

	const locale = getLocale()

	let info = ''
	let footers: string[] = []

	let form: ResultGoogleForm = Err({ message: `Initial form` })
	let sheet: ResultGoogleSheet = Err({ message: `Initial sheet` })
	let markedOgImage: string | null = null
	let firstFormImage: string | null = null

	// Use pre-fetched documents from hooks.server.ts if available (avoids double-fetch
	// when ssr=false, since the hook already fetched them for OG metadata).
	const [document1, document2]: [DocumentResult, DocumentResult] = locals.documents
		? [locals.documents.document1, locals.documents.document2]
		: await Promise.all([fetchWithDocumentId(params.id1), fetchWithDocumentId(params.id2)])

	if (isOk(document1)) {
		if (document1.data.type === 'form') {
			form = document1 as ResultGoogleForm
		}
		if (document1.data.type === 'sheet') {
			sheet = document1 as ResultGoogleSheet
		}
	} else {
		if (document1.error.type === 'form') {
			form = document1 as ResultGoogleForm
		}
		if (document1.error.type === 'sheet') {
			sheet = document1 as ResultGoogleSheet
		}
	}

	if (isOk(document2)) {
		if (document2.data.type === 'form') {
			form = document2 as ResultGoogleForm
		}
		if (document2.data.type === 'sheet') {
			sheet = document2 as ResultGoogleSheet
		}
	} else {
		if (document2.error.type === 'form') {
			form = document2 as ResultGoogleForm
		}
		if (document2.error.type === 'sheet') {
			sheet = document2 as ResultGoogleSheet
		}
	}

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

		// OG image: check for an IMAGE field whose title starts with "og:" (case-insensitive)
		markedOgImage =
			form.data.fields
				.find((f) => f.type === 'IMAGE' && /^og:/i.test(f.title))
				?.imgUrl?.replace(/=w\d+$/i, '') ?? null

		// Fallback: first IMAGE field from the form
		firstFormImage =
			form.data.fields.find((f) => f.type === 'IMAGE')?.imgUrl?.replace(/=w\d+$/i, '') ?? null

		// Remove info fields before first input.
		form.data.fields = form.data.fields.filter((f, i) => i >= form.data.firstInput)

		// Phase 3 (Option D): add bilingual splits to remaining input fields
		form.data.fields = form.data.fields.map(addBilingualData)

		// Phase 3 (Option D): bilingual info content splitting is done client-side
		// (in +layout.svelte) AFTER internalizeLinks() processes the full text.
		// This ensures special buttons (Sign up, Check who's going) generated by
		// internalizeLinks stay in the primary content and don't end up broken
		// inside collapsed <details> blocks.
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

	const title = isOk(form) ? form.data.title : isOk(sheet) ? sheet.data.title : ''
	const bilingualTitle = splitBilingualLabel(title) ?? undefined

	// Phase 3b: resolve headerImage after form is loaded
	// absent param defaults to 'form' (use the Google Form's own header image)
	const headerImage =
		headerImageParam === 'none'
			? null
			: headerImageParam === 'form' || headerImageParam == null
				? ((isOk(form) ? form.data.headerImageUrl : null) ?? preset.headerImage)
				: (headerImageParam ?? preset.headerImage)

	// Extra height defaults to '0' when there is no header image
	const headerHeight = headerHeightParam ?? (headerImage ? preset.headerHeight : '0')

	// Phase 5: resolve accentColor/bgColor — 'form' sentinel (now also the default) uses parsed form value
	// When no form is present (sheet-only), use preset headerColor / neutral gray instead of Google Form purple.
	const formAccent = isOk(form) ? form.data.accentColor : null
	const formBg = isOk(form) ? form.data.bgColor : null
	const hasForm = isOk(form)
	const accentFallback = hasForm ? GOOGLE_FORM_ACCENT : (preset.accentColor ?? preset.headerColor)
	const bgFallback = hasForm ? GOOGLE_FORM_BG : (preset.bgColor ?? '#fefefe')

	const accentColor =
		accentColorParam === 'form' || accentColorParam == null
			? (formAccent ?? preset.accentColor ?? accentFallback)
			: (accentColorParam ?? preset.accentColor ?? accentFallback)

	const bgColor =
		bgColorParam === 'form' || bgColorParam == null
			? (formBg ?? preset.bgColor ?? bgFallback)
			: (bgColorParam ?? preset.bgColor ?? bgFallback)

	const accentText = contrastText(accentColor)

	// Derive header color: explicit param → darkened accent (preset headerColor ignored
	// in favour of accent-derived color for visual coherence with the form's theme)
	const headerColor = headerColorParam ?? darkenHex(accentColor, 0.5)

	if (isOk(sheet)) {
		sheet = Ok(stripHidden(sheet.data, allCols, allRows))
	}

	const sheetType = isOk(sheet) ? detectSheetType(sheet.data.rows) : null

	// --- Compute visible tabs (unified: sheet type + info heuristic + preset/param overrides) ---
	const infoLines = info.trimEnd().split('\n').length
	const computedTabs = computeDefaultTabs(sheetType, infoLines)
	// Priority: ?tabs= param (absolute/modifier) > preset.tabs (explicit) > computed heuristics
	const tabs =
		(tabsParam ? parseTabs(tabsParam, computedTabs, preset.tabs) : null) ??
		preset.tabs ??
		computedTabs
	const visibleTabs = new Set(tabs)

	type TabsKey = keyof typeof TABS
	const navTabs = Object.entries(TABS).reduce(
		(acc, [hash, [icon, name]]) => {
			const error =
				((hash === 'info' || hash === 'form') && isErr(form)) ||
				(hash === 'list' && isErr(sheet)) ||
				(hash === 'dev' && !!warnings.length)

			// Hide tab if: not in visible set, OR errored and showErrors is off
			const visible = visibleTabs.has(hash) && (!error || showErrors)

			acc[hash] = {
				name,
				icon: visible ? icon : '',
				error,
			}
			return acc
		},
		{} as Record<TabsKey, { name: string; icon: string; error: boolean }>,
	)

	const numTabs = Object.values(navTabs).filter((tab) => tab.icon).length

	// Phase 3c: detect whether current doc IDs match the preset's defaults
	const usingDefaultDocs =
		!!preset.defaultFormId &&
		params.id1 === preset.defaultFormId &&
		(params.id2 === preset.defaultSheetId || (!params.id2 && !preset.defaultSheetId))
	const defaultTab = tabs[0] || 'info'

	// OG image priority: ?ogImage= param > og:-marked image > first form image > header image
	const ogImage =
		ogImageParam === 'none'
			? null
			: ogImageParam === 'header'
				? headerImage || null
				: ogImageParam === 'first'
					? firstFormImage || null
					: ogImageParam
						? ogImageParam // explicit URL
						: markedOgImage || firstFormImage || headerImage || null

	return {
		successParty,
		locale,
		document1,
		document2,
		warnings,
		info,
		footers,
		navTabs,
		numTabs,
		skipSheetIdScan,
		title,
		bilingualTitle,
		form,
		sheet,
		header: {
			image: headerImage,
			color: headerColor,
			height: headerHeight,
			textColor: headerTextColor,
			imageFit: headerImageFit,
		},
		usingDefaultDocs,
		defaultTab,
		accentColor,
		accentText,
		bgColor,
		ogImage,
		sheetType,
	}
}
