export const load = async ({ fetch, url }) => {
	const fetchUrl = `/__open-in-editor${url.search}`

	console.log(`Fetching: ${fetchUrl}`)
	fetch(fetchUrl)

	return {}
}
