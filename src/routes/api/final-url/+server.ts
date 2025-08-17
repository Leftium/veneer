import { gg } from '@leftium/gg'
import { json } from '@sveltejs/kit'
import { finalUrl } from './finalurl.js'

export const GET = async ({ url }) => {
	const urlShort = url.searchParams.get('u') || ''

	const results = await finalUrl(urlShort)

	gg(`api/final-url: ${urlShort} -> ${results.urlFinal}`)

	return json(results)
}
