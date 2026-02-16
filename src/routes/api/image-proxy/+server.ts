import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ url }) => {
	const imageUrl = url.searchParams.get('url')

	if (!imageUrl) {
		return new Response('Missing url parameter', { status: 400 })
	}

	// Only allow proxying googleusercontent.com images
	if (!imageUrl.includes('googleusercontent.com/')) {
		return new Response('Only Google image URLs are allowed', { status: 403 })
	}

	const response = await fetch(imageUrl)

	if (!response.ok) {
		return new Response(`Upstream error: ${response.status}`, { status: response.status })
	}

	const contentType = response.headers.get('content-type') || 'image/jpeg'
	const body = await response.arrayBuffer()

	return new Response(body, {
		headers: {
			'content-type': contentType,
			'cache-control': 'public, max-age=86400',
		},
	})
}
