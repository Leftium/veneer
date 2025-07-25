import { gg } from '@leftium/gg'
import { json } from '@sveltejs/kit'

export const GET = async ({ url, fetch }) => {
	const urlShort = url.searchParams.get('u') || ''

	if (!urlShort) {
		return json({
			urlShort,
			status: 444,
			statusText: 'Missing u param.',
		})
	}
	const fetched = await fetch(urlShort, {
		method: 'HEAD',
		redirect: 'manual',
	})

	const urlFinal = fetched.headers.get('location')

	gg(`api/final-url: ${urlShort} -> ${urlFinal}`)

	return json({
		urlShort,
		// The redirect URL in the Location header
		urlFinal,
		status: fetched.status,
		statusText: fetched.statusText,
	})
}
