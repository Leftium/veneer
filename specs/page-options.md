# Page Rendering Options

## Overview

This spec documents all options that affect page rendering, the domain-based preset system, URL routing architecture, and methods for passing configuration.

## Architecture Summary

```
Browser URL                    reroute hook                    File-system route
─────────────                  ────────────                    ─────────────────
btango.com/                 → /g.rzQ.../s.1bY...            → (veneer)/[id1=vid]/[[id2=vid]]/[[tid=tab]]
btango.com/form             → /g.rzQ.../s.1bY.../form       → (veneer)/[id1=vid]/[[id2=vid]]/[[tid=tab]]
btango.com/g.abc123/info    → /g.abc123/info                 → (veneer)/[id1=vid]/[[tid=tab]]
btango.com/?preset=kiosk    → /g.rzQ.../s.1bY...            → (veneer)/... (kiosk preset applied)
veneer.leftium.com/         → / (no reroute)                 → +page.svelte (launcher)
veneer.leftium.com/demo     → /demo (no reroute)             → demo/+page.svelte
```

Key principles:

- **Domain determines default preset** — hostname maps to a preset name, which provides default doc IDs, tab visibility, header styling, etc.
- **Query param overrides preset** — `?preset=kiosk` overrides the domain default; no preset names in URL path segments.
- **No prefix segment in URLs** — the `base` segment is removed. First URL segment is either a doc ID or tab name.
- **`(veneer)` route group** — veneer routes live in an invisible route group; `reroute` normalizes paths before route matching.
- **Launcher page for unknown domains** — domains without a preset show a directory/configuration page at `/`.

## Current State (Legacy)

### temp-domain-redirect branch: Domain-based routing

Maps hostnames directly to redirect paths with hardcoded flags + doc IDs:

```typescript
const SITES = [
	{ redirect: '/7/g.rzQZWr3o.../s.1bYcz...', hostnames: ['tangoclass.btango.com'] },
	{ redirect: '/7/g.4EKt4Vyz.../s.1jwmd...', hostnames: ['btango.com'] },
	{ redirect: '/7/g.r6eRUz2U.../s.13E_w...', hostnames: ['vivianblues.com', 'vivibl.com'] },
]
```

**Limitations:** Conflates "which documents" with "how to display" (flags). No reusable presets. One config per domain.

### temp branch: Bitfield in URL path

```
URL: /7/g.docId/s.sheetId
      ^
      flags (binary: 0111 = info + form + list)
```

**Limitations:** Not human-readable. Hard to extend beyond tab visibility.

### main branch: Named base param (not fully implemented)

```
URL: /base/g.docId/info
      ^^^^
      base param (currently only matches literal "base")
```

**Limitations:** Extra URL segment. `flags` code still exists but `params.flags` is undefined.

## Domain-Preset System

### Domain-to-Preset Mapping

Hostnames map to a **preset name**, not directly to configuration. Multiple domains can share a preset. Domains without a mapping show the launcher page.

```typescript
// src/lib/presets.ts

export const DOMAIN_PRESETS: Record<string, string | null> = {
	// Dance community sites
	'btango.com': 'btango',
	'tangoclass.btango.com': 'btango-class',
	'tangodj.btango.com': 'btango-dj',
	'vivianblues.com': 'vivimil',
	'vivibl.com': 'vivimil', // alias → same preset
	'vivimil.com': 'vivimil', // alias → same preset
	'xn--pg3bl5ba.com': 'vivimil', // IDN alias

	// Veneer home — no preset, shows launcher
	'veneer.leftium.com': null,
}
```

### Preset Definitions

Each preset defines default doc IDs, tab visibility, and header styling:

