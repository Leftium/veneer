// src/lib/presets.ts — Domain-preset system
// See specs/page-options.md for full architecture docs.

/** Google Forms default theme colors (unmodified form). */
export const GOOGLE_FORM_ACCENT = '#673ab7'
export const GOOGLE_FORM_BG = '#f0ebf8'

/** Mix a #rrggbb hex color with black. `amount` 0–1 = how much black (0.5 = 50% darker). */
export function darkenHex(hex: string, amount = 0.5): string {
	if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex
	const r = Math.round(parseInt(hex.slice(1, 3), 16) * (1 - amount))
	const g = Math.round(parseInt(hex.slice(3, 5), 16) * (1 - amount))
	const b = Math.round(parseInt(hex.slice(5, 7), 16) * (1 - amount))
	return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')
}

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
	'vivianblues.com': 'vivimil',
	'vivibl.com': 'vivimil',
	'vivimil.com': 'vivimil',
	'xn--pg3bl5ba.com': 'vivimil', // IDN alias (비비블.com)

	// Party site
	'party.leftium.com': 'party',

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
	headerImageFit: string
	accentColor?: string
	bgColor?: string
}

export const PRESETS: Record<string, Preset> = {
	base: {
		tabs: ['info', 'form', 'list'],
		// No default doc IDs — unknown domains render the launcher page.
		headerImage: null,
		headerColor: '#0b4474',
		headerHeight: '100px',
		headerTextColor: 'white',
		headerImageFit: 'cover',
	},
	btango: {
		tabs: ['info', 'form', 'list'],
		defaultFormId: 'g.4EKt4Vyzgq1E5eHC8',
		defaultSheetId: 's.1jwmdTf0fArizqA8IM6EavaTYDKn_uXMKj_VF3K1gw40',
		headerImage: '/dance_night.gif',
		headerColor: '#0b4474',
		headerHeight: '100px',
		headerTextColor: 'white',
		headerImageFit: 'cover',
	},
	'btango-class': {
		tabs: ['info', 'form', 'list'],
		defaultFormId: 'g.rzQZWr3o17Doj3Nq5',
		defaultSheetId: 's.1bYczvgFwW0t5A858xTIESlhulGP1cBtBlaDBwOHus30',
		headerImage: '/dance_night.gif',
		headerColor: '#0b4474',
		headerHeight: '100px',
		headerTextColor: 'white',
		headerImageFit: 'cover',
	},
	'btango-dj': {
		tabs: ['form', 'list'],
		defaultFormId: 'g.H9nD4tKrkp1m8ESC9',
		defaultSheetId: 's.16AtRFdLdYfnJRcXTf5N3fcLvZMMu48eECHXpxLHv7VU',
		headerImage: '/dance_night.gif',
		headerColor: '#0b4474',
		headerHeight: '100px',
		headerTextColor: 'white',
		headerImageFit: 'cover',
	},
	vivimil: {
		tabs: ['info', 'form', 'list'],
		defaultFormId: 'g.r6eRUz2U9uf5oVFn6',
		defaultSheetId: 's.13E_wsbrKLEsuV-eDaTKl0a967EdpYgcZrXH0Gq_KK3g',
		headerImage: '/dance_night.gif',
		headerColor: '#0b4474',
		headerHeight: '100px',
		headerTextColor: 'white',
		headerImageFit: 'cover',
	},
	party: {
		tabs: ['form', 'list'],
		defaultFormId: 'g.DQszzU7SKC7U96hq7',
		defaultSheetId: 's.1N8Rkj-CLJs_Kx6315odpH0Idnc6xwSQqTry-pCCB9ak',
		headerImage: '/dance_night.gif',
		headerColor: '#0b4474',
		headerHeight: '100px',
		headerTextColor: 'white',
		headerImageFit: 'cover',
	},
	minimal: {
		tabs: ['info'],
		headerImage: null,
		headerColor: '#333',
		headerHeight: '0',
		headerTextColor: 'white',
		headerImageFit: 'cover',
	},
	kiosk: {
		tabs: ['form'],
		headerImage: null,
		headerColor: '#333',
		headerHeight: '40px',
		headerTextColor: 'white',
		headerImageFit: 'cover',
	},
}

/** Presets shown in the launcher/builder dropdown (subset of PRESETS). */
export const LAUNCHER_PRESETS = ['base', 'vivimil', 'btango-dj'] as const

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
