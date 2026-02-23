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

## Phase 3: Locale-Aware Google Form Content — TODO (large)

The hardest part. Google Forms are authored in a single language — there's no native multilingual
support. Options:

### Option A: Separate forms per locale (simplest)

Add locale-keyed doc IDs to presets:

```typescript
export interface Preset {
    defaultFormId?: string
    localizedFormIds?: Record<string, string>  // locale → doc ID
    // ...
}

btango: {
    defaultFormId: 'g.4EKt4Vyz...',          // Korean (default)
    localizedFormIds: { en: 'g.english...' }, // English variant
}
```

`+layout.server.ts` picks the right form ID based on resolved locale. Requires maintaining separate
forms per language — high operational cost, but zero code complexity in rendering.

### Option B: Translation layer (complex)

Store translations separately (e.g., in a Sheet, or a JSON in the repo), apply at render time.
Custom translation format would need to map Google Form field IDs to localized strings.

### Option C: Accept monolingual content (pragmatic, for now)

Korean dance community forms are authored in Korean — that's the intended audience. English
speakers using these forms are a small minority. Document this as a known limitation. Phase 1
(browser language detection) still helps for veneer UI strings.

**Recommendation:** Option C now, Option A later if demand warrants it.

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
Phase 3: Locale-aware form content    ← future, Option C (defer) for now
Phase 4: Locale-aware column regex    ← after port-temp-branch infra
Phase 5: GroupRegistration strings    ← after group registration ported
Phase 6: internalizeLinks() refactor  ← future
```