```typescript
// src/lib/presets.ts

export interface Preset {
	tabs: string[]
	defaultFormId?: string
	defaultSheetId?: string
	headerImage: string | null
	headerColor: string
	headerHeight: string
	headerTextColor: string
}

export const PRESETS: Record<string, Preset> = {
	base: {
		tabs: ['info', 'form', 'list'],
		// No default doc IDs — unknown domains render the launcher page.
		headerImage: '/dance_night.gif',
		headerColor: '#0b4474',
		headerHeight: '100px',
		headerTextColor: 'white',
	},
	btango: {
		tabs: ['info', 'form', 'list'],
		defaultFormId: 'g.4EKt4Vyzgq1E5eHC8',
		defaultSheetId: 's.1jwmdTf0fArizqA8IM6EavaTYDKn_uXMKj_VF3K1gw40',
		headerImage: '/dance_night.gif',
		headerColor: '#0b4474',
		headerHeight: '100px',
		headerTextColor: 'white',
	},
	'btango-class': {
		tabs: ['info', 'form', 'list'],
		defaultFormId: 'g.rzQZWr3o17Doj3Nq5',
		defaultSheetId: 's.1bYczvgFwW0t5A858xTIESlhulGP1cBtBlaDBwOHus30',
		headerImage: '/dance_night.gif',
		headerColor: '#0b4474',
		headerHeight: '100px',
		headerTextColor: 'white',
	},
	'btango-dj': {
		tabs: ['form', 'list'],
		defaultFormId: 'g.H9nD4tKrkp1m8ESC9',
		defaultSheetId: 's.16AtRFdLdYfnJRcXTf5N3fcLvZMMu48eECHXpxLHv7VU',
		headerImage: '/dance_night.gif',
		headerColor: '#0b4474',
		headerHeight: '100px',
		headerTextColor: 'white',
	},
	vivimil: {
		tabs: ['info', 'form', 'list'],
		defaultFormId: 'g.r6eRUz2U9uf5oVFn6',
		defaultSheetId: 's.13E_wsbrKLEsuV-eDaTKl0a967EdpYgcZrXH0Gq_KK3g',
		headerImage: '/dance_night.gif',
		headerColor: '#0b4474',
		headerHeight: '100px',
		headerTextColor: 'white',
	},
	minimal: {
		tabs: ['info'],
		headerImage: null,
		headerColor: '#333',
		headerHeight: '0',
		headerTextColor: 'white',
	},
	kiosk: {
		tabs: ['form'],
		headerImage: null,
		headerColor: '#333',
		headerHeight: '40px',
		headerTextColor: 'white',
	},
}
```

### Preset Resolution Priority

When determining which preset to use:

1. **`?preset=` query param** — explicit override (e.g., `?preset=kiosk`)
2. **Domain default** — looked up from `DOMAIN_PRESETS` by hostname
3. **Fallback** — `'base'` preset

```typescript
function resolvePreset(hostname: string, url: URL): string {
	// 1. Query param override
	const paramPreset = url.searchParams.get('preset')
	if (paramPreset && paramPreset in PRESETS) return paramPreset

	// 2. Domain default
	const domainPreset = DOMAIN_PRESETS[hostname.replace(/^www\./, '')]
	if (domainPreset) return domainPreset

	// 3. Fallback
	return 'base'
}
```

Preset resolution happens in `+layout.server.ts` (not in `reroute`), since `reroute` only handles path normalization and doesn't have access to pass preset context to the page.

## URL Routing Architecture

### No Prefix Segment

The `base` (or `[base=base]`) segment is removed from URLs. The first URL segment is one of:

| First segment    | Example          | Meaning                                       |
| ---------------- | ---------------- | --------------------------------------------- |
| _(empty — root)_ | `/`              | Use domain preset defaults (or show launcher) |
| Tab name         | `/info`, `/form` | Tab on domain's default docs                  |
| Doc ID           | `/g.abc123`      | Specific document, domain preset styling      |

Preset overrides are handled via query param (`?preset=kiosk`), not URL path segments.

### `(veneer)` Route Group

Veneer routes use an invisible SvelteKit route group that never appears in URLs:

```
src/routes/
├── +page.svelte                              ← launcher page (unknown domains)
├── (centered)/
│   ├── +layout.svelte
│   ├── (veneer)/                             ← invisible route group
│   │   └── [id1=vid]/
│   │       └── [[id2=vid]]/
│   │           ├── +layout.server.ts         ← data loading, preset resolution
│   │           ├── +layout.svelte            ← main UI: tabs, header, footer
│   │           └── [[tid=tab]]/
│   │               ├── +page.server.ts       ← form submission action
│   │               └── +page.svelte
│   ├── test-links/
│   └── [flags]/                              ← legacy (to be removed)
│       └── ...
├── api/
├── demo/
```

**Why this works:** The `vid` param matcher is strict (`^[sfgbh]\.\w+$`), so it won't match static routes (`api`, `demo`, `test-links`), random paths (`favicon.ico`), or tab names (`info`, `form`). The `reroute` hook ensures paths always start with a valid doc ID by the time route matching occurs.

### `reroute` Hook Logic

The `reroute` hook normalizes browser URLs into paths the `(veneer)` route group can match. It only handles path normalization — preset resolution happens downstream in `+layout.server.ts`.

**Locale prefix handling:** The hook calls `deLocalizeUrl()` first, which strips the Paraglide locale prefix (e.g., `/ko/`) before any other processing. This means the locale layer is transparent to the rest of the reroute logic:

