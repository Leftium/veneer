# Tab Visibility Refactor

> **Status**: Draft
>
> **Last updated**: 2026-03-01

## Overview

Refactor how visible tabs are determined. Currently tab lists are hardcoded per preset and the only override is `?tabs=` which replaces the entire list. This spec introduces:

1. **Smart defaults** — tab list is computed from content heuristics (sheet type, info length), not hardcoded
2. **Server-side sheet type detection** — move dance-event/playlist detection to the server so tab decisions don't require client-side hydration
3. **`?tabs=` modifier syntax** — add/remove individual tabs from computed defaults instead of replacing the whole list
4. **Sheet.svelte separation** — split the monolithic component into focused sub-components

## Motivation

- The party.leftium.com form has short info content that doesn't warrant a separate info tab, but previously all presets hardcoded `['info', 'form', 'list']`.
- Dance-event sheets show a custom single-column list view, but whether to show `list` vs `table` is decided client-side with no server awareness.
- Playlist sheets auto-show the table tab client-side, but the server doesn't know it's a playlist.
- There's no way to tweak the tab list without redefining it entirely (e.g., "give me the defaults but also add the dev tab").
- `Sheet.svelte` (683 lines) mixes three unrelated rendering modes behind one `{#if}` chain.

---

## Phase 1: Server-Side Sheet Type Detection

### Problem

Sheet type detection (dance-event, playlist) currently runs entirely in the client-side pipeline (`sheet-data-pipeline.svelte.ts`). The server returns raw sheet data with no type awareness, so tab decisions can't account for sheet type.

### Solution

Add a lightweight `detectSheetType()` function that runs server-side. It only needs to:

1. Find the header row (the row with the most cells — same heuristic as `extractColumnHeaders`)
2. Extract cell string values as column titles
3. Check against the existing regex constants from `dance-constants.ts` and `playlist-constants.ts`

```typescript
// src/lib/google-document-util/detect-sheet-type.ts

import { REGEX_DANCE_NAME, REGEX_DANCE_ROLE } from '$lib/dance-constants'
import { REGEX_PLAYLIST_TITLE, REGEX_PLAYLIST_ARTIST } from '$lib/playlist-constants'

type SheetType = 'dance-event' | 'playlist' | null

export function detectSheetType(rows: (string | (string | number)[])[][]): SheetType {
	if (!rows.length) return null

	// Find header row: the row with the most cells (same heuristic as extractColumnHeaders)
	let headerRowIndex = 0
	for (let i = 1; i < rows.length; i++) {
		if (rows[i].length > rows[headerRowIndex].length) {
			headerRowIndex = i
		}
	}

	// Extract column titles (cell is either a string or [string, timestamp] tuple)
	const titles = rows[headerRowIndex].map((cell) =>
		typeof cell === 'string' ? cell : (cell?.[0] ?? ''),
	)

	// Dance-event: requires both name and role columns
	const hasName = titles.some((t) => REGEX_DANCE_NAME.test(t))
	const hasRole = titles.some((t) => REGEX_DANCE_ROLE.test(t))
	if (hasName && hasRole) return 'dance-event'

	// Playlist: requires both title and artist columns
	const hasTitle = titles.some((t) => REGEX_PLAYLIST_TITLE.test(t))
	const hasArtist = titles.some((t) => REGEX_PLAYLIST_ARTIST.test(t))
	if (hasTitle && hasArtist) return 'playlist'

	return null
}
```

~30 lines. Reuses existing regex constants. No pipeline dependencies.

### Integration

In `+layout.server.ts`, after the sheet is fetched and `stripHidden` is applied:

```typescript
import { detectSheetType } from '$lib/google-document-util/detect-sheet-type'

// After: sheet = Ok(stripHidden(sheet.data, allCols, allRows))
const sheetType = isOk(sheet) ? detectSheetType(sheet.data.rows) : null
```

The `sheetType` is then used by the tab computation logic (Phase 2) and passed to the client for rendering decisions.

### Priority rule

Same as client-side: dance-event detection takes precedence over playlist. If a sheet has both name+role AND title+artist columns, it's classified as `dance-event`.

### Relationship to client-side `extra.type`

The client-side pipeline (`collectExtraDance`, `collectExtraPlaylist`) does the same detection but also builds column indices (`ci`), computes stats (`count`, `trackCount`, `totalDuration`), and transforms rows (reverse, group expansion). The server-side `detectSheetType()` intentionally duplicates only the detection (cheap: ~5 regex tests on ~10 column titles) and leaves the processing to the client.

