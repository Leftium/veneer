import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isPublicAddress, MAX_METADATA_BYTES, requestMetadata } from './metadata-request'

vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }))
vi.mock('node:https', () => ({ request: vi.fn() }))
const dns = vi.mocked(lookup)
const https = vi.mocked(request)

function respond(text: string | Buffer, headers = {}, statusCode = 200) {
	https.mockImplementation(((
		_url: unknown,
		_options: unknown,
		callback: (res: unknown) => void,
	) => {
		const req = new EventEmitter()
		Object.assign(req, {
			end: () => {
				const res = Object.assign(Readable.from([Buffer.from(text)]), { headers, statusCode })
				callback(res)
			},
		})
		return req
	}) as typeof request)
}

beforeEach(() => {
	dns.mockReset().mockResolvedValue([{ address: '142.250.1.1', family: 4 }] as never)
	https.mockReset()
	respond('public form')
})

describe('restricted metadata transport', () => {
	it.each([
		'0.0.0.0',
		'10.0.0.1',
		'100.64.0.1',
		'127.0.0.1',
		'169.254.169.254',
		'172.16.0.1',
		'192.168.0.1',
		'192.0.2.1',
		'198.18.0.1',
		'198.51.100.1',
		'203.0.113.1',
		'224.0.0.1',
		'255.255.255.255',
		'::1',
		'::ffff:127.0.0.1',
		'fc00::1',
		'fe80::1',
		'2001:db8::1',
		'2002:7f00:1::',
		'bad-ip',
	])('blocks nonpublic IP %s', (ip) => expect(isPublicAddress(ip)).toBe(false))
	it.each(['8.8.8.8', '142.250.1.1', '2607:f8b0:4005:805::200e'])('allows public IP %s', (ip) =>
		expect(isPublicAddress(ip)).toBe(true),
	)

	it('pins the validated address and retains the original TLS hostname', async () => {
		expect(
			await requestMetadata('https://forms.gle/public', 'HEAD', AbortSignal.timeout(1000)),
		).toMatchObject({ status: 200 })
		const [url, options] = https.mock.calls[0]
		expect(String(url)).toBe('https://forms.gle/public')
		expect(options).toMatchObject({ agent: false, family: 4, method: 'HEAD' })
		const callback = vi.fn()
		;(options as { lookup: (...args: unknown[]) => void }).lookup('forms.gle', {}, callback)
		expect(callback).toHaveBeenCalledWith(null, '142.250.1.1', 4)
		expect(dns).toHaveBeenCalledTimes(1)
	})

	it('rejects mixed public/private DNS answers before connecting', async () => {
		dns.mockResolvedValue([
			{ address: '8.8.8.8', family: 4 },
			{ address: '127.0.0.1', family: 4 },
		] as never)
		await expect(
			requestMetadata('https://forms.gle/public', 'HEAD', AbortSignal.timeout(1000)),
		).rejects.toMatchObject({ code: 'unsupported_target' })
		expect(https).not.toHaveBeenCalled()
	})

	it('bounds declared and streamed body sizes', async () => {
		respond('small', { 'content-length': String(MAX_METADATA_BYTES + 1) })
		await expect(
			requestMetadata(
				'https://docs.google.com/forms/d/e/id/viewform',
				'GET',
				AbortSignal.timeout(1000),
			),
		).rejects.toMatchObject({ code: 'limit_exceeded' })
		respond(Buffer.alloc(MAX_METADATA_BYTES + 1))
		await expect(
			requestMetadata(
				'https://docs.google.com/forms/d/e/id/viewform',
				'GET',
				AbortSignal.timeout(1000),
			),
		).rejects.toMatchObject({ code: 'limit_exceeded' })
	})

	it('checks DNS for each connection and fails closed when a later answer changes', async () => {
		await requestMetadata('https://forms.gle/public', 'HEAD', AbortSignal.timeout(1000))
		dns.mockResolvedValue([{ address: '169.254.169.254', family: 4 }] as never)
		await expect(
			requestMetadata('https://forms.gle/next', 'HEAD', AbortSignal.timeout(1000)),
		).rejects.toMatchObject({ code: 'unsupported_target' })
		expect(https).toHaveBeenCalledTimes(1)
	})

	it('rejects compressed bodies and already-aborted operations', async () => {
		respond('compressed', { 'content-encoding': 'gzip' })
		await expect(
			requestMetadata(
				'https://docs.google.com/forms/d/e/id/viewform',
				'GET',
				AbortSignal.timeout(1000),
			),
		).rejects.toMatchObject({ code: 'limit_exceeded' })
		const controller = new AbortController()
		controller.abort()
		await expect(
			requestMetadata('https://forms.gle/public', 'HEAD', controller.signal),
		).rejects.toMatchObject({ code: 'timeout' })
	})

	it('times out DNS resolution without opening a socket', async () => {
		dns.mockImplementation(() => new Promise(() => {}))
		await expect(
			requestMetadata('https://forms.gle/public', 'HEAD', AbortSignal.timeout(10)),
		).rejects.toMatchObject({ code: 'timeout' })
		expect(https).not.toHaveBeenCalled()
	})
})
