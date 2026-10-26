import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isOk } from 'wellcrafted/result'
import { GET } from './+server'
import { requestMetadata, MetadataError } from '#lib/server/metadata-request.js'
import { adjustGoogleFormData, parseGoogleForm } from '#lib/google-document-util/google-form.js'
import { extractFormIntro } from '#lib/server/form-intro.js'

vi.mock('$app/env/private', () => ({ GCP_API_KEY: 'synthetic-key' }))
vi.mock('#lib/server/metadata-request.js', async (original) => ({
	...(await original<typeof import('#lib/server/metadata-request.js')>()),
	requestMetadata: vi.fn(),
}))
const upstream = vi.mocked(requestMetadata)
const formUrl = 'https://docs.google.com/forms/d/e/public-form/viewform'

function fixture(
	description: string | null = 'First paragraph.\n\nSecond paragraph.',
	inputType = 0,
) {
	const data: unknown[][] = []
	data[1] = []
	data[1][0] = description
	data[1][1] = [
		[1, 'Details', 'Bring shoes.\nBring water.', 6],
		[2, 'Photo caption excluded', null, 11],
		[3, 'Travel', '=== Venue ===\nHall A', 6],
		[4, 'Private question', 'Question help excluded', inputType, [[123, [['Secret option']]]]],
		[5, 'After question excluded', 'Later section excluded', 6],
	]
	data[1][8] = 'Public event'
	data[1][24] = [null, '<b>HTML excluded</b>']
	return `<form action="https://docs.google.com/formResponse"></form><script>FB_PUBLIC_LOAD_DATA_ = ${JSON.stringify(data)};</script>`
}
async function metadata(id: string | null, origin?: string) {
	const url = new URL('https://veneer.test/api/form-meta')
	if (id !== null) url.searchParams.set('id', id)
	const request = new Request(url, { headers: origin ? { Origin: origin } : {} })
	return await GET({ url, request } as never)
}
beforeEach(() => {
	upstream.mockReset()
	upstream.mockResolvedValue({ status: 200, text: fixture() })
})

