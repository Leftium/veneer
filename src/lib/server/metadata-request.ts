import { lookup } from 'node:dns/promises'
import type { LookupAddress } from 'node:dns'
import { request } from 'node:https'
import { BlockList, isIP } from 'node:net'

export class MetadataError extends Error {
	constructor(
		public code:
			'invalid_input' | 'unsupported_target' | 'unavailable' | 'limit_exceeded' | 'timeout',
	) {
		super(code)
	}
}

const blocked = new BlockList()
for (const [address, prefix] of [
	['0.0.0.0', 8],
	['10.0.0.0', 8],
	['100.64.0.0', 10],
	['127.0.0.0', 8],
	['169.254.0.0', 16],
	['172.16.0.0', 12],
	['192.0.0.0', 24],
	['192.0.2.0', 24],
	['192.168.0.0', 16],
	['192.88.99.0', 24],
	['198.18.0.0', 15],
	['198.51.100.0', 24],
	['203.0.113.0', 24],
	['224.0.0.0', 3],
] as const)
	blocked.addSubnet(address, prefix)
const globalIPv6 = new BlockList()
globalIPv6.addSubnet('2000::', 3, 'ipv6')
blocked.addSubnet('2001::', 23, 'ipv6')
blocked.addSubnet('2001:db8::', 32, 'ipv6')
blocked.addSubnet('2002::', 16, 'ipv6')
blocked.addSubnet('3fff::', 20, 'ipv6')

export function isPublicAddress(address: string) {
	const family = isIP(address)
	return family === 4
		? !blocked.check(address)
		: family === 6 && globalIPv6.check(address, 'ipv6') && !blocked.check(address, 'ipv6')
}

export const SHORT_HOSTS: Record<string, string> = {
	'forms.gle': 'g',
	'bit.ly': 'b',
	'shorturl.at': 'h',
	'url.kr': 'u',
}

/** Validate the parsed authority before examining paths, including on every redirect. */
export function allowedMetadataUrl(value: string) {
	let url: URL
	try {
		url = new URL(value)
	} catch {
		throw new MetadataError('invalid_input')
	}
	if (
		value.length > 2048 ||
		url.protocol !== 'https:' ||
		url.username ||
		url.password ||
		url.port
	) {
		throw new MetadataError('unsupported_target')
	}
	if (Object.hasOwn(SHORT_HOSTS, url.hostname) && /^\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname))
		return url
	if (
		url.hostname === 'docs.google.com' &&
		/^\/(forms\/d\/e|spreadsheets\/d(?:\/e)?)\/[a-zA-Z0-9_-]+(?:\/(?:viewform|edit|preview|pubhtml|pub))?\/?$/.test(
			url.pathname,
		)
	)
		return url
	// Sheet requests are generated internally with only the properties.title projection.
	if (
		url.hostname === 'sheets.googleapis.com' &&
		/^\/v4\/spreadsheets\/[a-zA-Z0-9_-]+$/.test(url.pathname) &&
		url.searchParams.get('fields') === 'properties(title)' &&
		[...url.searchParams.keys()].every((key) => ['fields', 'key'].includes(key))
	)
		return url
	throw new MetadataError('unsupported_target')
}

export type MetadataResponse = { status: number; location?: string; text: string }
export const MAX_METADATA_BYTES = 4 * 1024 * 1024

/** No automatic redirects, pooled sockets, cookies, compression, or second DNS lookup. */
export async function requestMetadata(
	value: string,
	method: 'GET' | 'HEAD',
	signal: AbortSignal,
): Promise<MetadataResponse> {
	const url = allowedMetadataUrl(value)
	if (signal.aborted) throw new MetadataError('timeout')
	const addresses = await new Promise<LookupAddress[]>((resolve, reject) => {
		const abort = () => reject(new MetadataError('timeout'))
		signal.addEventListener('abort', abort, { once: true })
		lookup(url.hostname, { all: true }).then(
			(result) => {
				signal.removeEventListener('abort', abort)
				resolve(result)
			},
			() => {
				signal.removeEventListener('abort', abort)
				reject(new MetadataError('unavailable'))
			},
		)
	})
	if (signal.aborted) throw new MetadataError('timeout')
	if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address)))
		throw new MetadataError('unsupported_target')
	const pinned = addresses[0]
	return new Promise((resolve, reject) => {
		const req = request(
			url,
			{
				method,
				signal,
				agent: false,
				family: pinned.family,
				headers: { Accept: 'text/html,application/json', 'Accept-Encoding': 'identity' },
				lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family),
			},
			(res) => {
				const status = res.statusCode ?? 502
				const location = res.headers.location
				const length = Number(res.headers['content-length'] ?? 0)
				if (
					length > MAX_METADATA_BYTES ||
					(res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity')
				) {
					reject(new MetadataError('limit_exceeded'))
					res.destroy()
					return
				}
				if (method === 'HEAD' || (status >= 300 && status < 400)) {
					resolve({ status, location, text: '' })
					res.destroy()
					return
				}
				const chunks: Buffer[] = []
				let size = 0
				res.on('data', (chunk: Buffer) => {
					size += chunk.length
					if (size > MAX_METADATA_BYTES) {
						reject(new MetadataError('limit_exceeded'))
						res.destroy()
						return
					}
					chunks.push(chunk)
				})
				res.on('end', () =>
					resolve({ status, location, text: Buffer.concat(chunks).toString('utf8') }),
				)
				res.on('error', () => reject(new MetadataError(signal.aborted ? 'timeout' : 'unavailable')))
				res.on('aborted', () => reject(new MetadataError('unavailable')))
			},
		)
		req.on('error', () => reject(new MetadataError(signal.aborted ? 'timeout' : 'unavailable')))
		req.end()
	})
}
