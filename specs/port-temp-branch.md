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

### 1a. Bug Fixes — DONE

**a. `google-form.ts`: Enum values swapped** (`2d68c78`) — `c9abce0`

`PAGE_BREAK` and `FILE_UPLOAD` were assigned wrong numeric values:

```typescript
// Before (wrong):
FILE_UPLOAD = 8,
// PAGE_BREAK missing

// After (correct):
PAGE_BREAK = 8,
FILE_UPLOAD = 13,
```

Also added `'PAGE_BREAK'` to `QuestionType` union in both `google-form.ts` and `src/lib/index.ts`.

**b. `google-form.ts` + `GoogleFormField.svelte`: submittable question images** (`3751e20`) — `0084951`

- `field[6] ?? field[9]?.[0]` — `field[9][0]` is the media path for _submittable_ questions with
  an attached image (different from standalone IMAGE fields)
- Two-pass URL matching: width-based first (`=w{N}` suffix), then sequential fallback for
  HTML/JSON ordering mismatches
- `question.mediaWidth` tracking (already present in main's `Question` interface)
- `GoogleFormField.svelte`: `imgSrc()` helper strips `=w{N}` suffix; renders image between label
  and input for all submittable field types (TEXT/PARAGRAPH_TEXT, DROPDOWN, MULTIPLE_CHOICE/CHECKBOXES)
- Also added required-checkbox sentinel (hidden checkbox enforces native validation when no option selected)
- Also removed unused `markdown-it-github-alerts` import from `GoogleFormField.svelte` (dead import)

**c. `GoogleFormField.svelte`: Checkbox group hydration crash** (`603f19c`) — `0084951`

Checkbox `group` state initialized to `undefined` when no stored value; causes hydration crash.
Fix: initialize to `[]`:

```typescript
// Before:
storedValues.byTitle[normalizeTitle(field.title)]?.split(', ')
// After:
storedValues.byTitle[normalizeTitle(field.title)]?.split(', ') || []
```

**d. `sheet-data-pipeline.svelte.ts`: `stripEmptyColumns` incomplete** (`92239f9`) — `c9abce0`

Was only filtering cells in rows, not the `columns` array itself:

```typescript
// After (correct):
rows = rows.map((row) => row.filter((cell, ci) => columns[ci].lengthMax || columns[ci].title))
columns = columns.filter((col) => col.lengthMax || col.title)
```

Files modified:

- `src/lib/google-document-util/google-form.ts`
- `src/lib/components/GoogleFormField.svelte`
- `src/lib/google-document-util/sheet-data-pipeline.svelte.ts`
- `src/lib/index.ts`

---

### 1b. Perf Fixes — ALREADY ON MAIN (skip)

**a. Remove Cheerio from Google Form parsing** (`b7cedfc`) — already applied

Verified: no `import * as cheerio` in `google-form.ts` on main. Regex-based parsing was already
in place before this port session began.

**b. Cache timezone offset in `excelDateToUnix`** (`f9e756d`) — already applied

`timezoneOffsetCache` and `getTimezoneOffset()` already present in `src/lib/util.ts` on main.

---

### 2. Infrastructure — DONE

**a. `src/lib/dance-constants.ts` (new)** — `3c29319`

Centralizes regex constants previously duplicated across `Sheet.svelte` and
`sheet-data-pipeline.svelte.ts`. Actual values implemented (differ slightly from spec draft):

```typescript
export const REGEX_DANCE_NAME = /name|닉네임/i
export const REGEX_DANCE_ROLE = /role|역할|리드|리더/i
export const REGEX_DANCE_WISH = /말씀|한마디/i // dropped 'message|' vs old pipeline
export const REGEX_DANCE_PAID = /입금여|입금확/i
export const REGEX_DANCE_GROUP = /group|그룹|단체/i // added 단체 (group in formal Korean)
export const REGEX_DANCE_LEADER = /lead|리더|리드/i
export const REGEX_DANCE_FOLLOW = /follow|팔뤄|팔로우|팔로워/i // added 팔로워 (alternative spelling)
```

**b. `vite.config.ts`: Add vitest config** — `3c29319`

- Changed `import { defineConfig } from 'vite'` → `import { defineConfig } from 'vitest/config'`
- Added `test: { include: ['src/**/*.test.ts'] }`
- Also removed existing `esbuild.supported['top-level-await']: true` — this was already in main's
  vite config (not from temp branch) and breaks Safari; removed as part of this commit
- Added `vitest` dev dependency and `test`/`test:watch` scripts to `package.json`

**c. `static/favicon.svg` + `src/app.html`** — `bfe315b`

Replaced `favicon.png` with SVG. Updated `app.html` reference from `.png` to `.svg`.

Files:

- `src/lib/dance-constants.ts` (new)
- `src/lib/components/Sheet.svelte` (import from dance-constants)
- `src/lib/google-document-util/sheet-data-pipeline.svelte.ts` (import from dance-constants)
- `vite.config.ts`
- `package.json` / `pnpm-lock.yaml`
- `static/favicon.svg` (new)
- `static/favicon.png` (deleted)
- `src/app.html`

---

### 3. NotificationBox Improvements — ALREADY ON MAIN (skip)

Verified: `src/lib/components/NotificationBox.svelte` on main is identical to temp branch.
Both the confetti snippet prop and CSS-only dismissal animation were already present.

---

### 4. Group Registration — DONE

**Commit:** `7893272`

The largest feature. Detects a name+role+group field triple in a Google Form and replaces them
with a custom widget that lets users register a group of dancers (leader + followers) in a single
submission. Also expands group registrations in the sheet list view.

The role field is optional (2-field pattern: name + group; 3-field: name + role + group).

**New files:**

- `src/lib/group-registration/detect.ts` — pattern detection for name/role/group field triples
- `src/lib/group-registration/serialization.ts` — serialize/parse group member data to/from form field string
- `src/lib/group-registration/serialization.test.ts` — vitest unit tests
- `src/lib/components/GroupRegistration.svelte` — the widget UI
- `specs/group-registration.md` — full spec (ported from temp-branch)
- `reference/google-forms-data-structure.md` — reference doc (ported from temp-branch)

**Modified files:**

- `src/lib/components/GoogleForm.svelte` — build render plan; collapse detected triples into `GroupRegistration` widget; uses plain `Set` (not `SvelteSet`) since consumed-index tracking is local to `$derived.by()`
- `src/lib/components/GoogleFormField.svelte` — `imgSrc()` helper, render question images below label (also covers 1a-b)
- `src/lib/components/Sheet.svelte` — `_groupIndex` / `_isGroupMember` row classes, hide wish field for group members, header text changed to Korean `명 신청`
- `src/lib/google-document-util/sheet-data-pipeline.svelte.ts` — `expandGroupMembers()`, group column detection via `REGEX_DANCE_GROUP`, import from `dance-constants` and `group-registration/serialization`
- `src/lib/index.ts` — added `'PAGE_BREAK'` to `QuestionType` union (fixes omission from 1a-a)

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
port-1a: Bug fixes          ← DONE (c9abce0, 0084951)
port-1b: Perf fixes         ← ALREADY ON MAIN (skip)
port-2:  Infrastructure     ← DONE (3c29319, bfe315b)
port-3:  NotificationBox    ← ALREADY ON MAIN (skip)
port-4:  Group registration ← DONE (7893272)
remove-picocss              ← DONE (see specs/remove-picocss.md)
port-5:  Image proxy        ← TODO (low priority, defer until SSR re-enabled)
locale.md (Phase 1)         ← TODO (enable preferredLanguage, one config line)
phase-3b: Header params     ← TODO (after remove-picocss)
```
