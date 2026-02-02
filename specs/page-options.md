# Page Rendering Options

## Overview

This spec documents all options that affect page rendering and explores methods for passing these options.

## Current State

### temp branch: Bitfield in URL path

The temp branch uses a numeric bitfield in the URL path to control which tabs are visible:

```
URL: /7/g.docId/s.sheetId
      ^
      flags (binary: 0111 = info + form + list)
```

```typescript
// Tab visibility controlled by bitfield
const TABS: Record<string, [number, string, string]> = {
	info: [0b0001, 'ℹ️', m.info()], // bit 0
	form: [0b0010, '✍', m.form()], // bit 1
	list: [0b0100, '📋', m.list()], // bit 2
	raw: [0b1000, '🔧', 'RAW'], // bit 3
	dev: [0b1000, '🔧', m.dev()], // bit 3 (same as raw)
}

const flags = Number(params.flags) // e.g., 7 = 0b0111

// Tab shown if (flags & bit) > 0
icon: (flags & bit) > 0 ? icon : ''
```

### main branch: Named base param (not fully implemented)

The main branch uses a named `base` param but doesn't fully implement options yet:

```
URL: /base/g.docId/info
      ^^^^
      base param (currently only matches "base")
```

```typescript
// src/params/base.ts
export function match(value) {
	return ['base'].includes(value)
}
```

The `flags` code still exists but `params.flags` is undefined (marked with `@ts-expect-error`).

## Rendering Options Inventory

### 1. Tab Visibility

| Option        | Description                  | Current Implementation |
| ------------- | ---------------------------- | ---------------------- |
| Show Info tab | Display info/description tab | Bitfield bit 0         |
| Show Form tab | Display form input tab       | Bitfield bit 1         |
| Show List tab | Display responses list tab   | Bitfield bit 2         |
| Show Dev tab  | Display raw/debug tabs       | Bitfield bit 3         |

### 2. Header Styling

| Option            | Description                 | Current Implementation               |
| ----------------- | --------------------------- | ------------------------------------ |
| Header image      | Background image for header | **Hardcoded** (`/dance_night.gif`)   |
| Header color      | Fallback background color   | **Hardcoded** (`#0b4474`)            |
| Header height     | Height of header spacer     | **Hardcoded** (`100px` or `$size-2`) |
| Header text color | Color of title/nav text     | **Hardcoded** (`white`)              |

**Note:** `headerImageUrl` IS parsed from Google Form data but NOT used:

```typescript
// In google-form.ts - this data is available but unused
const matches = html.match(/background-image: url\(([^)]*)/)
if (matches?.length && matches[1]) {
	form.headerImageUrl = matches[1]
}
```

### 3. Data Display Options

| Option            | Description                    | Current Implementation |
| ----------------- | ------------------------------ | ---------------------- |
| `allcols`         | Show hidden columns in sheet   | URL search param       |
| `allrows`         | Show hidden rows in sheet      | URL search param       |
| `skipsheetidscan` | Don't auto-detect linked sheet | URL search param       |

### 4. Locale/i18n

| Option   | Description         | Current Implementation               |
| -------- | ------------------- | ------------------------------------ |
| Language | UI language (en/ko) | Paraglide URL prefix or `baseLocale` |

### 5. Document IDs

The page can display data from up to two Google documents: a Form and/or a Sheet.

| Option           | Description                        | Current Implementation          |
| ---------------- | ---------------------------------- | ------------------------------- |
| Form ID          | Google Form document ID            | URL path param (`id1` or `id2`) |
| Sheet ID         | Google Sheet document ID           | URL path param (`id1` or `id2`) |
| Default Form ID  | Fallback form when no ID provided  | **Hardcoded** in `hooks.ts`     |
| Default Sheet ID | Fallback sheet when no ID provided | **Hardcoded** in `hooks.ts`     |

**Document ID Prefixes:**

| Prefix | Type                                | Example               |
| ------ | ----------------------------------- | --------------------- |
| `g.`   | Google Forms short link (forms.gle) | `g.abc123`            |
| `f.`   | Google Forms full ID                | `f.1FAIpQL...`        |
| `s.`   | Google Sheets ID                    | `s.13E_wsbrKLEsuV...` |

**Current URL patterns:**

```
/base/g.formId                  # Form only
/base/s.sheetId                 # Sheet only
/base/g.formId/s.sheetId        # Form + Sheet
/base/g.formId/s.sheetId/form   # Form + Sheet, form tab active
```

