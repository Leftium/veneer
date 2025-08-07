import { deLocalizeUrl } from '$lib/paraglide/runtime'
// src/hooks.ts
import { ok, err } from 'neverthrow'
import type { Transport } from '@sveltejs/kit'

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

export const reroute = ({ url }) => {
	if (url.pathname === '/') {
		return '/7/f.1FAIpQLSesCAm6R0BOW8sKVBZJPW6ySaDIvcYujg9lfsW36rDiD2MF0w'
	}
	return deLocalizeUrl(url).pathname
}