```
/ko/form  →  deLocalizeUrl  →  /form  →  reroute logic  →  /g.xxx/s.yyy/form
/ko/      →  deLocalizeUrl  →  /      →  reroute logic  →  /g.xxx/s.yyy
/form     →  deLocalizeUrl  →  /form  →  reroute logic  →  /g.xxx/s.yyy/form
```

The actual rendered language is determined by the `PARAGLIDE_LOCALE` cookie (set via `setLocale()`), not the URL prefix. The `/ko/` prefix is primarily for shareable links — a user with a `ko` cookie sees Korean content regardless of whether `/ko/` is in the URL.

```typescript
// src/hooks.ts

const TAB_NAMES = new Set(['info', 'form', 'list', 'raw', 'dev'])

function isVeneerId(segment: string): boolean {
	return /^[sfgbh]\.[a-zA-Z0-9_-]+$/.test(segment)
}

export const reroute: Reroute = ({ url }) => {
	const hostname = url.hostname.replace(/^www\./, '')
	const path = deLocalizeUrl(url).pathname // strips /ko/ prefix if present
	const segments = path.split('/').filter(Boolean)
	const first = segments[0]

	// --- Resolve default docs from domain ---
	const domainPresetName = DOMAIN_PRESETS[hostname]
	const preset = PRESETS[domainPresetName || '']

	// No domain mapping, no path → launcher page
	if (!domainPresetName && !first) {
		return path
	}

	// Domain maps to null (e.g., veneer.leftium.com) → launcher page
	if (domainPresetName === null && !first) {
		return path
	}

	// --- Build normalized path ---
	if (!first || TAB_NAMES.has(first)) {
		// Root or tab-only: prepend default doc IDs from domain preset
		const docs = [preset?.defaultFormId, preset?.defaultSheetId].filter(Boolean).join('/')
		if (!docs) return path // no default docs → fall through (404 or launcher)
		const tab = first ? `/${first}` : ''
		return `/${docs}${tab}`
	}

	if (isVeneerId(first)) {
		// Doc ID(s) provided in URL — pass through
		return path
	}

	// Not a veneer path — pass through to static routes (api, demo, etc.)
	return path
}
```

**Note:** The `reroute` hook does not read `?preset=` — it only uses the domain's default preset to find default doc IDs for path normalization. The `?preset=` param is read later in `+layout.server.ts` to determine styling, tab visibility, etc.

### URL Behavior by Domain Type

**Domains with a preset (e.g., `btango.com`):**

