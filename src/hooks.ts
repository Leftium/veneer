// src/hooks.ts
import { deLocalizeUrl } from '$lib/paraglide/runtime'
import { ok, err } from 'neverthrow'
import type { Transport } from '@sveltejs/kit'
import { env } from '$env/dynamic/public'

export const transport: Transport = {
	Result: {
		encode: (r) => {
			if (r) {
				if (r.isOk && r.isOk()) {
					return { value: r.value }
				}

				if (r.isErr && r.isErr()) {
					return { error: r.error }
				}
			}

			return false
		},
		decode: (data) => {
			if ('value' in data) {
				return ok(data.value)
			}

			return err(data.error)
		},
	},
}

// Each entry maps a redirect target to all domains that should use it.
// www. is stripped before matching, so don't include www. variants here.
const SITES = [
	{
		redirect: '/7/g.rzQZWr3o17Doj3Nq5/s.1bYczvgFwW0t5A858xTIESlhulGP1cBtBlaDBwOHus30/',
		domains: ['tangoclass.btango.com'],
	},
	{
		redirect: '/7/g.4EKt4Vyzgq1E5eHC8/s.1jwmdTf0fArizqA8IM6EavaTYDKn_uXMKj_VF3K1gw40',
		domains: ['btango.com'],
	},
	{
		redirect: '/6/g.H9nD4tKrkp1m8ESC9/s.16AtRFdLdYfnJRcXTf5N3fcLvZMMu48eECHXpxLHv7VU',
		domains: ['tangodj.btango.com'],
	},
	{
		redirect: '/7/g.r6eRUz2U9uf5oVFn6/s.13E_wsbrKLEsuV-eDaTKl0a967EdpYgcZrXH0Gq_KK3g',
		domains: ['vivianblues.com', 'vivibl.com', 'vivimil.com', 'xn--pg3bl5ba.com'],
	},
]

const DEFAULT_REDIRECT = '/15/g.chwbD7sLmAoLe65Z8/s.1Ucjl2Ww4RGgzrHuTBI814rWVlyP8ieq8EcxcMCtux90'

const SITE_MAP: Record<string, string> = Object.fromEntries(
	SITES.flatMap(({ redirect, domains }) => domains.map((d) => [d, redirect])),
)

export const reroute = ({ url }: { url: URL }) => {
	if (url.pathname === '/') {
		const hostname = url.hostname.replace(/^www\./, '')
		const devHostname = url.searchParams.get('hostname') ?? env.PUBLIC_HOSTNAME ?? ''
		const target = SITE_MAP[hostname] ?? SITE_MAP[devHostname] ?? DEFAULT_REDIRECT
		return target
	}
	return deLocalizeUrl(url).pathname
}
