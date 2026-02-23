# Locale / Internationalization Spec

## Overview

Veneer currently supports two locales: `en` (English, base) and `ko` (Korean). Paraglide handles
locale resolution and UI string translation. This spec covers the full i18n roadmap — from improving
locale detection to making Google Form/Sheet content locale-aware.

## Current State

### What Paraglide translates today

Only veneer's own UI strings (8 messages total):

| Key        | en       | ko       |
| ---------- | -------- | -------- |
| `info`     | Info     | 안내     |
| `form`     | Form     | 신청     |
| `list`     | List     | 확인     |
| `dev`      | DEV      | DEV      |
| `submit`   | Submit   | 신청     |
| `required` | Required | 필수항목 |

Google Form/Sheet content (titles, questions, column headers, info text) is not translated — it
renders in whatever language the form author used.

### Current locale resolution strategy

```
cookie (PARAGLIDE_LOCALE) → globalVariable → baseLocale ('en')
```

Configured via `paraglideVitePlugin` in `vite.config.ts`. The browser's `Accept-Language` header
is not consulted — a new visitor with no cookie always sees English regardless of browser language.

---

## Phase 1: Browser Language as Default — DONE

**Goal:** Use the browser's preferred language as the locale default for new visitors, falling back
to `en` only if the browser signals no supported language.

### Resolution order after this change

```
cookie → preferredLanguage (Accept-Language) → baseLocale ('en')
```

Priority rationale:

1. **Cookie** — explicit user choice; always wins. Set when user clicks a language switcher.
2. **`preferredLanguage`** — browser's `Accept-Language` header; best signal for new visitors.
3. **`baseLocale` (`en`)** — final fallback if browser signals nothing recognizable.

### Behavior

| Scenario                     | Cookie | Browser lang       | Result                        |
| ---------------------------- | ------ | ------------------ | ----------------------------- |
| New visitor, Korean browser  | none   | `ko`               | Korean                        |
| New visitor, English browser | none   | `en`               | English                       |
| New visitor, German browser  | none   | `de` (unsupported) | English (baseLocale fallback) |
| User switched to English     | `en`   | `ko`               | English (cookie wins)         |
| User switched to Korean      | `ko`   | `en`               | Korean (cookie wins)          |
| Any domain, any browser      | `ko`   | any                | Korean (cookie wins)          |

**Key property:** Cookie always wins. `preferredLanguage` is only consulted when no cookie exists.
Once the user explicitly switches language (cookie set), their choice persists across all domains
and sessions until the cookie expires (~400 days).

### Why not preset `defaultLocale`?

An earlier proposal was to add `defaultLocale: 'ko'` to Korean dance presets (btango, vivimil) and
set the cookie from the preset in `hooks.server.ts`. This was rejected because:

- Browser language is a better signal than domain — a Korean-speaking user visiting `btango.com`
  from an English OS should see Korean via browser preference, not via domain guess
- An English speaker visiting `btango.com` should see English if their browser says `en`
- The domain/preset shouldn't override what the browser already knows
- `preferredLanguage` is the right abstraction; it makes the preset approach redundant

### Implementation

One config change in `vite.config.ts`:

```typescript
paraglideVitePlugin({
    project: './project.inlang',
    outdir: './src/lib/paraglide',
    strategy: ['cookie', 'preferredLanguage', 'baseLocale'],
}),
```

This regenerates `src/lib/paraglide/runtime.js` with `preferredLanguage` in the strategy array
and sets `TREE_SHAKE_PREFERRED_LANGUAGE_STRATEGY_USED = true`, enabling the
`extractLocaleFromNavigator()` call in the runtime.

**No changes needed to `hooks.server.ts`, `project.inlang/settings.json`, or `presets.ts`.**

Note: `preferredLanguage` is a client-side strategy — it reads `navigator.languages` in the
browser. Server-side (`hooks.server.ts`), the `paraglideMiddleware` reads `Accept-Language` from
the request headers. Both are handled automatically by Paraglide when the strategy is enabled.

Files to change:

- `vite.config.ts` — add `strategy` option to `paraglideVitePlugin`
- `src/lib/paraglide/runtime.js` — regenerated automatically by Vite on next build/dev start

---

## Phase 2: Language Switcher UI — DONE

### Design decisions

- **`en | 한` text-only toggle** in the upper-right corner of the header, absolutely positioned
- Active locale: **bold + full opacity**; inactive: **normal weight + opacity 0.7** (opacity 1 on hover)
- Pipe separator at reduced opacity (0.7) for subtlety
- Inherits header text color + text-shadow (same treatment as title text) so it stands out on
  complex background images
- Calls `setLocale(locale)` which sets `PARAGLIDE_LOCALE` cookie + **hard page reload** (avoids
  client-side reactivity glitches)
- Reusable `LanguageSwitcher` component — no props, reads locale from Paraglide directly
- Header only for now; footer placement deferred to a future pass
- Launcher page (`+page.svelte`) not included — veneer pages only

### Implementation

New file:

- `src/lib/components/LanguageSwitcher.svelte` — reusable switcher component

Changed file:

- `src/routes/[id1=vid]/[[id2=vid]]/+layout.svelte` — import + `<lang-switch>` wrapper inside
  `<d-header>`, positioned `absolute; top; right` with `z-index: 2` (above the gradient scrim)

---

## Phase 3: Locale-Aware Google Form Content — DONE (Option D)

Korean Google Forms commonly include bilingual content using conventions: labels use
`한국어 (English)` or `English (한국어)` parenthetical patterns, and longer content sections
use explicit markers to tag Korean-only and English-only blocks.

### Design decisions

