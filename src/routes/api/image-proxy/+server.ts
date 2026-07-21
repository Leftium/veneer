import type { RequestHandler } from './$types'
import { isGoogleFormsImageUrl } from '$lib/google-document-util/google-image-url'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_REDIRECTS = 3
const UPSTREAM_TIMEOUT_MS = 15_000
const ALLOWED_IMAGE_TYPES = new Set([
	'image/apng',
	'image/avif',
	'image/gif',
	'image/jpeg',
	'image/png',
	'image/webp',
])

function errorResponse(message: string, status: number): Response {
	return new Response(message, {
		status,
		headers: {
			'Cache-Control': 'no-store',
			'Content-Type': 'text/plain; charset=utf-8',
		},
	})
}

export const GET: RequestHandler = async ({ url }) => {
	const imageUrl = url.searchParams.get('url')
	if (!imageUrl) return errorResponse('Missing url parameter', 400)
	if (!isGoogleFormsImageUrl(imageUrl)) return errorResponse('Unsupported image URL', 403)

	let upstream: Response
	let upstreamUrl = imageUrl
	const timeoutSignal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
	try {
		let redirects = 0
		while (true) {
			upstream = await globalThis.fetch(upstreamUrl, {
				headers: {
					Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
					'User-Agent': 'Mozilla/5.0',
				},
				redirect: 'manual',
				signal: timeoutSignal,
			})

			if (upstream.status < 300 || upstream.status >= 400) break
			if (redirects >= MAX_REDIRECTS) return errorResponse('Too many image redirects', 502)

			const location = upstream.headers.get('location')
			if (!location) return errorResponse('Invalid upstream image redirect', 502)

			upstreamUrl = new URL(location, upstreamUrl).href
			if (!isGoogleFormsImageUrl(upstreamUrl)) {
				return errorResponse('Unsupported image redirect', 502)
			}
			redirects++
		}
	} catch {
		return errorResponse('Upstream image request failed', 502)
	}

	if (!upstream.ok || !upstream.body) {
		return errorResponse(`Upstream image error: ${upstream.status}`, 502)
	}

	const contentType = upstream.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
	if (!contentType || !ALLOWED_IMAGE_TYPES.has(contentType)) {
		return errorResponse('Unsupported upstream image type', 502)
	}

	const contentLengthHeader = upstream.headers.get('content-length')
	const contentLength = contentLengthHeader ? Number(contentLengthHeader) : null
	if (contentLength !== null && Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
		return errorResponse('Upstream image is too large', 413)
	}

	const headers = new Headers({
		'Cache-Control': 'public, max-age=604800, immutable',
		'Content-Type': contentType,
		'Cross-Origin-Resource-Policy': 'cross-origin',
		'Vercel-CDN-Cache-Control': 'public, max-age=31536000',
		'X-Content-Type-Options': 'nosniff',
	})
	if (contentLength !== null && Number.isFinite(contentLength) && contentLength >= 0) {
		headers.set('Content-Length', String(contentLength))
	}

	let streamedBytes = 0
	const body = upstream.body.pipeThrough(
		new TransformStream<Uint8Array, Uint8Array>({
			transform(chunk, controller) {
				streamedBytes += chunk.byteLength
				if (streamedBytes > MAX_IMAGE_BYTES) {
					controller.error(new Error('Upstream image is too large'))
					return
				}
				controller.enqueue(chunk)
			},
		}),
	)

	return new Response(body, { headers })
}