| Browser URL              | Rerouted to               | Result                                                     |
| ------------------------ | ------------------------- | ---------------------------------------------------------- |
| `/`                      | `/g.rzQ.../s.1bY...`      | Default docs, default tab (first in preset's `tabs` array) |
| `/info`                  | `/g.rzQ.../s.1bY.../info` | Default docs, info tab                                     |
| `/form`                  | `/g.rzQ.../s.1bY.../form` | Default docs, form tab                                     |
| `/g.abc123`              | `/g.abc123`               | Custom doc, default tab                                    |
| `/g.abc123/info`         | `/g.abc123/info`          | Custom doc, info tab                                       |
| `/?preset=kiosk`         | `/g.rzQ.../s.1bY...`      | Default docs, kiosk styling                                |
| `/g.abc123?preset=kiosk` | `/g.abc123`               | Custom doc, kiosk styling                                  |

**Domains without a preset (e.g., `veneer.leftium.com`):**

| Browser URL              | Rerouted to               | Result                    |
| ------------------------ | ------------------------- | ------------------------- |
| `/`                      | `/` (no reroute)          | Launcher page             |
| `/info`                  | `/info` (no default docs) | 404 (expected)            |
| `/g.abc123/info`         | `/g.abc123/info`          | Custom doc, info tab      |
| `/g.abc123?preset=kiosk` | `/g.abc123`               | Custom doc, kiosk styling |
| `/demo`                  | `/demo` (no reroute)      | Demo page                 |

### Dev/Testing Support

For local development, hostname simulation is supported via:

1. **`?hostname=` query param** — per-request override
2. **`PUBLIC_HOSTNAME` env var** — session-level override in `.env`

```typescript
// In reroute hook
const hostname =
	(dev && url.searchParams.get('hostname')) ||
	(dev && PUBLIC_HOSTNAME) ||
	url.hostname.replace(/^www\./, '')
```

## Launcher Page

When a domain has no preset mapping (or maps to `null`), the root `/` renders a launcher page instead of rerouting to default docs.

**Purpose:**

- Lists all known presets with descriptions and live links
- Provides a form to paste Google Form/Sheet URLs and generate a veneer URL
- Links to preset domains (btango.com, vivimil.com, etc.)
- Serves as the "home page" for `veneer.leftium.com`

**Route:** `src/routes/+page.svelte`

## Rendering Options Inventory

### 1. Tab Visibility and Default Tab

| Option        | Description                  | Source |
| ------------- | ---------------------------- | ------ |
| Show Info tab | Display info/description tab | Preset |
| Show Form tab | Display form input tab       | Preset |
| Show List tab | Display responses list tab   | Preset |
| Show Dev tab  | Display raw/debug tabs       | Preset |

**Default tab:** When no `[[tid=tab]]` segment is in the URL (e.g., `btango.com/` or `/g.abc123`), the first tab in the preset's `tabs` array is shown. For the `btango` preset (`tabs: ['info', 'form', 'list']`), this means `info`.

**Explicit default tab in URL:** Visiting `btango.com/info` works — `reroute` maps it to `/g.xxx/s.yyy/info` and the info tab is shown. The URL bar stays as `btango.com/info` (no normalization redirect to `/`). Both `/` and `/info` render identically; `/` is the canonical short form.

**Tab link URLs:** When viewing the domain's default docs, tab links use short URLs. The default tab (first in array) links to `/` (clean, no tab segment); other tabs link to `/form`, `/list`, etc. For non-default docs, the default tab links to `/g.abc123` and others to `/g.abc123/form`, `/g.abc123/list`, etc.

**`?tabs=` query param override:** Overrides the preset's tab list, controlling both visibility and order. The first tab in `?tabs=` becomes the default tab.

```
btango.com/?tabs=form.info        # Visible: form, info. Default: form. No list tab.
btango.com/?tabs=info.form.list   # Same as btango preset default.
btango.com/g.abc123?tabs=dev      # Only dev tab visible.
btango.com/?tabs=*                # Redirects to ?tabs=info.form.list.raw.dev (editable in URL bar).
```

**Implementation in `+layout.server.ts`:**

```typescript
const ALL_TABS = ['info', 'form', 'list', 'raw', 'dev']

const preset = resolvePreset(hostname, url)
const tabsParam = url.searchParams.get('tabs')
const tabs =
	tabsParam === '*'
		? ALL_TABS
		: tabsParam?.split(',').filter((t) => ALL_TABS.includes(t)) || preset.tabs
```

**Edge case — tab segment not in visible set:** If the URL specifies a tab that isn't in the resolved tab list (e.g., `btango.com/list?tabs=info.form`), the requested tab is ignored and the default tab (first in `?tabs=` list) is shown instead. The `list` tab doesn't exist in the visible set, so it gracefully falls back.

### 2. Header Styling

| Option            | Description                 | Source                               |
| ----------------- | --------------------------- | ------------------------------------ |
| Header image      | Background image for header | Preset / Form metadata / Query param |
| Header color      | Fallback background color   | Preset / Query param                 |
| Header height     | Height of header spacer     | Preset / Query param                 |
| Header text color | Color of title/nav text     | Preset / Query param                 |

**Note:** `headerImageUrl` IS parsed from Google Form data but NOT yet used:

```typescript
// In google-form.ts — this data is available but unused
const matches = html.match(/background-image: url\(([^)]*)/)
if (matches?.length && matches[1]) {
	form.headerImageUrl = matches[1]
}
```

### 3. Data Display Options

| Option            | Description                    | Source           |
| ----------------- | ------------------------------ | ---------------- |
| `allcols`         | Show hidden columns in sheet   | URL search param |
| `allrows`         | Show hidden rows in sheet      | URL search param |
| `skipsheetidscan` | Don't auto-detect linked sheet | URL search param |

### 4. Locale/i18n

| Option   | Description         | Source                                            |
| -------- | ------------------- | ------------------------------------------------- |
| Language | UI language (en/ko) | `PARAGLIDE_LOCALE` cookie / `baseLocale` fallback |

Paraglide supports two locales: `en` (base, no URL prefix) and `ko` (Korean, `/ko/` prefix). The URL prefix is stripped by `deLocalizeUrl()` in the `reroute` hook before any other routing logic runs. The rendered language is determined by the `PARAGLIDE_LOCALE` cookie, not the URL prefix — see `reroute` Hook Logic section for details.

| URL                           | Locale prefix   | De-localized path |
| ----------------------------- | --------------- | ----------------- |
| `btango.com/form`             | (none, English) | `/form`           |
| `btango.com/ko/form`          | `/ko/` stripped | `/form`           |
| `btango.com/ko/g.abc123/info` | `/ko/` stripped | `/g.abc123/info`  |
| `veneer.leftium.com/ko/`      | `/ko/` stripped | `/`               |

### 5. Document IDs

The page can display data from up to two Google documents: a Form and/or a Sheet.

| Option           | Description                        | Source                          |
| ---------------- | ---------------------------------- | ------------------------------- |
| Form ID          | Google Form document ID            | URL path param (`id1` or `id2`) |
| Sheet ID         | Google Sheet document ID           | URL path param (`id1` or `id2`) |
| Default Form ID  | Fallback form when no ID provided  | Preset / Env var                |
| Default Sheet ID | Fallback sheet when no ID provided | Preset / Env var                |

**Document ID Prefixes:**

| Prefix | Type                                | Example               |
| ------ | ----------------------------------- | --------------------- |
| `g.`   | Google Forms short link (forms.gle) | `g.abc123`            |
| `f.`   | Google Forms full ID                | `f.1FAIpQL...`        |
| `s.`   | Google Sheets ID                    | `s.13E_wsbrKLEsuV...` |
| `b.`   | Bitly shortened URL                 | `b.abc123`            |
| `h.`   | ShortUrl shortened URL              | `h.abc123`            |

**Auto-detection:** If only a form is provided, the system scans links in the form description to auto-detect a linked sheet (unless `?skipsheetidscan` is set).

### 6. Theme/Branding (Not Implemented)

| Option         | Description                     | Potential Use       |
| -------------- | ------------------------------- | ------------------- |
| Primary color  | Accent color for buttons, links | Theme customization |
| Logo           | Custom logo in header           | Branding            |
| Footer content | Custom footer links             | Site customization  |

## Configuration Passing Methods

### Presets (Primary)

Named presets define a complete configuration bundle. Applied via domain default or `?preset=` query param override.

```
btango.com/                    # domain → 'btango' preset
btango.com/?preset=kiosk       # query param → 'kiosk' preset (overrides domain)
/g.abc123?preset=minimal       # query param → 'minimal' preset (any domain)
```

### Search Param Overrides

Query parameters override individual preset values:

```
btango.com/?tabs=info.form              # override tabs from preset
btango.com/g.abc123?headerImage=none    # override header from preset
```

### Google Form/Sheet Metadata

Header image URL is parsed from Google Form data and can override preset values:

```
Priority: 1. Query param → 2. Form headerImageUrl → 3. Preset value
```

## Environment-Based Defaults

Environment variables are not currently used for preset doc IDs. The `base` preset has no default doc IDs — unknown domains render the launcher page instead. Site-specific presets define their own doc IDs directly.

If env-var defaults are needed in the future (e.g., for a dev-only quick-test preset), use SvelteKit's `PUBLIC_` prefix for client-exposed vars, not `VITE_`.

## Implementation Progress

### Phase 1: Domain-Preset System + Route Restructure — DONE

Implemented:

1. Created `src/lib/presets.ts` with `DOMAIN_PRESETS`, `PRESETS`, `Preset` interface, `resolvePresetName()`
2. Restructured routes: renamed `[base=base]/` to `(veneer)/` (invisible route group)
3. Removed `src/params/base.ts`
4. Rewrote `src/hooks.ts` with domain lookup, `deLocalizeUrl`, tab-name detection, veneer ID passthrough
5. Created `src/routes/+page.svelte` launcher stub with `?hostname=` links to all presets
6. Tab visibility driven by preset's `tabs` array in `+layout.server.ts` (pulled forward from Phase 3)
7. `?preset=` query param override wired in `+layout.server.ts` (pulled forward from Phase 3)
8. Tab navigation preserves both doc IDs (`id1` + `id2`) and search params
9. Deleted legacy `[base=base]` route and `src/params/base.ts`

Notable decisions during implementation:

- **No env var fallbacks** — `base` preset has no default doc IDs; launcher page renders instead
- **btango-dj uses `tabs: ['form', 'list']`** — info content renders inline above the form (existing conditional in `+layout.svelte` handles this)
- **`vivimil.com`** is the primary domain for the `vivimil` preset (supersedes `vivianblues.com`)
- **Legacy `[flags]/` route left in place** for reference; doesn't conflict with new routing

### Phase 2: Launcher Page (MVP) — DONE

Implemented:

1. Rewrote `src/routes/+page.svelte` from stub to full launcher page
2. URL builder: paste Google Form/Sheet URL (or text containing one), `linkifyjs` extracts first URL, `DOCUMENT_URL_REGEX` identifies doc type and generates veneer path
3. When a form-type URL is detected (prefix `f` or `g`), optional second input appears for a Google Sheet URL
4. Preset directory: 4 domain presets shown with name, domain, visible tabs, and link (dev: `?hostname=` preview link; prod: actual domain link)
5. Demo link: `/g.chwbD7sLmAoLe65Z8` (no preset)
6. Dev helpers section (dev only): `?hostname=` quick links for all `DOMAIN_PRESETS` entries
7. All links open in new tab (`target="_blank"`)
8. URL inputs select-all on focus for easy replacement
9. Exported `googleDocumentIdFromUrl()` from `url-id.ts` (was private)
10. Renamed `vivianblues` preset to `vivimil` throughout (`presets.ts`, launcher, spec)

Notable decisions during implementation:

- **No descriptions in `Preset` interface** — preset labels/descriptions hardcoded in launcher only for now
- **No shortened URL resolution** — `forms.gle/xxx` generates `g.xxx` veneer ID (works fine; veneer resolves server-side at page load)
- **No preset selector in URL builder** — kept simple; preset override is a separate concern (`?preset=`)
- **Client-side only** — no server load function; `ssr = false` globally

Later enhancements (no dedicated phase — added incrementally as other features land):

- Live previews of presets
- Preset configurator for advanced users
- Searchable/filterable preset list
- Shortened URL resolution in URL builder (follow redirects via `/api/final-url`)

### Phase 3a: `?tabs=` and `?showErrors` Overrides — DONE

Implemented `?tabs=` and `?showErrors` in `+layout.server.ts`. Also unlinked `raw` and `dev` tab slides in `+layout.svelte` (each gated by its own `navTabs` icon).

```typescript
const ALL_TABS = ['info', 'form', 'list', 'raw', 'dev']

const tabsParam = url.searchParams.get('tabs')
if (tabsParam === '*') {
	// Expand wildcard to editable list and redirect
	redirect(307, `${url.pathname}?tabs=${ALL_TABS.join('.')}`)
}
const tabs = tabsParam ? tabsParam.split('.').filter((t) => ALL_TABS.includes(t)) : preset.tabs
const visibleTabs = new Set(tabs)
```

Edge cases:

- Unknown tab names in `?tabs=` silently ignored (filter handles it)
- URL `tid` not in resolved `tabs` → show first tab in resolved list
- `?tabs=*` redirects to `?tabs=info.form.list.raw.dev` (dot-separated, unencoded — editable in URL bar)

`?showErrors` controls errored-tab visibility:

| Environment | No param                | `?showErrors` or `?showErrors=true` | `?showErrors=false`     |
| ----------- | ----------------------- | ----------------------------------- | ----------------------- |
| **dev**     | errored tabs **shown**  | errored tabs **shown**              | errored tabs **hidden** |
| **prod**    | errored tabs **hidden** | errored tabs **shown**              | errored tabs **hidden** |

A tab whose document fails to load (network error, 404, parse error, etc.) is an **errored tab**. In dev, errored tabs default to visible (showing error state for debugging). In prod, errored tabs default to hidden. The `?showErrors` param overrides the default in either direction.

`?tabs=*` interaction: The wildcard redirects to all 5 tabs expanded; errored-tab visibility still follows `?showErrors` / env default after the redirect.

`numTabs` is computed after `navTabs` is built (post error-hiding) rather than from `visibleTabs.size`, so the tab nav bar correctly hides when only one tab is effectively visible.

Notable decisions:

- **Dot separator for `?tabs=`** — commas encode as `%2C` in the URL bar making manual editing hard; `.` is not encoded
- **`raw` and `dev` unlinked** — each slide independently gated by its own `navTabs` icon; `?tabs=raw` and `?tabs=dev` now work independently

Files modified:

1. `src/routes/(centered)/(veneer)/[id1=vid]/[[id2=vid]]/+layout.server.ts` — `?tabs=`, wildcard redirect, `?showErrors`, `numTabs` fix
2. `src/routes/(centered)/(veneer)/[id1=vid]/[[id2=vid]]/+layout.svelte` — unlink raw/dev slides

### Phase 3b: Header Param Overrides — TODO (after remove-picocss)

Deferred until after `specs/remove-picocss.md` is implemented, since header markup/CSS will be restructured:

1. `?headerImage=`, `?headerColor=`, `?headerHeight=`, `?headerTextColor=` overrides
2. Pass merged config to layout/page components for header styling

### Phase 3c: Short Tab URLs for Default Docs — TODO

When viewing a domain's default docs (i.e., `params.id1`/`params.id2` match the preset's
`defaultFormId`/`defaultSheetId`), tab links should use short URLs instead of full doc-ID paths:

