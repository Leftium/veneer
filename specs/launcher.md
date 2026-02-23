# Launcher Page

## Overview

The launcher page (`/`) is the home page for `veneer.leftium.com` and any domain without a preset
mapping. It serves two purposes:

1. **URL builder** — paste a Google Form/Sheet URL, configure display options, get a shareable
   veneer link
2. **Preset directory** — browse known presets and their domains

The launcher is client-only (`ssr = false` globally). No server load function — all logic runs in
the browser.

---

## Architecture

**Route:** `src/routes/+page.svelte`

**Condition for showing launcher vs. veneer page:**

- `veneer.leftium.com/` → launcher (domain maps to `null` in `DOMAIN_PRESETS`)
- `btango.com/` → veneer page (domain has a preset with default docs)
- `veneer.leftium.com/g.abc123` → veneer page (doc ID provided directly)

See `specs/page-options.md` for the full routing architecture.

---

## Phase 1: Stub — DONE

Initial launcher stub with `?hostname=` links to all presets. Replaced in Phase 2.

---

## Phase 2: URL Builder + Preset Directory (MVP) — DONE

### URL Builder

- Paste a Google Form or Sheet URL (or text containing one); `linkifyjs` extracts the first URL
- `DOCUMENT_URL_REGEX` identifies the doc type and generates a veneer path (`/g.abc123`,
  `/f.1FAIpQL...`, etc.)
- When a form-type URL is detected (prefix `f` or `g`), an optional second input appears for a
  Google Sheet URL
- Generated link is shown as a clickable `<a>` that opens in a new tab
- URL inputs select-all on focus for easy replacement

### Preset Directory

- 4 domain presets shown: `btango`, `btango-class`, `btango-dj`, `vivimil`
- Each shows: name, domain, visible tabs, link
- Dev: `?hostname=` preview link; prod: actual domain link

### Other Sections

- Demo link: `/g.chwbD7sLmAoLe65Z8` (no preset)
- Dev helpers section (dev only): `?hostname=` quick links for all `DOMAIN_PRESETS` entries

### Files

- `src/routes/+page.svelte` (rewritten from stub)
- `src/lib/google-document-util/url-id.ts` — exported `googleDocumentIdFromUrl()` (was private)

---

## Phase 3: Advanced Options Panel — DONE

An always-open `<details open>` section appears below the generated link once a URL is pasted.
Adjusting any option reactively updates the generated URL.

### Layout order within URL builder (when `formResult` is set)

1. Type detected label (`<mark>`)
2. Optional sheet URL input (form types only)
3. Generated link
4. Header preview strip
5. Advanced options (`<details open>`)

### Header Preview Strip

A full-width `<div>` mimicking the veneer page header — same width as the actual header (negative
margin compensates for `<main>` padding), driven entirely by the current advanced option state:

- `background-image` — resolved from `headerImageMode` + `headerImageCustom`, falling back to
  `selectedPreset.headerImage`
- `background-color` — `headerColor` state or `selectedPreset.headerColor`
- `height` — `headerHeight` state or `selectedPreset.headerHeight`
- `background-size` — `headerImageFit` state or `selectedPreset.headerImageFit`
- `background-position: center` (always)

When `headerImageMode === 'form'`, shows a `"form image shown on page"` note (image not known
client-side without fetching the form — see Phase 4).

**Width match:** `margin-inline: calc(-1 * $size-5)` + `border-radius: 0` makes the strip
edge-to-edge within the padded `<main>`, matching the actual veneer header width exactly.

### Advanced Options Controls

Two-column grid. Labels show the selected preset's value as a placeholder hint for text inputs.
Empty field = param omitted = preset default.

| Control       | Param               | Input type                         | Notes                                                |
| ------------- | ------------------- | ---------------------------------- | ---------------------------------------------------- |
| Preset        | `?preset=`          | `<select>`                         | All `PRESETS` keys; `(domain default)` = omit        |
| Tabs          | `?tabs=`            | text                               | Dot-separated; `*` expands to all                    |
| Header image  | `?headerImage=`     | `<select>` + conditional URL input | `(preset default)` / `form` / `none` / `custom URL…` |
| Image fit     | `?headerImageFit=`  | `<select>`                         | cover / contain / fill width / stretch               |
| Header color  | `?headerColor=`     | text                               | CSS color; placeholder = preset value                |
| Header height | `?headerHeight=`    | text                               | CSS length; placeholder = preset value               |
| Text color    | `?headerTextColor=` | text                               | CSS color; placeholder = preset value                |

