const GOOGLE_FORMS_CONTENT_HOST = /^lh[^.]*\.googleusercontent\.com$/i
const GOOGLE_FORMS_IMAGE_PATH = '/forms-images-rt/'

export function isGoogleFormsImageUrl(value: string): boolean {
	try {
		const url = new URL(value)
		if (url.protocol !== 'https:') return false

		return (
			(GOOGLE_FORMS_CONTENT_HOST.test(url.hostname) && url.pathname.startsWith('/formsz/')) ||
			(url.hostname === 'docs.google.com' && url.pathname.startsWith(GOOGLE_FORMS_IMAGE_PATH))
		)
	} catch {
		return false
	}
}

export function extractGoogleFormsImageUrls(html: string): string[] {
	return [...html.matchAll(/<img\b[^>]*\bsrc=(["'])(https:\/\/.*?)\1/gi)]
		.map((match) => match[2]?.replaceAll('&amp;', '&'))
		.filter((url): url is string => !!url && isGoogleFormsImageUrl(url))
}

/**
 * Route Google-hosted images through our origin so browser CORP checks do not
 * block them. Other URLs, including local preset assets, remain unchanged.
 */
export function googleImageUrl(value: string | null | undefined, origin?: string): string {
	if (!value || !isGoogleFormsImageUrl(value)) return value ?? ''

	const path = `/api/image-proxy?url=${encodeURIComponent(value)}`
	return origin ? new URL(path, origin).href : path
}