| Situation                     | Current tab href          | Target tab href              |
| ----------------------------- | ------------------------- | ---------------------------- |
| Default docs, non-default tab | `/g.abc.../s.xyz.../form` | `/form`                      |
| Default docs, default tab     | `/g.abc.../s.xyz...`      | `/`                          |
| Non-default docs, any tab     | `/g.abc123/form`          | `/g.abc123/form` (unchanged) |

This applies in **both production and dev** (`?hostname=` simulation). In dev with
`?hostname=btango.com`, the layout currently builds hrefs from `params.id1`/`params.id2` (the
full routed values), so tab links show the long doc IDs even though the browser URL is short.
The fix is the same for both environments.

**Implementation:**

In `+layout.server.ts`, detect whether the current doc IDs match the resolved preset's defaults
and pass a boolean to the layout:

```typescript
const usingDefaultDocs =
	params.id1 === preset.defaultFormId &&
	(params.id2 === preset.defaultSheetId || (!params.id2 && !preset.defaultSheetId))
```

In `+layout.svelte`, use `data.usingDefaultDocs` to build short hrefs:

```typescript
// Build base path for tab links
const docPath = data.usingDefaultDocs
	? '' // short: /form, /list
	: params.id2
		? `/${params.id1}/${params.id2}`
		: `/${params.id1}` // full: /g.abc/s.xyz
```