describe('/api/form-meta', () => {
	it('uses the same introductory content as the page without repeated title/description or questions', async () => {
		const parsed = parseGoogleForm(fixture())
		if (!isOk(parsed)) throw new Error('invalid fixture')
		const intro = extractFormIntro(adjustGoogleFormData(parsed.data))
		const response = await metadata('f.public-form')
		const body = await response.json()
		expect(body).toMatchObject({
			status: 'ok',
			type: 'form',
			formId: 'public-form',
			documentId: 'f.public-form',
			veneerId: 'f.public-form',
			title: 'Public event',
			description: intro.description,
			infoText: intro.infoText,
			autoSheets: [],
		})
		expect(body.infoText).toBe(
			'First paragraph.\n\nSecond paragraph.\n\nDetails\nBring shoes.\nBring water.\n\nTravel\n=== Venue ===\nHall A',
		)
		expect(intro.info).toBe(
			'First paragraph.\n\nSecond paragraph.\n\n# Details\nBring shoes.\nBring water.\n\n# Photo caption excluded\n![]()\n\n# Travel\n',
		)
		expect(intro.footers).toEqual(['# Venue\n<div>\nHall A\n</div>'])
		for (const excluded of [
			'Public event',
			'Private question',
			'Secret option',
			'Question help',
			'After question',
			'HTML excluded',
			'Photo caption',
			'formResponse',
		])
			expect(body.infoText).not.toContain(excluded)
		expect(response.headers.get('cache-control')).toBe('no-store')
		expect(response.headers.has('access-control-allow-origin')).toBe(false)
		expect(upstream).toHaveBeenCalledTimes(1)
	})

	it.each([5, 7, 9, 10, 13])('stops introduction at input type %s', async (inputType) => {
		upstream.mockResolvedValue({ status: 200, text: fixture('Intro', inputType) })
		const body = await (await metadata('f.public-form')).json()
		expect(body.infoText).not.toMatch(/Private question|Later section/)
	})

	it.each(['forms.gle', 'bit.ly', 'shorturl.at', 'url.kr'])(
		'resolves %s and bounded multi-hop chains',
		async (host) => {
			upstream.mockImplementation(async (url) =>
				url === formUrl
					? { status: 200, text: fixture() }
					: {
							status: 302,
							location: url.includes('/first') ? 'https://forms.gle/second' : formUrl,
							text: '',
						},
			)
			const body = await (await metadata(`https://${host}/first`)).json()
			expect(body.status).toBe('ok')
			expect(body.infoText).toContain('First paragraph.')
			expect(upstream).toHaveBeenCalledTimes(3)
		},
	)

	it('accepts shortener Veneer IDs and strips prefilled parameters from direct requests', async () => {
		upstream.mockResolvedValueOnce({ status: 301, location: formUrl, text: '' })
		expect((await (await metadata('g.short')).json()).status).toBe('ok')
		await metadata(`${formUrl}?entry.123=private#fragment`)
		expect(upstream).toHaveBeenLastCalledWith(formUrl, 'GET', expect.any(AbortSignal))
	})

	it.each([
		'https://example.com/no',
		'https://constructor/no',
		'http://forms.gle/no',
		'https://user:pass@forms.gle/no',
		'https://forms.gle:444/no',
		'https://docs.google.com.evil.test/forms/d/e/f/viewform',
		'https://127.1/no',
		'https://2130706433/no',
		'https://[::1]/no',
		'https://docs.google.com/forms/d/e/id/formResponse',
	])('rejects unsupported input %s without fetching', async (id) => {
		expect((await (await metadata(id)).json()).status).toBe('unsupported_target')
		expect(upstream).not.toHaveBeenCalled()
	})

	it.each([
		'https://example.com/x',
		'https://127.0.0.1/x',
		'https://docs.google.com/document/d/id',
		'https://accounts.google.com/login',
	])('fails closed on redirect to %s', async (location) => {
		upstream.mockResolvedValue({ status: 302, location, text: '' })
		const body = await (await metadata('b.short')).json()
		expect(body).toMatchObject({ status: 'unsupported_target', type: null, infoText: null })
		expect(upstream).toHaveBeenCalledTimes(1)
	})

	it('bounds loops and redirect chains', async () => {
		upstream.mockResolvedValue({ status: 302, location: 'https://bit.ly/loop', text: '' })
		expect((await (await metadata('b.loop')).json()).status).toBe('limit_exceeded')
		upstream.mockReset().mockImplementation(async () => ({
			status: 302,
			location: `https://bit.ly/hop${upstream.mock.calls.length}`,
			text: '',
		}))
		expect((await (await metadata('b.start')).json()).status).toBe('limit_exceeded')
		expect(upstream).toHaveBeenCalledTimes(5)
	})

	it('reports unavailable, malformed, oversized and timed out Forms explicitly', async () => {
		for (const response of [
			{ status: 403, text: '' },
			{ status: 200, text: '<html>Sign in</html>' },
			{ status: 200, text: 'FB_PUBLIC_LOAD_DATA_ = not JSON;' },
		]) {
			upstream.mockResolvedValue(response)
			expect((await (await metadata('f.public-form')).json()).status).toBe('unavailable')
		}
		for (const code of ['limit_exceeded', 'timeout'] as const) {
			upstream.mockRejectedValue(new MetadataError(code))
			expect((await (await metadata('f.public-form')).json()).status).toBe(code)
		}
	})

	it('represents missing descriptions and an empty intro explicitly', async () => {
		upstream.mockResolvedValue({
			status: 200,
			text: 'FB_PUBLIC_LOAD_DATA_ = [null,[null,[],null,null,null,null,null,null,"Empty"]];',
		})
		expect(await (await metadata('f.empty')).json()).toMatchObject({
			description: null,
			infoText: '',
		})
	})

	it('preserves Sheet metadata and suggestions without fetching cells or rows', async () => {
		const text = fixture('Sheet: https://docs.google.com/spreadsheets/d/sheet-id/edit')
		upstream.mockImplementation(async (url) =>
			url === formUrl
				? { status: 200, text }
				: { status: 200, text: '{"properties":{"title":"Confirmation"}}' },
		)
		expect(await (await metadata('f.public-form')).json()).toMatchObject({
			autoSheets: [{ veneerId: 's.sheet-id', title: 'Confirmation' }],
		})
		expect(await (await metadata('s.sheet-id')).json()).toMatchObject({
			status: 'ok',
			type: 'sheet',
			title: 'Confirmation',
			description: null,
			infoText: null,
		})
		for (const [url] of upstream.mock.calls.filter(([url]) =>
			url.includes('sheets.googleapis.com'),
		)) {
			expect(new URL(url).searchParams.get('fields')).toBe('properties(title)')
			expect(url).not.toMatch(/ranges|rowData|values/)
		}
	})

	it('returns Form metadata even when linked Sheet lookup fails', async () => {
		upstream
			.mockResolvedValueOnce({
				status: 200,
				text: fixture('https://docs.google.com/spreadsheets/d/private/edit'),
			})
			.mockRejectedValue(new MetadataError('unavailable'))
		expect(await (await metadata('f.public-form')).json()).toMatchObject({
			status: 'ok',
			autoSheets: [],
			autoSheetsStatus: 'partial',
		})
	})

	it('retains repeated source paragraphs instead of deduplicating them', async () => {
		upstream.mockResolvedValue({ status: 200, text: fixture('Repeated.\n\nRepeated.') })
		const body = await (await metadata('f.public-form')).json()
		expect(body.description).toBe('Repeated.\n\nRepeated.')
		expect(body.infoText).toMatch(/^Repeated\.\n\nRepeated\./)
	})

	it('bounds Sheet candidates and the aggregate outbound request count', async () => {
		const links = Array.from({ length: 10 }, (_, i) => `https://bit.ly/first${i}`).join('\n')
		upstream.mockImplementation(async (url) => {
			if (url === formUrl) return { status: 200, text: fixture(links) }
			if (url.includes('sheets.googleapis.com'))
				return { status: 200, text: '{"properties":{"title":"Sheet"}}' }
			const token = new URL(url).pathname.slice(1)
			const location = token.startsWith('first')
				? `https://bit.ly/second${token.slice(5)}`
				: token.startsWith('second')
					? `https://bit.ly/third${token.slice(6)}`
					: `https://docs.google.com/spreadsheets/d/sheet${token.slice(5)}`
			return { status: 302, location, text: '' }
		})
		const body = await (await metadata('f.public-form')).json()
		expect(body).toMatchObject({ status: 'ok', autoSheetsStatus: 'partial' })
		expect(body.autoSheets).toHaveLength(4)
		expect(upstream).toHaveBeenCalledTimes(20)
	})

	it.each([
		'https://map.naver.com/p/entry/place/123456789',
		'https://maps.google.com/?q=venue',
		'mailto:organizer@example.test',
		'https://docs.google.com/forms/d/e/other-form/viewform',
		'https://docs.google.com/document/d/document-id/edit',
		'https://docs.google.com/presentation/d/slides-id/edit',
		'https://example.test/event',
	])('keeps Sheet discovery complete for an unrelated link: %s', async (link) => {
		upstream.mockResolvedValue({ status: 200, text: fixture(`Venue: ${link}`) })
		expect(await (await metadata('f.public-form')).json()).toMatchObject({
			status: 'ok',
			autoSheets: [],
			autoSheetsStatus: 'complete',
		})
		expect(upstream).toHaveBeenCalledTimes(1)
	})

	it('filters irrelevant links before applying the Sheet candidate budget', async () => {
		const links = Array.from({ length: 10 }, (_, i) => `https://map.naver.com/p/entry/place/${i}`)
		links.push('https://docs.google.com/spreadsheets/d/sheet-id/edit')
		upstream
			.mockResolvedValueOnce({ status: 200, text: fixture(links.join('\n')) })
			.mockResolvedValue({ status: 200, text: '{"properties":{"title":"Confirmation"}}' })
		expect(await (await metadata('f.public-form')).json()).toMatchObject({
			autoSheets: [{ veneerId: 's.sheet-id', title: 'Confirmation' }],
			autoSheetsStatus: 'complete',
		})
		expect(upstream).toHaveBeenCalledTimes(2)
	})

	it('keeps discovery partial for an unresolved supported shortener', async () => {
		upstream
			.mockResolvedValueOnce({ status: 200, text: fixture('https://bit.ly/unknown') })
			.mockRejectedValue(new MetadataError('unavailable'))
		expect(await (await metadata('f.public-form')).json()).toMatchObject({
			status: 'ok',
			autoSheets: [],
			autoSheetsStatus: 'partial',
		})
		expect(upstream).toHaveBeenCalledTimes(2)
	})

	it('rejects cross-origin calls and missing input without fetching', async () => {
		expect((await metadata('f.public-form', 'https://other.test')).status).toBe(403)
		expect((await (await metadata(null)).json()).status).toBe('invalid_input')
		expect(upstream).not.toHaveBeenCalled()
	})
})
