import { deLocalizeUrl } from '$lib/paraglide/runtime'
// src/hooks.ts

export const reroute = ({ url }) => {
	if (url.pathname === '/') {
		return '/base/g.chwbD7sLmAoLe65Z8'
	}
	return deLocalizeUrl(url).pathname
}