Default tab (first in visible tabs) links to `/` (if default docs) or `/g.abc123` (if not).

Files to change:

1. `src/routes/(centered)/(veneer)/[id1=vid]/[[id2=vid]]/+layout.server.ts` — compute `usingDefaultDocs`
2. `src/routes/(centered)/(veneer)/[id1=vid]/[[id2=vid]]/+layout.svelte` — use it for tab hrefs and `goto()` calls

### Phase 4: Dynamic Header Image

1. Use `headerImageUrl` from Google Form when available
2. Fall back to preset/param value
3. Fall back to default

```svelte
<header style:background-image="url({config.headerImage || data.form?.headerImageUrl || '/default.gif'})">
```

### Phase 5: Theme System

1. Define CSS custom properties for theming
2. Allow color overrides via params
3. Consider light/dark mode support

## Migration Path

| Current                          | New                                                         |
| -------------------------------- | ----------------------------------------------------------- |
| `/7/g.docId`                     | `btango.com/` (domain preset) or `/g.docId` (direct)        |
| `/15/g.docId`                    | `/g.docId?tabs=*` or `/g.docId?tabs=info.form.list.raw.dev` |
| `/1/g.docId`                     | `/g.docId?preset=minimal` or `/g.docId?tabs=info`           |
| `/2/g.docId`                     | `/g.docId?tabs=form`                                        |
| `/base/g.docId`                  | `/g.docId`                                                  |
| `/base/g.docId/info`             | `/g.docId/info`                                             |
| Per-site git branches            | Single branch + `DOMAIN_PRESETS` mapping                    |
| Hardcoded redirects in `SITES[]` | Preset definitions in `PRESETS`                             |