**Auto-detection:** If only a form is provided, the system scans links in the form description to auto-detect a linked sheet (unless `?skipsheetidscan` is set).

### 6. Theme/Branding (Not Implemented)

| Option         | Description                     | Potential Use       |
| -------------- | ------------------------------- | ------------------- |
| Primary color  | Accent color for buttons, links | Theme customization |
| Logo           | Custom logo in header           | Branding            |
| Footer content | Custom footer links             | Site customization  |

## Environment-Based Defaults

### Dev Mode with Test Documents

Use environment variables to set default document IDs, allowing different defaults for development vs production:

```bash
# .env.development
VITE_DEFAULT_FORM_ID=g.testFormId
VITE_DEFAULT_SHEET_ID=s.testSheetId

# .env.production
VITE_DEFAULT_FORM_ID=g.prodFormId
VITE_DEFAULT_SHEET_ID=s.prodSheetId
```

**Implementation in `hooks.ts`:**

```typescript
import { dev } from '$app/environment'
import { VITE_DEFAULT_FORM_ID, VITE_DEFAULT_SHEET_ID } from '$env/static/public'

const DEFAULT_FORM = VITE_DEFAULT_FORM_ID || 'g.chwbD7sLmAoLe65Z8'
const DEFAULT_SHEET = VITE_DEFAULT_SHEET_ID || ''

export const reroute = ({ url }) => {
	if (url.pathname === '/') {
		const docs = [DEFAULT_FORM, DEFAULT_SHEET].filter(Boolean).join('/')
		return `/base/${docs}`
	}
	return deLocalizeUrl(url).pathname
}
```

**Benefits:**

- Dev environment uses test forms that can be freely modified
- Production uses real forms
- No hardcoded IDs in source code
- Easy to switch between document sets
- CI/CD can inject appropriate values

**Preset-specific defaults:**

Presets could also define their own default documents:

```typescript
// src/lib/presets.ts
export const PRESETS = {
	base: {
		tabs: ['info', 'form', 'list'],
		defaultFormId: import.meta.env.VITE_DEFAULT_FORM_ID,
		defaultSheetId: import.meta.env.VITE_DEFAULT_SHEET_ID,
		// ...
	},
	demo: {
		tabs: ['info', 'form', 'list'],
		defaultFormId: 'g.demoFormId', // Always use demo form
		defaultSheetId: 's.demoSheetId',
		// ...
	},
}
```

## Options for Passing Configuration

### Option A: URL Path Segment (Current temp approach)

```
/7/g.docId          # flags = 7 (binary 0111)
/15/g.docId         # flags = 15 (all tabs)
```

**Pros:**

- Compact URLs
- Easy to share specific configurations
- Cacheable by path

**Cons:**

- Not human-readable
- Limited to numeric values
- Hard to extend with new options

### Option B: Named Path Segment

```
/base/g.docId           # default config
/minimal/g.docId        # info only
/full/g.docId           # all tabs
/kiosk/g.docId          # form only, no nav
```

**Pros:**

- Human-readable
- Semantic meaning
- Easy to remember

**Cons:**

- Limited presets
- Can't combine arbitrarily
- Requires predefined configurations

### Option C: URL Search Params

```
/base/g.docId?tabs=info,form&header=none
/base/g.docId?theme=dark&color=red
```

**Pros:**

- Flexible key-value pairs
- Easy to add new options
- Can combine any options

**Cons:**

- Longer URLs
- Less cacheable
- Can look messy

### Option D: Hybrid Approach (Recommended)

Combine named presets with search param overrides:

```
/base/g.docId                           # default preset
/base/g.docId?tabs=info,form            # override tabs
/kiosk/g.docId                          # kiosk preset (form only)
/kiosk/g.docId?header=custom            # kiosk with custom header
```

**Implementation:**

```typescript
// src/lib/presets.ts
export const PRESETS = {
	base: {
		tabs: ['info', 'form', 'list'],
		headerImage: '/dance_night.gif',
		headerColor: '#0b4474',
		headerHeight: '100px',
	},
	minimal: {
		tabs: ['info'],
		headerImage: null,
		headerColor: '#333',
		headerHeight: '0',
	},
	kiosk: {
		tabs: ['form'],
		headerImage: null,
		headerColor: '#333',
		headerHeight: '40px',
	},
	full: {
		tabs: ['info', 'form', 'list', 'dev'],
		headerImage: '/dance_night.gif',
		headerColor: '#0b4474',
		headerHeight: '100px',
	},
}

// src/params/base.ts
export function match(value) {
	return Object.keys(PRESETS).includes(value)
}
```

