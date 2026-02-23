import { dev } from '$app/environment'
import type { Handle } from '@sveltejs/kit'
import { isOk } from 'wellcrafted/result'
import { paraglideMiddleware } from '$lib/paraglide/server'
import { VENEER_ID_REGEX } from '$lib/google-document-util/url-id'
import { fetchWithDocumentId } from '$lib/google-document-util/fetch-document-with-id'
import { PRESETS, resolvePresetName } from '$lib/presets'

/** Escape a string for use in an HTML attribute value. */
function escAttr(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/** Build OG <meta> tag strings from locals.ogMeta. */
function buildOgTags(locals: App.Locals): string {
	const og = locals.ogMeta
	if (!og) return ''

	const tags: string[] = []
	if (og.title) tags.push(`<meta property="og:title" content="${escAttr(og.title)}" />`)
	tags.push(`<meta property="og:type" content="website" />`)
	if (og.url) tags.push(`<meta property="og:url" content="${escAttr(og.url)}" />`)
	if (og.image) tags.push(`<meta property="og:image" content="${escAttr(og.image)}" />`)
	return tags.join('\n\t\t')
}

/**
 * For veneer routes, pre-fetch documents and compute OG metadata.
 * Documents are stashed on locals.documents so +layout.server.ts can
 * reuse them instead of fetching again (avoids double-fetch with ssr=false).
 */
async function preloadVeneerRoute(event: Parameters<Handle>[0]['event']): Promise<void> {
	const { url } = event

	// Match veneer routes: /[id1=vid]/[[id2=vid]]...
	const segments = url.pathname.split('/').filter(Boolean)
	let id1: string | undefined = segments[0]
	let id2: string | undefined = segments[1]

	// If the URL has no veneer IDs (e.g. root "/" on a preset domain),
	// resolve default doc IDs from the domain preset — mirrors reroute in hooks.ts.
	if (!id1 || !VENEER_ID_REGEX.test(id1)) {
		const hostname = ((dev && url.searchParams.get('hostname')) || url.hostname).replace(
			/^www\./,
			'',
		)
		const presetName = resolvePresetName(hostname)
		const preset = presetName ? PRESETS[presetName] : undefined
		if (!preset?.defaultFormId) return
		id1 = preset.defaultFormId
		id2 = preset.defaultSheetId ?? undefined
	} else {
		id2 = id2 && VENEER_ID_REGEX.test(id2) ? id2 : undefined
	}

	// Fetch both documents in parallel (same as +layout.server.ts)
	const [document1, document2] = await Promise.all([
		fetchWithDocumentId(id1),
		fetchWithDocumentId(id2),
	])

	// Stash for +layout.server.ts to reuse
	event.locals.documents = { document1, document2 }

	// --- Compute OG metadata ---
	const hostname = ((dev && url.searchParams.get('hostname')) || url.hostname).replace(/^www\./, '')
	const presetName = url.searchParams.get('preset') || resolvePresetName(hostname) || 'base'
	const preset = PRESETS[presetName] || PRESETS['base']

	const ogImageParam = url.searchParams.get('ogImage')
	const headerImageParam = url.searchParams.get('headerImage')

	// Find the form and/or sheet document (could be in either position)
	const form =
		(isOk(document1) && document1.data.type === 'form' ? document1.data : null) ??
		(isOk(document2) && document2.data.type === 'form' ? document2.data : null)
	const sheet =
		(isOk(document1) && document1.data.type === 'sheet' ? document1.data : null) ??
		(isOk(document2) && document2.data.type === 'sheet' ? document2.data : null)

	let title = ''
	let formHeaderImage: string | null = null
	let markedOgImage: string | null = null
	let firstFormImage: string | null = null

	if (form) {
		title = form.title
		formHeaderImage = form.headerImageUrl ?? null

		markedOgImage =
			form.fields
				.find((f) => f.type === 'IMAGE' && /^og:/i.test(f.title))
				?.imgUrl?.replace(/=w\d+$/i, '') ?? null

		firstFormImage =
			form.fields.find((f) => f.type === 'IMAGE')?.imgUrl?.replace(/=w\d+$/i, '') ?? null
	} else if (sheet) {
		title = sheet.title
	}

	// Resolve header image (same priority as +layout.server.ts)
	const headerImage =
		headerImageParam === 'none'
			? null
			: headerImageParam === 'form' || headerImageParam == null
				? (formHeaderImage ?? preset.headerImage)
				: (headerImageParam ?? preset.headerImage)

	// OG image priority: ?ogImage= param > og:-marked > first form image > header image
	const ogImage =
		ogImageParam === 'none'
			? null
			: ogImageParam === 'header'
				? headerImage || null
				: ogImageParam === 'first'
					? firstFormImage || null
					: ogImageParam
						? ogImageParam
						: markedOgImage || firstFormImage || headerImage || null

	event.locals.ogMeta = { title, image: ogImage, url: url.href }
}

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, async ({ request, locale }) => {
		event.request = request

		// Pre-fetch documents & compute OG metadata before resolve()
		await preloadVeneerRoute(event)

		return resolve(event, {
			transformPageChunk: ({ html }) => {
				let result = html.replace('%paraglide.lang%', locale)

				// Inject OG meta tags before </head>.
				// (%sveltekit.head% is already consumed by SvelteKit before
				// transformPageChunk fires, so we target </head> instead.)
				const ogTags = buildOgTags(event.locals)
				if (ogTags) {
					result = result.replace('</head>', `\t\t${ogTags}\n\t</head>`)
				}

				return result
			},
		})
	})

export const handle: Handle = handleParaglide
