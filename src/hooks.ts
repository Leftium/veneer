import { deLocalizeUrl } from '$lib/paraglide/runtime'
// src/hooks.ts

export const reroute = ({ url }) => {
	if (url.pathname === '/') {
		return '/15/g.zUuXZZuvobvnU1ja7'
	}
	return deLocalizeUrl(url).pathname
}