- **Option D: Convention-based bilingual parsing** — parse existing dual-language patterns in
  Google Forms rather than maintaining separate forms (A), external translations (B), or accepting
  monolingual content (C)
- **Two independent features:**
  - **Feature A: Label/option splitting** — `Primary (Secondary)` where one part is mostly Korean
    and the other mostly English. Display locale-matching text with 🌐 toggle for the other.
    Graceful degradation: if pattern doesn't match or both parts are the same script, show as-is.
  - **Feature B: Content section markers** — explicit markers in form description text tag
    language-specific sections. Content outside markers is always visible; non-locale sections
    collapse into `<details><summary>` in their original document position.
- **Feature B marker format:**

  ```
  ~~ begin Korean ~~
  (Korean-only content here)
  ~~ end Korean ~~

  (shared content — always visible)

  ~~ begin English ~~
  (English-only content here)
  ~~ end English ~~
  ```

  Markers are case-insensitive. They look like decorative dividers in plain Google Forms.
  Content between matching begin/end pairs is tagged with that language. Content outside
  any markers is "shared" (always visible regardless of locale).

- **No reordering** — segments render in document order. Non-locale segments collapse in-place.
  `internalizeLinks()` runs on shared and locale-matching segments, so special buttons
  ("Sign up", "Check who's going") work regardless of which language section they appear in.
- **Script classification** (Feature A only) uses Unicode ranges (Hangul `\uAC00-\uD7AF` + Jamo)
  vs Latin `A-Za-z`. A string is classified as one script if it accounts for >60% of characters.
- **Parenthetical disambiguation** — `리드 (선택)` (both Korean) is NOT split; only splits when
  the two parts are different scripts.
- **Server-side label transforms** — bilingual label parsing happens in `+layout.server.ts` after
  `adjustGoogleFormData()`. Components receive pre-processed data and pick text by locale.
- **Client-side content segmentation** — `segmentBilingualContent()` runs in `+layout.svelte`
  on the raw info markdown, producing an ordered array of `ContentSegment` objects. Each segment
  renders in order: shared/locale-matching shown directly, others collapsed in `<details>`.
- **Submission values preserved** — form inputs always submit the original full string
  (e.g. `리드 (Lead)`) to Google Forms. Only the displayed text changes.
- **Forms can mix orderings** — `Korean (English)` and `English (Korean)` in the same form both work.
- **Summary labels** — `"Korean hidden"` / `"English hidden"` — simple text readable by both.

### Implementation

New file:

- `src/lib/locale-content.ts` — pure parsing functions: `classifyScript()`, `splitBilingualLabel()`,
  `segmentBilingualContent()`, `addBilingualData()`, `localeText()`
- `BilingualText` interface: `{ ko, en, original }`
- `BilingualQuestion` interface: extends `Question` with optional `bilingualTitle`,
  `bilingualDescription`, `bilingualOptions`
- `ContentSegment` interface: `{ lang: 'ko' | 'en' | 'shared', text: string }`

Changed files:

- `src/lib/index.ts` — re-exports `BilingualText`, `BilingualQuestion` types
- `src/routes/[id1=vid]/[[id2=vid]]/+layout.server.ts` — calls `addBilingualData()` on form fields
  after info extraction; passes resolved `locale` to client
- `src/routes/[id1=vid]/[[id2=vid]]/+layout.svelte` — calls `segmentBilingualContent()` on info
  markdown; renders segments in order with non-locale segments in `<details>`; `internalizeLinks()`
  runs on shared + locale-matching segments
- `src/lib/components/GoogleFormField.svelte` — uses `localeText()` for titles, descriptions, and
  options; per-item 🌐 toggle buttons; prop type changed to `BilingualQuestion`
- `src/lib/components/GroupRegistration.svelte` — same bilingual treatment for name/role field
  titles and role options

### Not yet handled (future)

- Info tab footer sections — only the main info block is segmented, not `=== Footer ===` sections
- `<option>` elements in dropdowns can't have toggle icons — show locale text only (acceptable)

---

## Phase 4: Locale-Aware Column Headers and Regex — TODO

`src/lib/dance-constants.ts` uses bilingual regex patterns:

```typescript
export const REGEX_DANCE_NAME = /name|닉네임/i
export const REGEX_DANCE_ROLE = /role|역할|리드|리더/i
// etc.
```

This works but isn't structured i18n. If more locales are added, these patterns grow unwieldy.

Future: locale-keyed pattern maps, or a more general NLP-based column detection.

---

## Phase 5: GroupRegistration Widget Strings — TODO

GroupRegistration is now ported (see `specs/port-temp-branch.md` § 4). Its UI strings are
currently hardcoded in Korean (`단체 N명`, `단체 취소`, `신청자 추가`, etc.). These need
translating via Paraglide messages for English-language visitors.

---

## Phase 6: `internalizeLinks()` Refactor — TODO

`+layout.svelte` contains hardcoded Korean keyword detection for link internalization:

```typescript
if (/신청/.test(line)) {
	/* form link */
}
if (/확인/.test(line)) {
	/* list link */
}
if (/오시는 길|수칙/i.test(line)) {
	/* info link */
}
```

This is locale-specific logic hardcoded in a general function. Needs refactoring to be either
locale-aware or keyword-configurable via preset.

---

## Implementation Order

```
Phase 1: preferredLanguage strategy   ← DONE
Phase 2: Language switcher UI         ← DONE (header only; footer deferred)
Phase 3: Locale-aware form content    ← DONE (Option D: convention-based bilingual parsing)
Phase 4: Locale-aware column regex    ← after port-temp-branch infra
Phase 5: GroupRegistration strings    ← after group registration ported
Phase 6: internalizeLinks() refactor  ← future
```