```typescript
// In +layout.server.ts
const preset = PRESETS[params.base] || PRESETS.base

// Override with search params
const tabs = url.searchParams.get('tabs')?.split(',') || preset.tabs
const headerImage = url.searchParams.get('headerImage') || preset.headerImage
// ... etc
```

### Option E: Google Form/Sheet Metadata

Store configuration in the Google Form/Sheet itself:

- Use a special field or sheet tab for config
- Parse config from form description
- Use custom properties if available

**Pros:**

- Config travels with the document
- No URL changes needed
- Owner controls appearance

**Cons:**

- Requires parsing/convention
- Can't override per-link
- More complex implementation

## Recommended Implementation

### Phase 1: Named Presets

1. Define preset configurations in `src/lib/presets.ts`
2. Update `src/params/base.ts` to match preset names
3. Apply preset values in `+layout.server.ts`

### Phase 2: Search Param Overrides

1. Parse override params: `tabs`, `headerImage`, `headerColor`, etc.
2. Merge with preset values
3. Pass merged config to page

### Phase 3: Dynamic Header Image

1. Use `headerImageUrl` from Google Form when available
2. Fall back to preset/param value
3. Fall back to default

```svelte
<header style:background-image="url({config.headerImage || data.form?.headerImageUrl || '/default.gif'})">
```

### Phase 4: Theme System

1. Define CSS custom properties for theming
2. Allow color overrides via params
3. Consider light/dark mode support

## Migration Path

| Current       | New                                                        |
| ------------- | ---------------------------------------------------------- |
| `/7/g.docId`  | `/base/g.docId` (default shows info+form+list)             |
| `/15/g.docId` | `/full/g.docId` or `/base/g.docId?tabs=info,form,list,dev` |
| `/1/g.docId`  | `/minimal/g.docId` or `/base/g.docId?tabs=info`            |
| `/2/g.docId`  | `/base/g.docId?tabs=form`                                  |

## URL Examples

```
# Presets
/base/g.abc123                    # Default: info, form, list tabs
/base/g.abc123/form               # Default preset, form tab active
/minimal/g.abc123                 # Info only
/kiosk/g.abc123                   # Form only, minimal header
/full/g.abc123                    # All tabs including dev

# With overrides
/base/g.abc123?tabs=info,form     # Only info and form
/base/g.abc123?headerImage=none   # No header image
/base/g.abc123?headerColor=red    # Red header background

# Combined
/kiosk/g.abc123?headerImage=/custom.png&headerColor=%23ff0000
```

## Files to Modify

1. `src/lib/presets.ts` (new) - Preset definitions
2. `src/params/base.ts` - Match preset names
3. `src/routes/(centered)/[base=base]/.../+layout.server.ts` - Apply config
4. `src/routes/(centered)/[base=base]/.../+layout.svelte` - Use config for styling
5. `src/hooks.ts` - Use env vars for default document IDs
6. `.env.development` (new) - Dev environment defaults
7. `.env.production` (new) - Production environment defaults

## Complete Options Summary

| Category      | Option           | Source               | Priority (highest first)                              |
| ------------- | ---------------- | -------------------- | ----------------------------------------------------- |
| **Documents** | Form ID          | URL path             | 1. URL, 2. Preset default, 3. Env var                 |
|               | Sheet ID         | URL path             | 1. URL, 2. Auto-detect, 3. Preset default, 4. Env var |
| **Tabs**      | Visible tabs     | Preset + query param | 1. Query param, 2. Preset                             |
| **Header**    | Image            | Form data + preset   | 1. Query param, 2. Form `headerImageUrl`, 3. Preset   |
|               | Color            | Preset + query param | 1. Query param, 2. Preset                             |
|               | Height           | Preset               | 1. Query param, 2. Preset                             |
| **Data**      | Show hidden cols | Query param          | `?allcols`                                            |
|               | Show hidden rows | Query param          | `?allrows`                                            |
|               | Skip sheet scan  | Query param          | `?skipsheetidscan`                                    |
| **Locale**    | Language         | URL prefix           | Paraglide handles this                                |