**`?headerImage=` sentinel values:**

| Value            | Meaning                                                  |
| ---------------- | -------------------------------------------------------- |
| _(absent)_       | Preset default                                           |
| `form`           | Use image from Google Form metadata (fetched in Phase 4) |
| `none`           | No image — color only                                    |
| any other string | Literal image path/URL                                   |

**`?headerImageFit=` → `background-size` mapping:**

| Select label           | Param value | CSS `background-size` |
| ---------------------- | ----------- | --------------------- |
| (preset default)       | _(omit)_    | from preset           |
| cover — crop to fill   | `cover`     | `cover`               |
| contain — fit, no crop | `contain`   | `contain`             |
| fill width             | `100%`      | `100%`                |
| stretch                | `100% 100%` | `100% 100%`           |

### URL Generation

`veneerPath` derived builds a `URLSearchParams` from all non-empty advanced option state. Only
non-empty values are appended — empty = omit = use preset default. Result:

```
/g.abc123?preset=kiosk&headerHeight=150px&headerImageFit=contain
```

### Key Deriveds

```typescript
// Selected preset for placeholder hints and preview (falls back to 'base')
let selectedPreset = $derived(PRESETS[preset] ?? PRESETS['base'])

// Preview background image: resolves mode/custom/form/preset-default
let previewBgImage = $derived.by(() => {
	if (headerImageMode === 'none') return 'none'
	if (headerImageMode === 'custom') return headerImageCustom ? `url(${headerImageCustom})` : 'none'
	if (headerImageMode === 'form') return 'none' // unknown until Phase 4
	return selectedPreset.headerImage ? `url(${selectedPreset.headerImage})` : 'none'
})
```

### Files

- `src/routes/+page.svelte` — all launcher logic

---

## Phase 4: Rich Preview (form fetch) — DONE

**Goal:** Show the real form title and header image in the preview strip, and render realistic tab
buttons, so the launcher preview is close to the actual veneer page output.

### New endpoint: `GET /api/form-meta`

```
GET /api/form-meta?id=g.abc123
→ { title: string, headerImageUrl: string | null }
```

- Calls `fetchWithDocumentId(id)` server-side
- Returns only the fields needed for the preview (title + headerImageUrl)
- Returns `{ title: '', headerImageUrl: null }` on error (preview degrades gracefully)
- Typed with `RequestHandler` for full type safety

**File:** `src/routes/api/form-meta/+server.ts` (new)

### Launcher reactive fetch

When `formResult` changes (user pastes a URL), trigger a `fetch('/api/form-meta?id=...')` with
`AbortController` for cleanup on rapid re-pastes:

```typescript
let formMeta = $state<{ title: string; headerImageUrl: string | null } | null>(null)
let formMetaLoading = $state(false)

$effect(() => {
	const id = formResult ? `${formResult.prefix}.${formResult.id}` : null
	if (!id || formResult?.prefix === 's') {
		formMeta = null
		return
	}
	const controller = new AbortController()
	formMetaLoading = true
	fetch(`/api/form-meta?id=${id}`, { signal: controller.signal })
		.then((r) => r.json())
		.then((data) => {
			formMeta = data
		})
		.catch((e) => {
			if (e.name !== 'AbortError') formMeta = null
		})
		.finally(() => {
			formMetaLoading = false
		})
	return () => controller.abort()
})
```

### Preview strip upgrades

Once `formMeta` is available:

- **`?headerImage=form` sentinel** — `previewBgImage` uses `formMeta.headerImageUrl` instead of
  showing the "form image shown on page" note. If `formMeta.headerImageUrl` is `null`, shows
  "form has no header image" note.
- **Title** — render `formMeta.title` as an `<h1>` inside the preview strip (below the spacer),
  matching the real header layout. Shows shimmer loading state while `formMetaLoading` is true.
