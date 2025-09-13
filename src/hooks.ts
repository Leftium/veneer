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
		return '/2/f.1FAIpQLSf00iCsGYcvZzD3hs_NmYHQ2liPmFOkah4tRy9pJzsjPMS_Mw/'
	}
    if (url.pathname === '/list') {
		return '/4/s.1vfSQYmHLU7Y2nSanbCAOIIgWxBsC_j4__LCpEY0SSIM'
	}  
	return deLocalizeUrl(url).pathname
}
