# Server-Side Sheet Data Pipeline

> **Status**: Planned
>
> **Last updated**: 2026-03-10

## Overview

Move the sheet data pipeline from the client (`+layout.svelte`) to the server (`+layout.server.ts`). Currently the pipeline runs entirely client-side via a `$derived` chain, but every transform is a pure data function with no browser dependencies. Running it on the server enables progressive enhancement (no-JS support) and eliminates redundant client-side computation.

---

## Current Architecture

### Client-Side Pipeline (`+layout.svelte`, lines 91–108)

```ts
let raw = $derived(makeRaw(data.sheet))

let finalData = $derived(
	pipe(
		raw,
		extractColumnHeaders,
		stripEmptyRows,
		addIndex,
		adjustColumnTypes,
		adjustColumnLengths,
		stripEmptyColumns,
		hidePhoneNumbers,
		padNumericRenders,
		renderRelativeTimes,
		collectExtraDance,
		collectExtraPlaylist,
	),
)
```

- `data.sheet` is the raw `ResultGoogleSheet` from the server.
- `finalData` is consumed read-only — no user interaction ever triggers re-computation.
- `$derived` is effectively unused: `data.sheet` never changes after load (no `invalidate()` calls).

### Server Data Return (`+layout.server.ts`, lines 422–451)

The server currently returns the raw `sheet` Result object. The only server-side processing is `stripHidden()` (removing user-hidden columns/rows) and `detectSheetType()` (lightweight header scan for tab visibility).

---

## Proposed Architecture

### Move Pipeline to `+layout.server.ts`

Run the full `pipe()` chain on the server after `stripHidden()`. Return `finalData` (processed rows, columns, extra) instead of the raw `sheet` Result.

```ts
// +layout.server.ts (after stripHidden)
const raw = makeRaw(sheet)
const finalData = pipe(
	raw,
	extractColumnHeaders,
	stripEmptyRows,
	addIndex,
	adjustColumnTypes,
	adjustColumnLengths,
	stripEmptyColumns,
	hidePhoneNumbers,
	padNumericRenders,
	renderRelativeTimes,
	mergeDuplicateRows(mergeKeys), // if preset defines mergeKeys
	collectExtraDance,
	collectExtraPlaylist,
)

return {
	// ...existing fields...
	finalData, // replaces `sheet`
}
```

### Client Simplification (`+layout.svelte`)

Replace the reactive pipeline with direct consumption:

```ts
// Before:
let raw = $derived(makeRaw(data.sheet))
let finalData = $derived(pipe(raw, ...))

// After:
const finalData = data.finalData
```

All downstream consumers (`isDanceEvent`, `footerDancerData`, `Sheet.svelte`, etc.) remain unchanged — they already read from `finalData`.

---

## Prerequisites / Required Changes

### 1. Rename Pipeline File

Rename `sheet-data-pipeline.svelte.ts` → `sheet-data-pipeline.ts`. The file uses no Svelte runes — the `.svelte.ts` extension is unnecessary.

**Impact**: Update all import paths (layout, any other importers).

### 2. Add dayjs Timezone Plugin Import

The `renderRelativeTimes` transform calls `dayjs.tz()`, which requires the `timezone` plugin. Currently this works on the client only because `$lib/util.ts` extends dayjs globally as a side-effect of being bundled.

Add explicit import to the pipeline file:

```ts
import timezone from 'dayjs/plugin/timezone'
dayjs.extend(timezone)
```

### 3. Handle `renderRelativeTimes` Staleness

Relative time strings ("3 days ago") are computed at render time. On the server, these become stale if the response is cached.

**Current mitigation**: `ssr = false` means the server `load()` runs fresh for every page visit — staleness is negligible (seconds at most).

**Future mitigation (if SSR enabled)**: Either:

- Accept minor staleness (relative times are approximate anyway).
- Split the pipeline: run all transforms except `renderRelativeTimes` on the server; do time rendering on the client.
- Add a client-side post-process that refreshes time renders on an interval.

### 4. Preset Data Available on Server

Presets are already resolved in `+layout.server.ts` (line 132–133). Pipeline-influencing preset fields (e.g. `mergeKeys`) are directly accessible — no additional plumbing needed. This is simpler than the current approach of passing preset data through `data` to the client.

### 5. Return Shape Change

`data.sheet` (raw Result) is replaced by `data.finalData` (processed pipeline output). Components that currently import from `data.sheet` must be updated.

Check all consumers:

- `+layout.svelte`: `makeRaw(data.sheet)` → `data.finalData`
- Any component that reads `data.sheet` directly (verify via grep).

### 6. Error Handling

Currently `makeRaw` handles `isErr(sheet)` by returning empty data. This behavior must be preserved on the server — if sheet fetch failed, return empty `finalData` rather than crashing the pipeline.

---

## Migration Steps

1. **Rename** `sheet-data-pipeline.svelte.ts` → `sheet-data-pipeline.ts`, update imports.
2. **Add** dayjs timezone plugin import to the pipeline file.
3. **Move** `pipe()` call from `+layout.svelte` to `+layout.server.ts`.
4. **Update** server return: replace `sheet` with `finalData`.
5. **Simplify** `+layout.svelte`: remove `makeRaw`, `pipe`, pipeline imports; consume `data.finalData` directly.
6. **Update** `detectSheetType()` usage: currently runs separately on the server for tab logic — can be replaced by reading `finalData.extra.type` after the pipeline runs.
7. **Test** all sheet types (dance-event, playlist, generic table) render correctly.
8. **Test** relative time strings are fresh (not stale from caching).
9. **Verify** no-JS mode works if `ssr = true` is toggled (stretch goal).

---

## Risks and Considerations

| Risk                                            | Severity | Mitigation                                                                                                        |
| ----------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------- |
| Relative time staleness with future caching/SSR | Low      | Acceptable for now; split pipeline later if needed                                                                |
| dayjs timezone plugin not loaded on server      | Medium   | Explicit import in pipeline file (step 2)                                                                         |
| Increased server-side CPU per request           | Low      | Pipeline is fast (pure transforms on small datasets); offsets client CPU savings                                  |
| `ssr = false` currently set globally            | Info     | Pipeline works regardless of SSR setting; no-JS support is a bonus when SSR is enabled                            |
| Serialization size change                       | Low      | `finalData` may be slightly larger than raw `sheet` due to added `render` fields; negligible for typical datasets |

---

## Out of Scope

- Enabling `ssr = true` (separate decision with its own trade-offs).
- Client-side relative time refresh interval.
- Streaming/chunked pipeline output.