## URL Examples

```
# Domain with preset (btango.com → 'btango' preset)
btango.com/                            # Default docs, default tab
btango.com/info                        # Default docs, info tab active
btango.com/form                        # Default docs, form tab active

# Direct doc IDs (any domain)
veneer.leftium.com/g.abc123            # Specific form, base preset
veneer.leftium.com/g.abc123/info       # Specific form, info tab
veneer.leftium.com/g.abc123/s.xyz789   # Form + sheet
veneer.leftium.com/g.abc123/s.xyz789/form  # Form + sheet, form tab

# Preset override via query param
btango.com/?preset=kiosk               # Domain docs, kiosk styling
veneer.leftium.com/g.abc123?preset=minimal  # Specific form, minimal styling
veneer.leftium.com/g.abc123?preset=full     # Specific form, all tabs

# Individual overrides via query param
btango.com/?tabs=info.form             # Override tabs from domain preset
btango.com/g.abc123?headerColor=red    # Override header color

# Combined preset + overrides
btango.com/?preset=kiosk&headerColor=red  # Kiosk preset with red header

# Launcher (unknown domain or veneer.leftium.com)
veneer.leftium.com/                    # Launcher/directory page

# Static routes (unaffected)
veneer.leftium.com/demo                # Demo page
veneer.leftium.com/api/final-url       # API endpoint
```

## Files Modified

### Phase 1

