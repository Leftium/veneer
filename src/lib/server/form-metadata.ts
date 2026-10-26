import { GCP_API_KEY } from '$app/env/private'
import { isErr } from 'wellcrafted/result'
import { adjustGoogleFormData, parseGoogleForm } from '#lib/google-document-util/google-form.js'
import { extractSheetLinkCandidates } from '#lib/google-document-util/scan-sheet-links.js'
import { URL_TEMPLATES, VENEER_ID_REGEX } from '#lib/google-document-util/url-id.js'
import { extractFormIntro } from './form-intro.js'
import {
	allowedMetadataUrl,
	MetadataError,
	requestMetadata,
	SHORT_HOSTS,
} from './metadata-request.js'

export const EMPTY_METADATA = {
	type: null,
	documentId: null,
	formId: null,
	veneerId: null,
	title: '',
	headerImageUrl: null,
	accentColor: null,
	bgColor: null,
	description: null,
	infoText: null,
	autoSheets: [] as { veneerId: string; title: string }[],
}

function inputUrl(input: string) {
	const match = input.match(VENEER_ID_REGEX)
	const value = match
		? URL_TEMPLATES[match.groups!.prefix].replace('{ID}', match.groups!.id)
		: input
	const url = allowedMetadataUrl(value)
	// Do not carry prefilled answers, tracking parameters or fragments into requests.
	url.search = ''
	url.hash = ''
	return url.href
}

function documentFromUrl(value: string) {
	const url = allowedMetadataUrl(value)
	if (url.hostname !== 'docs.google.com') return null
	const match = url.pathname.match(/^\/(forms\/d\/e|spreadsheets\/d(?:\/e)?)\/([a-zA-Z0-9_-]+)/)!
	const type = match[1].startsWith('forms') ? ('form' as const) : ('sheet' as const)
	const id = match[2]
	return { type, id, documentId: `${type === 'form' ? 'f' : 's'}.${id}` }
}

function isSheetLinkCandidate(value: string) {
	try {
		const url = new URL(value)
		// Shorteners remain ambiguous until resolved. Other document types and
		// unrelated hosts cannot produce a Sheet through the supported resolver.
		return (
			Object.hasOwn(SHORT_HOSTS, url.hostname) ||
			(url.hostname === 'docs.google.com' && /^\/spreadsheets(?:\/|$)/.test(url.pathname)) ||
			(url.hostname === 'sheets.googleapis.com' && /^\/v4\/spreadsheets(?:\/|$)/.test(url.pathname))
		)
	} catch {
		return false
	}
}

/** Request-local budgets and reuse only. No document data is persisted. */
export async function getFormMetadata(input: string) {
	const signal = AbortSignal.timeout(15_000)
	let requests = 0
	const responses = new Map<string, Awaited<ReturnType<typeof requestMetadata>>>()
	async function read(url: string, method: 'GET' | 'HEAD') {
		if (signal.aborted) throw new MetadataError('timeout')
		const key = `${method} ${url}`
		if (responses.has(key)) return responses.get(key)!
		if (++requests > 20) throw new MetadataError('limit_exceeded')
		const response = await requestMetadata(url, method, signal)
		responses.set(key, response)
		return response
	}
	async function resolve(input: string) {
		let url = inputUrl(input)
		const seen = new Set<string>()
		for (let hop = 0; ; hop++) {
			const document = documentFromUrl(url)
			if (document) return document
			if (hop >= 5 || seen.has(url)) throw new MetadataError('limit_exceeded')
			seen.add(url)
			if (!Object.hasOwn(SHORT_HOSTS, new URL(url).hostname))
				throw new MetadataError('unsupported_target')
			const response = await read(url, 'HEAD')
			if (![301, 302, 303, 307, 308].includes(response.status) || !response.location)
				throw new MetadataError('unavailable')
			url = inputUrl(new URL(response.location, url).href)
		}
	}
	async function sheetTitle(id: string) {
		if (!GCP_API_KEY) throw new MetadataError('unavailable')
		const params = new URLSearchParams({ fields: 'properties(title)', key: GCP_API_KEY })
		const response = await read(
			`https://sheets.googleapis.com/v4/spreadsheets/${id}?${params}`,
			'GET',
		)
		if (response.status !== 200) throw new MetadataError('unavailable')
		const title = JSON.parse(response.text)?.properties?.title
		if (typeof title !== 'string') throw new MetadataError('unavailable')
		return title
	}
	const document = await resolve(input)
	const identity = {
		type: document.type,
		documentId: document.documentId,
		veneerId: document.documentId,
	}
	if (document.type === 'sheet') {
		return {
			...EMPTY_METADATA,
			...identity,
			status: 'ok' as const,
			title: await sheetTitle(document.id),
		}
	}

	let url = URL_TEMPLATES.f.replace('{ID}', document.id)
	const seen = new Set<string>()
	let html: string
	for (let hop = 0; ; hop++) {
		if (hop > 5 || seen.has(url)) throw new MetadataError('limit_exceeded')
		seen.add(url)
		const response = await read(url, 'GET')
		if (response.status === 200) {
			html = response.text
			break
		}
		if (![301, 302, 303, 307, 308].includes(response.status) || !response.location)
			throw new MetadataError('unavailable')
		const next = inputUrl(new URL(response.location, url).href)
		if (documentFromUrl(next)?.documentId !== document.documentId)
			throw new MetadataError('unsupported_target')
		url = next
	}
	const parsed = parseGoogleForm(html)
	if (isErr(parsed) || typeof parsed.data.title !== 'string') throw new MetadataError('unavailable')
	const form = adjustGoogleFormData(parsed.data)
	const { description, infoText } = extractFormIntro(form)
	const candidates = extractSheetLinkCandidates(form.descriptionHtml, infoText).filter(
		isSheetLinkCandidate,
	)
	const autoSheets: { veneerId: string; title: string }[] = []
	const seenSheets = new Set<string>()
	let autoSheetsStatus: 'complete' | 'partial' = candidates.length > 8 ? 'partial' : 'complete'
	for (const candidate of candidates.slice(0, 8)) {
		try {
			const sheet = await resolve(candidate)
			if (sheet.type !== 'sheet' || seenSheets.has(sheet.documentId)) continue
			seenSheets.add(sheet.documentId)
			autoSheets.push({ veneerId: sheet.documentId, title: await sheetTitle(sheet.id) })
		} catch {
			autoSheetsStatus = 'partial'
		}
	}
	return {
		...identity,
		status: 'ok' as const,
		formId: document.id,
		title: form.title,
		headerImageUrl: form.headerImageUrl,
		accentColor: form.accentColor ?? null,
		bgColor: form.bgColor ?? null,
		description,
		infoText,
		autoSheets,
		autoSheetsStatus,
	}
}
