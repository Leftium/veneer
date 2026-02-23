# Remove PicoCSS Migration Plan

## Status: Complete

PicoCSS has been fully removed and replaced with Open Props + sanitize.css. Route structure flattened. All phases done.

## What Was Done

### Phase 1: Create Custom Styles

- Created `src/lib/styles/forms.scss` with form element styles (inputs, textareas, selects, checkboxes, radios, submit buttons, labels, outline buttons)
- Created `src/lib/styles/variables.scss` with `--app-*` CSS custom properties replacing all `--pico-*` variables

### Phase 2: Update Components

All 8 components + 2 layouts updated from `--pico-*` to `--app-*`:

- `AutogrowingTextarea.svelte` — background, border-width, border-color, radius
- `NotificationBox.svelte` — card-sectioning-bg, background
- `Sheet.svelte` — spacing, card-sectioning-bg, muted-border
- `StickyHeaderSummaryDetailsGrid.svelte` — muted-border, card-sectioning-bg
- `GoogleFormField.svelte` — spacing
- `GoogleForm.svelte` — removed `class="container"`
- `GroupRegistration.svelte` — muted-color, del-color, color; restyled with left border accent
- Veneer `+layout.svelte` — muted-color, color, card-sectioning-bg
- `[flags]` `+page.svelte` — (later deleted entirely)

### Phase 3: Update app.scss + Global Centering

- `app.scss` rewritten: imports variables + forms, responsive images, hr, blockquote, base html/body styles, `.content-bg` card shadow, dark mode
- sanitize.css imported in `+layout.svelte` (base, forms, typography)

### Phase 4: Flatten Route Structure

- Deleted `src/routes/(centered)/+layout.svelte` (was no-op wrapper)
- Moved all routes to root: `[id1=vid]/[[id2=vid]]/`, `[flags]/[id1]/[[id2]]/`
- Deleted `(fluid)/` test page
- Removed `<main class="container">` from `+page.svelte` and `GoogleForm.svelte`
- Deleted `[flags]` route entirely (deprecated, redundant with main veneer route)

### Phase 5: Remove PicoCSS

- Removed `@picocss/pico` from `package.json`
- Added `sanitize.css` as replacement CSS reset
- Verified no pico references remain in codebase

### Additional Styling Refinements

- Card shadow on `.content-bg` matching PicoCSS depth effect
- White backgrounds for html/body/content, depth via shadow
- Dark mode: content-bg with subtle border, gray-11 outer bg
- Content padding: `$size-7` (2rem) for info/form, `$size-5` (1.5rem) for footer/notification
- Footer colors matching pico exactly
- Subtle hr styling, blockquote with left border
- Checkbox/radio size: 1.25em
- Reduced checkbox/radio label margin (half of field label margin)
- Tab navigation: segmented button bar with anchor reset (see `specs/tab-button-styles.md`)
- GroupRegistration: left border accent, bold labels, aligned spacing

## Layout Strategy

- **Body**: full-width (no max-width on body), allows future wider layouts
- **Content centering**: per-route on `<article>` with `max-width: $size-content-3` (60ch ~ 640px)
- **Padding**: on children, not body — allows edge-to-edge elements (header, footer, sheet table)
- **Card shadow**: on `.content-bg` class for depth on white-on-white backgrounds

## Variable Mapping (as implemented)

| PicoCSS Variable                          | Replacement                |
| ----------------------------------------- | -------------------------- |
| `--pico-background-color`                 | `--app-background-color`   |
| `--pico-color`                            | `--app-color`              |
| `--pico-muted-color`                      | `--app-muted-color`        |
| `--pico-border-width`                     | `--app-border-width`       |
| `--pico-border-radius`                    | `--app-border-radius`      |
| `--pico-form-element-border-color`        | `--app-border-color`       |
| `--pico-card-sectioning-background-color` | `--app-card-section-bg`    |
| `--pico-muted-border-color`               | `--app-muted-border-color` |
| `--pico-spacing`                          | `--app-spacing`            |
| `--pico-del-color`                        | `--app-del-color`          |

## Files Changed

- `src/app.scss` — rewritten
- `src/lib/styles/variables.scss` — new
- `src/lib/styles/forms.scss` — new
- `src/routes/+layout.svelte` — sanitize.css imports
- `src/routes/+page.svelte` — removed container, added scoped centering
- `src/routes/[id1=vid]/[[id2=vid]]/+layout.svelte` — article centering, padding, tab button bar
- `src/routes/(centered)/+layout.svelte` — deleted
- `src/routes/[flags]/` — deleted (entire route)
- 8 components updated (see Phase 2)
- `package.json` / `pnpm-lock.yaml` — pico removed, sanitize.css added
