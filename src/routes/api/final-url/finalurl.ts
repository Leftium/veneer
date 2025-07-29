export async function finalUrl(urlShort: string) {
	if (!urlShort) {
		return {
			urlShort,
			status: 444,
			statusText: 'Missing urlShort.',
		}
	}

	const fetched = await fetch(urlShort, {
		method: 'HEAD',
		redirect: 'manual',
	})

	const urlFinal = fetched.headers.get('location')

	return {
		urlShort,
		// The redirect URL in the Location header
		urlFinal,
		status: fetched.status,
		statusText: fetched.statusText,
	}
}
