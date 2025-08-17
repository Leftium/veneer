import { json } from '@sveltejs/kit'
import { finalUrl } from './finalurl.js'

export const GET = async ({ url }) => {
	const urlShort = url.searchParams.get('u') || ''

	const results = await finalUrl(urlShort)


	return json(results)
}
