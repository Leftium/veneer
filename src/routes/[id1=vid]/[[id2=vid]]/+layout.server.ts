import { dev } from '$app/environment'
import { redirect } from '@sveltejs/kit'
import { gg } from '@leftium/gg'

import { Err, isErr, isOk, Ok } from 'wellcrafted/result'
import * as linkify from 'linkifyjs'

import { m } from '$lib/paraglide/messages.js'
import { PRESETS, resolvePresetName } from '$lib/presets'

import { getGoogleDocumentId } from '$lib/google-document-util/url-id.js'
import { stripHidden } from '$lib/google-document-util/google-sheets.js'
import type { ResultGoogleForm, ResultGoogleSheet } from '$lib/google-document-util/types'
import { fetchWithDocumentId } from '$lib/google-document-util/fetch-document-with-id'

const ALL_TABS = ['info', 'form', 'list', 'raw', 'dev']

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

export const load = async ({ params, url }) => {
	// --- Resolve preset for tab visibility ---
	const hostname = ((dev && url.searchParams.get('hostname')) || url.hostname).replace(/^www\./, '')
	const presetName = url.searchParams.get('preset') || resolvePresetName(hostname) || 'base'
	const preset = PRESETS[presetName] || PRESETS['base']

	// Phase 3a: ?tabs= override — expand wildcard to editable list via redirect
	const tabsParam = url.searchParams.get('tabs')
	if (tabsParam === '*') {
		const expandedUrl = new URL(url)
		expandedUrl.searchParams.set('tabs', ALL_TABS.join('.'))
		redirect(307, expandedUrl.pathname + expandedUrl.search)
	}

	const tabs = tabsParam
		? tabsParam.split('.').filter((t: string) => ALL_TABS.includes(t))
		: preset.tabs
	const visibleTabs = new Set(tabs)

	// Phase 3a: ?showErrors — defaults to true in dev, false in prod
	const showErrorsParam = url.searchParams.get('showErrors')
	const showErrors = showErrorsParam !== null ? showErrorsParam !== 'false' : dev

	// Phase 3b: header param overrides
	const headerImageParam = url.searchParams.get('headerImage')
	const headerColor = url.searchParams.get('headerColor') ?? preset.headerColor
	const headerHeight = url.searchParams.get('headerHeight') ?? preset.headerHeight
	const headerTextColor = url.searchParams.get('headerTextColor') ?? preset.headerTextColor
	const headerImageFit = url.searchParams.get('headerImageFit') ?? preset.headerImageFit
	// headerImage resolved after form is loaded (needed for 'form' sentinel)

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
		list: ['📋', m.list()],
		raw:  ['🔧', 'RAW'],
		dev:  ['🔧', m.dev()],
	}

	// numTabs computed after navTabs (error-hidden tabs reduce the count)

	const warnings = []

	let title = ''
	let info = ''
	let footers: string[] = []

	let form: ResultGoogleForm = Err({ message: `Initial form` })
	let sheet: ResultGoogleSheet = Err({ message: `Initial sheet` })

	const [document1, document2] = await Promise.all([
		fetchWithDocumentId(params.id1),
		fetchWithDocumentId(params.id2),
	])

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

		// Remove info fields before first input.
		form.data.fields = form.data.fields.filter((f, i) => i >= form.data.firstInput)
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

	// Phase 3b: resolve headerImage after form is loaded
	const headerImage =
		headerImageParam === 'none'
			? null
			: headerImageParam === 'form'
				? isOk(form)
					? form.data.headerImageUrl
					: null
				: (headerImageParam ?? preset.headerImage)

	// Phase 5: resolve accentColor/bgColor — 'form' sentinel uses parsed form value
	const accentColor =
		accentColorParam === 'form'
			? ((isOk(form) ? form.data.accentColor : null) ?? preset.accentColor ?? null)
			: (accentColorParam ?? preset.accentColor ?? null)

	const bgColor =
		bgColorParam === 'form'
			? ((isOk(form) ? form.data.bgColor : null) ?? preset.bgColor ?? null)
			: (bgColorParam ?? preset.bgColor ?? null)

	const accentText = contrastText(accentColor)

	if (isOk(sheet)) {
		sheet = Ok(stripHidden(sheet.data, allCols, allRows))
	}

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

	return {
		document1,
		document2,
		warnings,
		info,
		footers,
		navTabs,
		numTabs,
		skipSheetIdScan,
		title,
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
	}
}
