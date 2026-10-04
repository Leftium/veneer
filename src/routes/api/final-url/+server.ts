import { gg } from '@leftium/gg'
import { finalUrl } from './finalurl.js'

export const GET = async ({ url }) => {
	const urlShort = url.searchParams.get('u') || ''

	const results = await finalUrl(urlShort)

	gg(`api/final-url: ${urlShort} -> ${results.urlFinal}`)

	return Response.json(results)
}
