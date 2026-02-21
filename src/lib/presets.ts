// src/lib/presets.ts — Domain-preset system
// See specs/page-options.md for full architecture docs.

/**
 * Maps hostnames to preset names.
 * - `string` value → preset name (looked up in PRESETS)
 * - `null` → no preset, show launcher page
 * - Missing key → unknown domain, show launcher page
 */
export const DOMAIN_PRESETS: Record<string, string | null> = {
	// Dance community sites
	'btango.com': 'btango',
	'tangoclass.btango.com': 'btango-class',
	'tangodj.btango.com': 'btango-dj',
	'vivianblues.com': 'vivianblues',
	'vivibl.com': 'vivianblues',
	'vivimil.com': 'vivianblues',
	'xn--pg3bl5ba.com': 'vivianblues', // IDN alias (비비블.com)

	// Veneer home — no preset, shows launcher
	'veneer.leftium.com': null,
}

export interface Preset {
	tabs: string[]
	defaultFormId?: string
	defaultSheetId?: string
	headerImage: string | null
	headerColor: string
	headerHeight: string
	headerTextColor: string
}

export const PRESETS: Record<string, Preset> = {
	base: {
		tabs: ['info', 'form', 'list'],
		// No default doc IDs — unknown domains render the launcher page.
		headerImage: '/dance_night.gif',
		headerColor: '#0b4474',
		headerHeight: '100px',
		headerTextColor: 'white',
	},
	btango: {
		tabs: ['info', 'form', 'list'],
		defaultFormId: 'g.4EKt4Vyzgq1E5eHC8',
		defaultSheetId: 's.1jwmdTf0fArizqA8IM6EavaTYDKn_uXMKj_VF3K1gw40',
		headerImage: '/dance_night.gif',
		headerColor: '#0b4474',
		headerHeight: '100px',
		headerTextColor: 'white',
	},
	'btango-class': {
		tabs: ['info', 'form', 'list'],
		defaultFormId: 'g.rzQZWr3o17Doj3Nq5',
		defaultSheetId: 's.1bYczvgFwW0t5A858xTIESlhulGP1cBtBlaDBwOHus30',
		headerImage: '/dance_night.gif',
		headerColor: '#0b4474',
		headerHeight: '100px',
		headerTextColor: 'white',
	},
	'btango-dj': {
		tabs: ['form', 'list'],
		defaultFormId: 'g.H9nD4tKrkp1m8ESC9',
		defaultSheetId: 's.16AtRFdLdYfnJRcXTf5N3fcLvZMMu48eECHXpxLHv7VU',
		headerImage: '/dance_night.gif',
		headerColor: '#0b4474',
		headerHeight: '100px',
		headerTextColor: 'white',
	},
	vivianblues: {
		tabs: ['info', 'form', 'list'],
		defaultFormId: 'g.r6eRUz2U9uf5oVFn6',
		defaultSheetId: 's.13E_wsbrKLEsuV-eDaTKl0a967EdpYgcZrXH0Gq_KK3g',
		headerImage: '/dance_night.gif',
		headerColor: '#0b4474',
		headerHeight: '100px',
		headerTextColor: 'white',
	},
	minimal: {
		tabs: ['info'],
		headerImage: null,
		headerColor: '#333',
		headerHeight: '0',
		headerTextColor: 'white',
	},
	kiosk: {
		tabs: ['form'],
		headerImage: null,
		headerColor: '#333',
		headerHeight: '40px',
		headerTextColor: 'white',
	},
}

/**
 * Resolve which preset name applies for a given hostname.
 * Returns the preset name, or `null` if the domain maps to launcher / is unknown.
 */
export function resolvePresetName(hostname: string): string | null {
	const normalized = hostname.replace(/^www\./, '')
	const mapped = DOMAIN_PRESETS[normalized]

	// Explicit null (e.g. veneer.leftium.com) or missing key → no preset
	if (mapped === null || mapped === undefined) return null

	return mapped
}
