# Port Features from `temp-domain-redirect` Branch

## Overview

The `temp-domain-redirect` branch accumulated significant features built on top of the old
domain-redirect architecture. Now that `main` has the superior domain-preset system (Phases 1–3a),
these features need to be ported to `main`.

**Do not port** the old `hooks.ts` domain-redirect logic — `main` already supersedes it.

## Recommended Port Order

1. Bug fixes + perf fixes (isolated, affect existing functionality)
2. Infrastructure (dance constants, vitest config, favicon)
3. NotificationBox improvements (standalone UI enhancement)
4. Group registration (largest feature — depends on #2)
5. Image proxy API (low priority, currently disabled)

Locale strategy improvements are tracked separately in `specs/locale.md`.

---

## Items to Port

### 1a. Bug Fixes — TODO

**a. `google-form.ts`: Enum values swapped** (`2d68c78`)

`PAGE_BREAK` and `FILE_UPLOAD` were assigned wrong numeric values:

```typescript
// Before (wrong):
FILE_UPLOAD = 8,
// PAGE_BREAK missing

// After (correct):
PAGE_BREAK = 8,
FILE_UPLOAD = 13,
```

**b. `google-form.ts` + `GoogleFormField.svelte`: submittable question images** (`3751e20`)

Main already parses `field[6]` for IMAGE/VIDEO types and does basic index-based `imgUrl` assignment.
What's missing:

- `field[6] ?? field[9]?.[0]` — `field[9][0]` is the media path for _submittable_ questions with
  an attached image (different from standalone IMAGE fields)
- Two-pass URL matching: width-based first (`=w{N}` suffix), then sequential fallback for
  HTML/JSON ordering mismatches
- `question.mediaWidth` tracking
- `GoogleFormField.svelte`: render image between question label and input element (not just for
  standalone IMAGE types)

**c. `GoogleFormField.svelte`: Checkbox group hydration crash** (`603f19c`)

Checkbox `group` state initialized to `undefined` when no stored value; causes hydration crash.
Fix: initialize to `[]`:

```typescript
// Before:
storedValues.byTitle[normalizeTitle(field.title)]?.split(', ')
// After:
storedValues.byTitle[normalizeTitle(field.title)]?.split(', ') || []
```

**d. `sheet-data-pipeline.svelte.ts`: `stripEmptyColumns` incomplete** (`92239f9`)

Was only filtering columns, not corresponding cells in each row:

```typescript
rows = rows.map((row) => row.filter((cell, ci) => columns[ci].lengthMax || columns[ci].title))
columns = columns.filter((col) => col.lengthMax || col.title)
```

Files:

- `src/lib/google-document-util/google-form.ts`
- `src/lib/components/GoogleFormField.svelte`
- `src/lib/google-document-util/sheet-data-pipeline.svelte.ts`

---

### 1b. Perf Fixes — TODO

**a. Remove Cheerio from Google Form parsing** (`b7cedfc`)

Replaces Cheerio DOM parsing with regex in `google-form.ts`. Removes `cheerio` dependency (~200KB,
~95% CPU reduction for form parsing: 11.9ms → 0.5ms).

Note: `b7cedfc` is the refined version of `546c22f` (same change, better `/formsz/` URL pattern).
Only port `b7cedfc`.

Main already has the Cheerio removal applied (it landed as part of the existing `google-form.ts`
state) — **verify before porting**: check if `import * as cheerio` still exists in
`src/lib/google-document-util/google-form.ts` on main.

**b. Cache timezone offset in `excelDateToUnix`** (`f9e756d`)

Avoids repeated `dayjs.tz()` calls per sheet cell — significant for large sheets:

```typescript
const timezoneOffsetCache = new Map<string, number>()

function getTimezoneOffset(timeZone: string): number {
	if (!timezoneOffsetCache.has(timeZone)) {
		const offset = dayjs().tz(timeZone).utcOffset() * 60 * 1000
		timezoneOffsetCache.set(timeZone, offset)
	}
	return timezoneOffsetCache.get(timeZone)!
}
```

Files:

- `src/lib/google-document-util/google-form.ts`
- `src/lib/util.ts`
- `package.json` / `pnpm-lock.yaml` (remove `cheerio`)

---

### 2. Infrastructure — TODO

**a. `src/lib/dance-constants.ts` (new)**

Centralizes regex constants previously duplicated across `Sheet.svelte` and
`sheet-data-pipeline.svelte.ts`:

```typescript
export const REGEX_DANCE_ROLE = /role|역할|리드|리더/i
export const REGEX_DANCE_NAME = /name|닉네임/i
export const REGEX_DANCE_WISH = /말씀|한마디/i
export const REGEX_DANCE_PAID = /입금여|입금확/i
export const REGEX_DANCE_GROUP = /group|그룹/i
export const REGEX_DANCE_LEADER = /lead|리더|리드/i
export const REGEX_DANCE_FOLLOW = /follow|팔뤄|팔로우/i
```

Update `Sheet.svelte` and `sheet-data-pipeline.svelte.ts` to import from here instead of
re-declaring.

**b. `vite.config.ts`: Add vitest config**

Required to run the group registration serialization tests:

```typescript
import { defineConfig } from 'vitest/config' // was 'vite'

export default defineConfig({
	// ...existing config...
	test: {
		include: ['src/**/*.test.ts'],
	},
})
```

**Note:** Do NOT port `optimizeDeps.esbuildOptions.supported['top-level-await']: true` — this
prevents Vite from transpiling TLA and breaks Safari.

**c. `static/favicon.svg` + `src/app.html`**

Replace `favicon.png` with SVG favicon. Update `app.html` reference from `.png` to `.svg`.

Files:

- `src/lib/dance-constants.ts` (new)
- `src/lib/components/Sheet.svelte`
- `src/lib/google-document-util/sheet-data-pipeline.svelte.ts`
- `vite.config.ts`
- `static/favicon.svg` (new)
- `static/favicon.png` (delete)
- `src/app.html`

---

### 3. NotificationBox Improvements — TODO

Two commits that improve the notification box independently of group registration.

**a. No-JS support + confetti snippet** (`fbd66ca`)

- Adds `confetti?: Snippet` prop — confetti is now passed in as a snippet rather than hardcoded
- CSS-only dismiss toggle (works without JS)
- `onclick` type fix

**b. CSS-only dismissal animation** (`d0c6289`)

- Animates the notification box collapsing on dismiss using `max-height` CSS transition
- CSS variables for timing: `--notification-box-exit-duration`, `--parent-collapse-duration`,
  `--parent-collapse-delay`
- `overflow: hidden` on wrapper

Files:

- `src/lib/components/NotificationBox.svelte`
- `src/routes/(centered)/(veneer)/[id1=vid]/[[id2=vid]]/+layout.svelte` (confetti snippet wiring)

---

### 4. Group Registration — TODO

The largest feature. Detects a name+role+group field triple in a Google Form and replaces them
with a custom widget that lets users register a group of dancers (leader + followers) in a single
submission. Also expands group registrations in the sheet list view.

Depends on: Item 2 (dance-constants, vitest).

**New files:**

- `src/lib/group-registration/detect.ts` — pattern detection for name/role/group field triples
- `src/lib/group-registration/serialization.ts` — serialize/parse group member data to/from form field string
- `src/lib/group-registration/serialization.test.ts` — vitest unit tests
- `src/lib/components/GroupRegistration.svelte` — the widget UI (556 lines)
- `specs/group-registration.md` — full spec (port from temp-branch)
- `reference/google-forms-data-structure.md` — reference doc (port from temp-branch)

**Modified files:**

- `src/lib/components/GoogleForm.svelte` — build render plan; collapse detected triples into `GroupRegistration` widget
- `src/lib/components/GoogleFormField.svelte` — `imgSrc()` helper, render question images below label (see also 1a-b)
- `src/lib/components/Sheet.svelte` — `_groupIndex` / `_isGroupMember` row classes, hide wish field for group members
- `src/lib/google-document-util/sheet-data-pipeline.svelte.ts` — `expandGroupMembers()`, group column detection, import from `dance-constants`
- `src/lib/index.ts` — export new types if needed

---

### 5. Image Proxy API — TODO (low priority)

`/api/image-proxy` proxies `googleusercontent.com` images through the server to avoid CORS issues.
Currently disabled in `GoogleFormField.svelte` (commented out) because `ssr = false` makes it
unavailable at first render.

Port the server route as-is; re-enable in `GoogleFormField.svelte` only when SSR is selectively
re-enabled for veneer routes.

Files:

- `src/routes/api/image-proxy/+server.ts` (new)

---

## Items NOT to Port

| Item                                            | Reason                                                                      |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| `src/hooks.ts` domain-redirect logic            | `main` already has superior domain-preset system                            |
| `project.inlang/settings.json` `baseLocale: ko` | Replaced by `preferredLanguage` strategy — see `specs/locale.md`            |
| `wrangler.toml`                                 | Cloudflare-specific, hardcoded to old worker name; `main` deploys to Vercel |
| `.env.example` wording changes                  | Trivial; `main` already has `PUBLIC_HOSTNAME`                               |
| `47cd833` wellcrafted migration                 | Already on `main`                                                           |
| `021edb5` timing instrumentation                | `console.time` profiling noise — don't add to production                    |
| Vercel Analytics (`7bc1be2`, `7ee5220`)         | Skipped by decision                                                         |
| `d0fdd43`/`4a591c4` SSR disable/revert          | `main` already has `ssr = false` globally                                   |
| `5203f65` GH-style MD alerts plugin             | Already on `main`                                                           |

---

## Port Order vs Other Work

```
port-1a: Bug fixes          ← do first (fixes real bugs in existing functionality)
port-1b: Perf fixes         ← do alongside 1a (isolated, high impact)
port-2:  Infrastructure     ← needed before group registration
port-3:  NotificationBox    ← standalone, can be done anytime
port-4:  Group registration ← main feature, depends on port-2
remove-picocss              ← can be parallel to port-4 or after
port-5:  Image proxy        ← low priority, defer until SSR re-enabled
locale.md (Phase 1)         ← enable preferredLanguage, can be done anytime
phase-3b: Header params     ← after remove-picocss
```
