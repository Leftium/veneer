import type { RequestHandler } from '@sveltejs/kit'
import { EMPTY_METADATA, getFormMetadata } from '#lib/server/form-metadata.js'
import { MetadataError } from '#lib/server/metadata-request.js'

/** Cross-app consumers use a same-origin proxy after the user's enrichment opt-in. */
export const GET: RequestHandler = async ({ url, request }) => {
	const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
	const origin = request.headers.get('origin')
	if (origin && origin !== url.origin) {
		return Response.json(
			{ ...EMPTY_METADATA, status: 'forbidden_origin' },
			{ status: 403, headers },
		)
	}
	const id = url.searchParams.get('id')
	if (!id) return Response.json({ ...EMPTY_METADATA, status: 'invalid_input' }, { headers })
	try {
		return Response.json(await getFormMetadata(id), { headers })
	} catch (error) {
		// Keep launcher failures graceful; external clients must inspect the status discriminator.
		return Response.json(
			{
				...EMPTY_METADATA,
				status: error instanceof MetadataError ? error.code : 'unavailable',
			},
			{ headers },
		)
	}
}