- **Tab buttons** — render the resolved tab list as non-functional visual-only `<span>` buttons
  inside the preview, using pill-shaped border-radius styling. Tab list derived from `tabs`
  state → selected preset's `tabs` array. Only shown when 2+ tabs are resolved.

### Tab resolution

Tab metadata defined in `TAB_META` constant matching the server-side `TABS` map:

```typescript
const ALL_TABS = ['info', 'form', 'list', 'raw', 'dev']

const TAB_META: Record<string, { icon: string; name: string }> = {
	info: { icon: 'ℹ️', name: 'Info' },
	form: { icon: '✍', name: 'Form' },
	list: { icon: '📋', name: 'List' },
	raw: { icon: '🔧', name: 'RAW' },
	dev: { icon: '🔧', name: 'Dev' },
}
```

Resolved tabs: parse `tabs` state (dot-separated) filtering to valid `ALL_TABS`, or fall back to
`selectedPreset.tabs`.

### Preview strip final layout

```
┌─────────────────────────────────────────────────┐
│  [background image / color]                     │
│                                                 │  ← height from headerHeight
│  Form Title                                     │  ← from formMeta.title
│  [ℹ️ Info]  [✍ Form]  [📋 List]               │  ← resolved tabs, visual only
└─────────────────────────────────────────────────┘
```

### Files changed

1. `src/routes/api/form-meta/+server.ts` — new endpoint
2. `src/routes/+page.svelte` — `formMeta` state, `$effect` fetch with AbortController, upgraded
   preview deriveds (`previewBgImage` form mode, `previewTitle`, `resolvedTabs`), enhanced preview
   strip markup with title/tabs/shimmer, new CSS for `.preview-overlay`, `.preview-title`,
   `.preview-tabs`, `.preview-tab`, shimmer animation

---

## Phase 5: Google Form Theme Colors — DONE

**Goal:** Extract the form's accent color and background color from `FB_PUBLIC_LOAD_DATA_` and
surface them as veneer params, so the veneer page can optionally use the form's own color scheme.

### What Google Forms exposes

From the Theme panel (ignoring fonts):

| Setting      | Description                                                      |
| ------------ | ---------------------------------------------------------------- |
| Header image | Already parsed (`headerImageUrl`)                                |
| Color        | Primary/accent color — affects buttons, checkboxes, progress bar |
| Background   | Page background color behind the form card                       |

### Reverse-engineering the data structure

The color values are embedded in `FB_PUBLIC_LOAD_DATA_` JSON. Their array indices need to be
identified by inspecting actual form HTML with known color settings. This is exploratory work.

Once found, add to the `Form` type and `parseGoogleForm()` in `google-form.ts`:

```typescript
type Form = {
	// ... existing fields ...
	accentColor: string | null // form's primary color (hex)
	bgColor: string | null // form's background color (hex)
}
```

### New params

| Param           | CSS target                           | Sentinel values           |
| --------------- | ------------------------------------ | ------------------------- |
| `?accentColor=` | CSS custom property (buttons, etc.)  | `form` = use form's color |
| `?bgColor=`     | `background-color` on page body/card | `form` = use form's color |

The `form` sentinel follows the same pattern as `?headerImage=form` — use the value parsed from
the form, falling back to preset if the form has none.

### Launcher integration

- `/api/form-meta` endpoint (Phase 4) extended to also return `accentColor` and `bgColor`
- Preview strip shows the background color behind the form card area (below the header)
- Advanced options panel gains two new rows: **Accent color** and **Background color**

### Files changed

1. `src/lib/google-document-util/google-form.ts` — extract `accentColor`, `bgColor` from JSON
2. `src/routes/[id1=vid]/[[id2=vid]]/+layout.server.ts` — resolve `?accentColor=`, `?bgColor=`
3. `src/routes/[id1=vid]/[[id2=vid]]/+layout.svelte` — apply colors via CSS custom properties
4. `src/routes/api/form-meta/+server.ts` — return `accentColor`, `bgColor`
5. `src/routes/+page.svelte` — preview + advanced options for new params
6. `src/lib/presets.ts` — add `accentColor` and `bgColor` to `Preset` interface + all presets
