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
		return '/7/g.Ur4Ycy7wV7h5pWqt6/s.1HYvW0nz6Qs7zNsvhhpwCrUxStRg3hbxRLLUI6TjhBbI'
	}
	return deLocalizeUrl(url).pathname
}
