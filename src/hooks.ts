// src/hooks.ts — Universal reroute hook
// See specs/page-options.md for full architecture docs.

import { dev } from '$app/environment'
import { deLocalizeUrl } from '$lib/paraglide/runtime'
import { PRESETS, resolvePresetName } from '$lib/presets'

const TAB_NAMES = new Set(['info', 'form', 'list', 'raw', 'dev'])

function isVeneerId(segment: string): boolean {
	return /^[sfgbh]\.[a-zA-Z0-9_-]+$/.test(segment)
}

export const reroute = ({ url }: { url: URL }) => {
	const path = deLocalizeUrl(url).pathname
	const segments = path.split('/').filter(Boolean)
	const first = segments[0]

	// --- Resolve hostname (with dev overrides) ---
	const hostname = ((dev && url.searchParams.get('hostname')) || url.hostname).replace(/^www\./, '')

	// --- Resolve default docs from domain ---
	const presetName = resolvePresetName(hostname)
	const preset = presetName ? PRESETS[presetName] : undefined

	// --- Build normalized path ---
	if (!first || TAB_NAMES.has(first)) {
		// Root or tab-only: prepend default doc IDs from domain preset
		const docs = [preset?.defaultFormId, preset?.defaultSheetId].filter(Boolean).join('/')
		if (!docs) return path // no default docs → fall through (launcher or 404)
		const tab = first ? `/${first}` : ''
		return `/${docs}${tab}`
	}

	if (isVeneerId(first)) {
		// Doc ID(s) provided in URL — pass through
		return path
	}

	// Not a veneer path — pass through to static routes (api, demo, etc.)
	return path
}