1. `src/lib/presets.ts` **(new)** — `DOMAIN_PRESETS`, `PRESETS`, `Preset` interface, `resolvePresetName()`
2. `src/hooks.ts` — Rewritten: domain lookup, `deLocalizeUrl`, path normalization
3. `src/routes/(centered)/(veneer)/` **(renamed from `[base=base]/`)** — Invisible route group
4. `src/routes/(centered)/(veneer)/.../+layout.server.ts` — Preset resolution, tab visibility filtering
5. `src/routes/(centered)/(veneer)/.../+layout.svelte` — Removed `params.base`, preserved `id2` + search params on navigation
6. `src/routes/(centered)/(veneer)/.../[[tid=tab]]/+page.server.ts` — Preserved `id2` in post-submit redirect
7. `src/routes/+page.svelte` **(new)** — Launcher stub with preset links
8. `src/params/base.ts` **(deleted)**

### Phase 2

1. `src/routes/+page.svelte` — Rewritten from stub: URL builder, preset directory, demo link, dev helpers
2. `src/lib/google-document-util/url-id.ts` — Exported `googleDocumentIdFromUrl()` (was private)
3. `src/lib/presets.ts` — Renamed `vivianblues` preset to `vivimil`

### Phase 3a

1. `src/routes/(centered)/(veneer)/[id1=vid]/[[id2=vid]]/+layout.server.ts` — `?tabs=` override, `?tabs=*` redirect, `?showErrors`, `numTabs` fix
2. `src/routes/(centered)/(veneer)/[id1=vid]/[[id2=vid]]/+layout.svelte` — Unlinked `raw` and `dev` slides (each gated by own `navTabs` icon)

## Complete Options Summary

| Category      | Option           | Source                           | Priority (highest first)                            |
| ------------- | ---------------- | -------------------------------- | --------------------------------------------------- |
| **Preset**    | Preset name      | `?preset=` / Domain / Fallback   | 1. `?preset=` param, 2. Domain mapping, 3. `'base'` |
| **Documents** | Form ID          | URL path / Preset                | 1. URL, 2. Preset default                           |
|               | Sheet ID         | URL path / Preset                | 1. URL, 2. Auto-detect, 3. Preset default           |
| **Tabs**      | Visible tabs     | Preset + query param             | 1. `?tabs=` param, 2. Preset                        |
|               | Show errors      | `?showErrors` / Environment      | 1. `?showErrors` param, 2. dev=true / prod=false    |
| **Header**    | Image            | Form data + preset + query param | 1. Query param, 2. Form `headerImageUrl`, 3. Preset |
|               | Color            | Preset + query param             | 1. Query param, 2. Preset                           |
|               | Height           | Preset + query param             | 1. Query param, 2. Preset                           |
|               | Text color       | Preset + query param             | 1. Query param, 2. Preset                           |
| **Data**      | Show hidden cols | Query param                      | `?allcols`                                          |
|               | Show hidden rows | Query param                      | `?allrows`                                          |
|               | Skip sheet scan  | Query param                      | `?skipsheetidscan`                                  |
| **Locale**    | Language         | URL prefix                       | Paraglide handles this                              |

## Design Decisions

### Why `(veneer)` route group instead of a URL prefix?

- Cleanest possible URLs — no `/base/` or `/v/` segment
- `reroute` hook already handles path normalization
- The `vid` param matcher (`^[sfgbh]\.\w+$`) is strict enough to avoid collisions with static routes
- Static routes (`api/`, `demo/`, etc.) always take priority in SvelteKit's route resolution

### Why domain maps to preset _name_ instead of preset _definition_?

- Multiple domains can share one preset (aliases)
- `?preset=` param can override domain default (same preset names used in both contexts)
- Separation of concerns: mapping is a lookup table, preset is a configuration bundle

### Why `?preset=` query param instead of URL path segment?

- Simplifies the `reroute` hook — it only needs to handle doc IDs and tab names, not preset names
- No ambiguity about whether a first path segment is a preset name or something else
- No reserved-word conflicts between preset names and future route names
- Consistent with other overrides (`?tabs=`, `?headerColor=`) — all use query params
- Preset override is a power-user/debugging feature, not something end users typically share

### Why launcher page instead of a default redirect?

- Discoverable — new users can explore available presets
- Self-service — users can paste their own Google Form/Sheet URLs
- No assumptions — unknown domains don't silently redirect to someone else's form

### Reserved words

Tab names (`info`, `form`, `list`, `raw`, `dev`) are reserved — they are interpreted by `reroute` as tabs on the domain's default docs (for domains with a preset). They cannot be used as top-level static route names under `(centered)/`. Since preset names are no longer in the URL path, they don't create reserved-word conflicts.

If a new static route is needed with a name that collides with a tab name, either:

- Choose a name that doesn't collide (preferred)
- Place it outside `(centered)/`
- Add it to an explicit check in `reroute` before veneer path resolution
