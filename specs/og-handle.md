# OG Handle: Reusable SvelteKit OG Meta Tag Injection (No SSR Required)

## Problem

SvelteKit apps with `ssr = false` lose all server-rendered `<meta>` tags. Social media bots (Facebook,
Twitter/X, Discord, Slack, KakaoTalk, etc.) don't execute JavaScript, so they see an empty `<head>`.
This means link previews show no title, no image, no description.

The usual fix is enabling SSR, but that's expensive on serverless free tiers (Vercel, Cloudflare Workers)
and unnecessary when the only server-rendered content needed is a handful of `<meta>` tags.

## Solution (Implemented in Veneer)

Use SvelteKit's `handle` hook to:

1. Fetch data **before** `resolve()` (so it's available before HTML is emitted)
2. Inject `<meta>` tags via `transformPageChunk` targeting `</head>`

Key discovery: `%sveltekit.head%` is consumed by SvelteKit internally **before** `transformPageChunk`
fires, so it cannot be used as an injection point. `</head>` works reliably.

### Why the load function approach doesn't work

With `ssr = false`, `+layout.server.ts` load functions **do not run** during the initial HTML request.
They only run later via a separate `/__data.json` client-side fetch. So setting `event.locals` in a
load function is invisible to `transformPageChunk`.

## Proposed Reusable API

### `createOgHandle(resolver): Handle`

```ts
// $lib/og.ts (or npm package: sveltekit-og-inject)

import type { Handle, RequestEvent } from '@sveltejs/kit'

type OgMeta = {
	title?: string
	description?: string
	image?: string | null
	url?: string
	type?: string // defaults to 'website'
	siteName?: string
	// Twitter Card support
	twitterCard?: 'summary' | 'summary_large_image'
}

type OgResolver = (url: URL, event: RequestEvent) => Promise<OgMeta | null> | OgMeta | null

export function createOgHandle(resolver: OgResolver): Handle {
	return async ({ event, resolve }) => {
		const og = await resolver(event.url, event)

		return resolve(event, {
			transformPageChunk: ({ html }) => {
				if (!og) return html
				const tags = buildOgTags(og)
				return html.replace('</head>', `\t\t${tags}\n\t</head>`)
			},
		})
	}
}
```

### Tag generation

```ts
function escAttr(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function buildOgTags(og: OgMeta): string {
	const tags: string[] = []

	if (og.title) tags.push(`<meta property="og:title" content="${escAttr(og.title)}" />`)
	tags.push(`<meta property="og:type" content="${escAttr(og.type ?? 'website')}" />`)
	if (og.url) tags.push(`<meta property="og:url" content="${escAttr(og.url)}" />`)
	if (og.image) tags.push(`<meta property="og:image" content="${escAttr(og.image)}" />`)
	if (og.description)
		tags.push(`<meta property="og:description" content="${escAttr(og.description)}" />`)
	if (og.siteName) tags.push(`<meta property="og:site_name" content="${escAttr(og.siteName)}" />`)

	// Twitter Card tags
	if (og.twitterCard || og.image) {
		tags.push(`<meta name="twitter:card" content="${og.twitterCard ?? 'summary_large_image'}" />`)
	}

	return tags.join('\n\t\t')
}
```

## Usage Examples

### Simple static app (weather-sense, multi-launch)

```ts
// hooks.server.ts
import { createOgHandle } from '$lib/og'

export const handle = createOgHandle(() => ({
	title: 'Weather Sense',
	description: 'Visual weather comparisons',
	image: '/og.png',
}))
```

No route-specific logic needed. Every page gets the same OG tags. ~3 lines of app code.

For truly static OG tags, an even simpler alternative: put `<meta>` tags directly in `app.html`.
The handle approach is only needed when tags vary per route.

### Dynamic per-route app (hn)

```ts
// hooks.server.ts
import { createOgHandle } from '$lib/og'

export const handle = createOgHandle(async (url) => {
	if (url.pathname.startsWith('/item/')) {
		const id = url.pathname.split('/')[2]
		const item = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then((r) =>
			r.json(),
		)
		return { title: item.title, description: `${item.score} points by ${item.by}` }
	}
	return { title: 'HN Reader' }
})
```

### Complex app with data reuse (Veneer)

The resolver callback receives the full `RequestEvent`, so it can stash fetched data on
`event.locals` for the load function to reuse (avoiding double-fetch):

```ts
// hooks.server.ts
import { sequence } from '@sveltejs/kit/hooks'
import { createOgHandle } from '$lib/og'

const ogHandle = createOgHandle(async (url, event) => {
	const segments = url.pathname.split('/').filter(Boolean)
	if (!isVeneerRoute(segments)) return null

	// Fetch documents (expensive)
	const docs = await fetchDocuments(segments)

	// Stash for +layout.server.ts to reuse
	event.locals.documents = docs

	// Return just the OG data
	return {
		title: docs.form?.title,
		image: docs.ogImage,
		url: url.href,
	}
})

export const handle = sequence(ogHandle, handleParaglide)
```

## Composability with `sequence()`

When using `sequence()`, each handle gets its own `resolve()` call, so each can provide its own
`transformPageChunk` without conflict. This is cleaner than sharing a single `transformPageChunk`
between OG injection and other transforms (e.g., paraglide locale replacement).

Current Veneer implementation shares one `transformPageChunk` for both. Refactoring to
`sequence(ogHandle, paraglideHandle)` would be the natural step when extracting the module.

## Gotchas / Notes

- `%sveltekit.head%` is replaced by SvelteKit **before** `transformPageChunk` fires. Always use
  `</head>` as the injection point.
- With `ssr = false`, load functions don't run during the HTML request. Data must be fetched in
  the `handle` hook (before `resolve()`).
- The `/__data.json` request also passes through the handle hook. The resolver should be cheap for
  non-HTML requests, or guard with a pathname check. (SvelteKit only calls `transformPageChunk` for
  page requests, not data requests, so the injection is safe — but the resolver fetch still runs.)
- Consider guarding the resolver: skip fetching for `/__data.json`, `/__error`, static assets, etc.
- Google/social bot User-Agents change frequently. The handle approach avoids bot detection entirely
  by serving OG tags to all requests.

## Future Enhancements

- **og:image via hover text marker**: Google Forms IMAGE fields have a hover text (alt text)
  property. Convention: hover text starting with `og:` marks that image as the OG image. Deferred
  as an edge case (form has images but user wants header image as OG).
- **Default fallback OG image**: Static branded image when no other image is available. Pending
  design decision (Leftium logo or similar).
- **Twitter Card support**: `twitter:card`, `twitter:title`, `twitter:image` tags. Trivial to add
  to `buildOgTags`.
- **og:description**: Not currently set. Could derive from form description or info text.
- **npm package**: Publish as `sveltekit-og-inject` or similar when a second project needs it.
- **`/__data.json` guard**: Skip the resolver for SvelteKit internal requests to avoid unnecessary
  fetches.