**Option B (future):** Move column index mapping (`ci`) to the server alongside detection, so the client pipeline receives `ci` as input instead of rediscovering it. This would:

- Eliminate the detection duplication
- Simplify `collectExtraDance`/`collectExtraPlaylist` into pure row-transform functions
- Be a stepping stone toward full server-side rendering (see [Future: SSR Progression](#future-ssr-progression))

---

## Phase 2: Tab Heuristic Refactor

### Current behavior

Each preset hardcodes a `tabs` array (e.g., `['info', 'form', 'list']`). The server uses this directly as the visible tab set. The info heuristic (added in `b734e62`) auto-adds `info` when content is long, but only when the preset doesn't already include it.

### New behavior: computed defaults

The tab list is computed in stages:

```
Stage 1: Base tabs (from sheet type)
  ├── dance-event  → ['form', 'list']
  ├── playlist     → ['form', 'list', 'table']
  └── generic/null → ['form', 'table']

Stage 2: Info heuristic
  └── If info content >= 30 trimmed lines → prepend 'info'

Stage 3: Preset override (if preset explicitly lists tabs)
  └── Preset tabs replace stages 1-2 entirely

Stage 4: ?tabs= override (if present)
  └── Absolute list or modifier syntax (see Phase 3)
```

### Preset changes

Most presets should **not** specify a `tabs` array, letting the heuristics decide. To opt out of heuristics, a preset explicitly sets `tabs`:

| Preset         | `tabs`                    | Rationale                                          |
| -------------- | ------------------------- | -------------------------------------------------- |
| `base`         | _(omit — use heuristics)_ | Generic; let sheet type + info length decide       |
| `btango`       | _(omit)_                  | Dance events; heuristics will detect and show list |
| `btango-class` | _(omit)_                  | Same                                               |
| `btango-dj`    | _(omit)_                  | Same (previously hardcoded `['form', 'list']`)     |
| `vivimil`      | _(omit)_                  | Same                                               |
| `party`        | _(omit)_                  | Same                                               |
| `minimal`      | `['info']`                | Explicitly info-only, no form/list                 |
| `kiosk`        | `['form']`                | Explicitly form-only                               |

The `Preset` interface changes `tabs` from required to optional:

```typescript
export interface Preset {
	tabs?: string[] // explicit tab list; omit to use heuristics
	// ... rest unchanged
}
```

### Server-side logic

```typescript
// Compute default tabs from sheet type
function computeDefaultTabs(sheetType: SheetType, infoLines: number): string[] {
	let tabs: string[]
	switch (sheetType) {
		case 'dance-event':
			tabs = ['form', 'list']
			break
		case 'playlist':
			tabs = ['form', 'list', 'table']
			break
		default:
			tabs = ['form', 'table']
			break
	}
	if (infoLines >= INFO_LINE_THRESHOLD) {
		tabs = ['info', ...tabs]
	}
	return tabs
}

// In the load function:
const infoLines = info.trimEnd().split('\n').length
const computedTabs = computeDefaultTabs(sheetType, infoLines)
const tabs = preset.tabs ?? computedTabs // preset overrides heuristics if explicit
// Then ?tabs= further overrides (see Phase 3)
```

---

## Phase 3: `?tabs=` Modifier Syntax

### Current behavior

`?tabs=form.list` replaces the entire tab list. `?tabs=*` expands to all tabs via redirect.

### New behavior

The `?tabs=` parameter supports two modes:

1. **Absolute mode** (backward compatible): plain tab names separated by `.` → replaces the entire list
2. **Modifier mode**: segments prefixed with `+` or `-` → add/remove from a base

### Syntax

The presence of `+` or `-` anywhere in the value triggers modifier mode.

```
?tabs=form.list          → Absolute: exactly [form, list]
?tabs=+dev               → Modifier: computed defaults + dev
?tabs=-table             → Modifier: computed defaults - table
?tabs=+info-table        → Modifier: computed defaults + info - table
?tabs=*-info             → Modifier: all tabs - info
?tabs=~+dev              → Modifier: preset tabs + dev
```

#### Bases

| Prefix   | Meaning                                            | When to use                                |
| -------- | -------------------------------------------------- | ------------------------------------------ |
| _(none)_ | Computed defaults (after heuristics)               | "Smart defaults, but tweak this one thing" |
| `*`      | All tabs (`info.form.list.table.raw.dev`)          | "Show everything except..."                |
| `~`      | Preset tabs (raw `preset.tabs`, before heuristics) | "Use preset exactly, but add/remove..."    |

The base prefix, if present, must be the first character. `+`/`-` act as both operators and delimiters.

#### Parsing

```typescript
function parseTabs(param: string, computedTabs: string[], presetTabs: string[]): string[] {
	// No +/- anywhere → absolute mode (backward compatible)
	if (!param.includes('+') && !param.includes('-')) {
		return param.split('.').filter((t) => ALL_TABS.includes(t))
	}

	// Modifier mode: determine base
	let base: string[]
	let expr = param
	if (expr.startsWith('*')) {
		base = [...ALL_TABS]
		expr = expr.slice(1)
	} else if (expr.startsWith('~')) {
		base = [...presetTabs]
		expr = expr.slice(1)
	} else {
		base = [...computedTabs]
	}

	// Parse +/- segments: split on lookahead before + or -
	const ops = expr.match(/[+-][a-z]+/gi) || []
	const result = new Set(base)
	for (const op of ops) {
		const name = op.slice(1)
		if (!ALL_TABS.includes(name)) continue
		if (op[0] === '+') result.add(name)
		else result.delete(name)
	}

	// Preserve canonical tab order
	return ALL_TABS.filter((t) => result.has(t))
}
```

#### Examples

Given computed defaults = `['form', 'list']` (dance-event, short info):

| `?tabs=`         | Result                | Explanation                                    |
| ---------------- | --------------------- | ---------------------------------------------- |
| `form.list`      | `[form, list]`        | Absolute (no `+`/`-`)                          |
| `+info`          | `[info, form, list]`  | Add info to computed                           |
| `+dev`           | `[form, list, dev]`   | Add dev to computed                            |
| `-list+table`    | `[form, table]`       | Remove list, add table                         |
| `*-info-raw-dev` | `[form, list, table]` | All tabs minus info, raw, dev                  |
| `~+table`        | depends on preset     | Preset tabs + table                            |
| `*`              | all tabs              | Unchanged behavior (redirect to explicit list) |

Note: Final tab order always follows the canonical `ALL_TABS` order, regardless of the order `+`/`-` operations appear.

### Backward compatibility

- Plain `form.list` still works (absolute mode)
- `*` still redirects to expanded list
- No existing URLs break

---

## Phase 4: Split Sheet.svelte

### Current state

`Sheet.svelte` (683 lines) contains three rendering modes in one `{#if}` chain:

```svelte
{#if forceTable || !extra.type}
	<!-- Generic table: column rotation, pinning, resize observer (210 lines script + 50 lines template) -->
{:else if extra.type === 'dance-event'}
	<!-- Dance-event list: dancer icons, group expansion, payment status (45 lines template) -->
{:else if extra.type === 'playlist'}
	<!-- Playlist list: track info, YouTube links, BPM/duration (50 lines template) -->
{/if}
```

Plus ~300 lines of styles split across the three modes.

### Proposed structure

```
src/lib/components/
├── SheetTable.svelte          ← Generic table (rotation, pinning, resize)
├── DanceEventList.svelte      ← Dance-event single-column list
├── PlaylistList.svelte        ← Playlist single-column list
└── Sheet.svelte               ← Thin wrapper that delegates to the above
```

`Sheet.svelte` becomes a router:

```svelte
<script lang="ts">
	import SheetTable from './SheetTable.svelte'
	import DanceEventList from './DanceEventList.svelte'
	import PlaylistList from './PlaylistList.svelte'

	let { data, title = '', forceTable = false }: Props = $props()
</script>

{#if forceTable || !data.extra?.type}
	<SheetTable {data} />
{:else if data.extra.type === 'dance-event'}
	<DanceEventList {data} {title} />
{:else if data.extra.type === 'playlist'}
	<PlaylistList {data} />
{/if}
```

### Shared code

- `StickyHeaderGrid` — already a separate component, used by all three
- `rowDetails` snippet — shared detail-expansion view; can be passed as a snippet prop or extracted to a shared module
- `getDancersFromSheetData` — already in `$lib/util.ts`
- `formatPlayTime` — small utility, can move to `$lib/util.ts` or stay local to `PlaylistList.svelte`

### Benefits

- Each component is focused (~150-250 lines each, down from 683)
- Styles are colocated with their rendering mode
- Easier to add new sheet types in the future (just add a new component + detection regex)
- The generic table's complex column rotation/pinning logic doesn't pollute the simple list views

---

## Implementation Order

| Phase                                     | Depends on                            | Estimated size                                             |
| ----------------------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| Phase 1: Server-side sheet type detection | —                                     | ~30 lines new file + ~5 lines integration                  |
| Phase 2: Tab heuristic refactor           | Phase 1                               | ~40 lines refactor in `+layout.server.ts` + preset changes |
| Phase 3: `?tabs=` modifier syntax         | Phase 2                               | ~30 lines parser + update existing param handling          |
| Phase 4: Split Sheet.svelte               | Independent (can be done in parallel) | Reorganization, no new logic                               |

Phases 1-3 are sequential. Phase 4 is independent and can be done at any time.

---

## Files affected

| File                                                 | Changes                                                                                                         |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `src/lib/google-document-util/detect-sheet-type.ts`  | **New** — `detectSheetType()` function                                                                          |
| `src/lib/presets.ts`                                 | Make `tabs` optional; remove from most presets                                                                  |
| `src/routes/[id1=vid]/[[id2=vid]]/+layout.server.ts` | Call `detectSheetType()`, compute default tabs, parse modifier syntax, pass `sheetType` to client               |
| `src/hooks.ts`                                       | _(no change — reroute doesn't need sheet type)_                                                                 |
| `src/hooks.server.ts`                                | _(no change — OG preload doesn't need sheet type)_                                                              |
| `src/routes/[id1=vid]/[[id2=vid]]/+layout.svelte`    | Consume `sheetType` from server data; use for `showTableTab` / `isSpecialSheet` instead of client-side pipeline |
| `src/lib/components/Sheet.svelte`                    | Split into `SheetTable.svelte`, `DanceEventList.svelte`, `PlaylistList.svelte`                                  |
| `src/lib/components/SheetTable.svelte`               | **New** — generic table component                                                                               |
| `src/lib/components/DanceEventList.svelte`           | **New** — dance-event list component                                                                            |
| `src/lib/components/PlaylistList.svelte`             | **New** — playlist list component                                                                               |

---

## Future: SSR Progression

Currently the app has `ssr = false` globally (`src/routes/+layout.ts`). Without JavaScript, users see a blank page. OG meta tags are injected via `hooks.server.ts` for social bots, but no actual content is server-rendered.

Moving sheet type detection server-side (Phase 1) is the first step toward progressive enhancement. The full progression:

| Step                       | What moves server-side                                                                 | SSR impact                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Phase 1 (this spec)**    | Sheet type detection only                                                              | Tab decisions are server-aware; rendering still client-only                 |
| **Option B (future)**      | Detection + column index mapping (`ci`)                                                | Client pipeline simplified; server _could_ pre-process rows but doesn't yet |
| **Full pipeline (future)** | Row transforms (reverse, group expansion, index padding, phone hiding, relative times) | Server has fully processed data; SSR can render the list/table components   |
| **`ssr = true` (future)**  | SvelteKit server-renders HTML                                                          | No-JS users see content; progressive enhancement achieved                   |

### Blockers for `ssr = true`

- **Serverless CPU cost:** Original reason SSR was disabled — full SSR on free tier (Vercel/Cloudflare) may be too expensive for every request. Could be mitigated with caching or conditional SSR (e.g., SSR only for bot User-Agents).
- **Swiper dependency:** The tab system uses Swiper (web component), which is JS-dependent. The existing `hidden={!hasJS && tid !== 'info'}` pattern shows awareness of this issue but doesn't fully solve it.
- **Client-side reactivity:** The pipeline runs as `$derived` reactive state. Moving it server-side means either running it in the load function (one-shot, no reactivity) or keeping a client-side copy for live updates.

### Why Option B matters for SSR

With Option A, the server only knows the sheet _type_. It can't render a dance-event list because it doesn't know which column is "name", which is "role", etc. With Option B, the server has `ci` — enough to build the `extra` object and pass fully processed data to SSR'd components. This makes Option B the key prerequisite for meaningful server-side rendering of special sheet types.
