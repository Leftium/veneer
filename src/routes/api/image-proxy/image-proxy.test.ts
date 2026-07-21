import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from './+server'

function request(imageUrl: string | null): Promise<Response> {
	const url = new URL('https://btango.com/api/image-proxy')
	if (imageUrl !== null) url.searchParams.set('url', imageUrl)
	return GET({ url } as never) as Promise<Response>
}

describe('/api/image-proxy', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('rejects missing and unsupported URLs without fetching', async () => {
		const fetch = vi.fn<typeof globalThis.fetch>()
		vi.stubGlobal('fetch', fetch)

		expect((await request(null)).status).toBe(400)
		expect((await request('https://example.com/image.jpg')).status).toBe(403)
		expect(fetch).not.toHaveBeenCalled()
	})

	it('streams images with browser and Vercel cache headers', async () => {
		const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
			new Response('image bytes', {
				headers: { 'Content-Type': 'image/jpeg' },
			}),
		)
		vi.stubGlobal('fetch', fetch)

		const response = await request('https://lh3.googleusercontent.com/formsz/image')

		expect(response.status).toBe(200)
		expect(await response.text()).toBe('image bytes')
		expect(response.headers.get('content-type')).toBe('image/jpeg')
		expect(response.headers.get('content-length')).toBeNull()
		expect(response.headers.get('cache-control')).toBe('public, max-age=604800, immutable')
		expect(response.headers.get('vercel-cdn-cache-control')).toBe('public, max-age=31536000')
	})

	it('proxies the docs.google.com Forms image endpoint', async () => {
		const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
			new Response('header image', {
				headers: { 'Content-Type': 'image/png' },
			}),
		)
		vi.stubGlobal('fetch', fetch)

		const source = 'https://docs.google.com/forms-images-rt/image-id=w1536'
		const response = await request(source)

		expect(response.status).toBe(200)
		expect(fetch).toHaveBeenCalledWith(
			source,
			expect.objectContaining({
				headers: expect.objectContaining({
					Accept: expect.stringContaining('image/avif'),
					'User-Agent': 'Mozilla/5.0',
				}),
				redirect: 'manual',
			}),
		)
	})

	it('rejects active image types and redirects outside Google Forms', async () => {
		const htmlFetch = vi
			.fn<typeof globalThis.fetch>()
			.mockResolvedValue(new Response('not an image', { headers: { 'Content-Type': 'text/html' } }))
		const svgFetch = vi
			.fn<typeof globalThis.fetch>()
			.mockResolvedValue(new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } }))
		const redirectFetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
			new Response(null, {
				status: 302,
				headers: { Location: 'https://example.com/image.jpg' },
			}),
		)

		vi.stubGlobal('fetch', htmlFetch)
		expect((await request('https://lh3.googleusercontent.com/formsz/image')).status).toBe(502)
		vi.stubGlobal('fetch', svgFetch)
		expect((await request('https://lh3.googleusercontent.com/formsz/image')).status).toBe(502)

		vi.stubGlobal('fetch', redirectFetch)
		expect((await request('https://lh3.googleusercontent.com/formsz/image')).status).toBe(502)
	})
})
