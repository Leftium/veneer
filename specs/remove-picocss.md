# Remove PicoCSS Migration Plan

## Overview

Remove PicoCSS dependency and replace with minimal custom styles using Open Props. This simplifies the CSS architecture while maintaining form element styling.

## Current PicoCSS Usage

### Files Using PicoCSS Variables

| File                                                       | Usage                                                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/app.scss`                                             | Main import, `--pico-font-size` overrides                                                                    |
| `src/lib/components/AutogrowingTextarea.svelte`            | `--pico-background-color`, `--pico-border-width`, `--pico-form-element-border-color`, `--pico-border-radius` |
| `src/lib/components/NotificationBox.svelte`                | `--pico-card-sectioning-background-color`, `--pico-background-color`                                         |
| `src/lib/components/Sheet.svelte`                          | `--pico-spacing`, `--pico-card-sectioning-background-color`, `--pico-muted-border-color`                     |
| `src/lib/components/StickyHeaderSummaryDetailsGrid.svelte` | `--pico-muted-border-color`, `--pico-card-sectioning-background-color`                                       |
| `+layout.svelte` / `+page.svelte`                          | `--pico-muted-color`, `--pico-color`, `--pico-card-sectioning-background-color`, `role="group"` behavior     |

### PicoCSS Features Currently Used

1. **Form element styling** - inputs, textareas, selects, checkboxes, radio buttons, submit buttons
2. **Color scheme** - Light/dark mode via `--pico-*` variables
3. **Typography** - Base font sizing
4. **Semantic elements** - `<article>`, `role="group"`, `role="button"`
5. **Spacing** - `--pico-spacing`

## New Layout Strategy

### Container Approach

- Single centered container using Open Props `$size-content-3` (max-width)
- No breakpoints except optional phone breakpoint
- Table/data views allowed to overflow horizontally

```scss
@use 'open-props-scss' as *;

.container {
	max-width: $size-content-3;
	margin-inline: auto;
	padding-inline: $size-3;
}

// Allow tables to overflow
.table-container {
	overflow-x: auto;
	margin-inline: calc(-1 * $size-3); // Bleed to edges
	padding-inline: $size-3;
}
```

### Breakpoints

| Breakpoint                    | Purpose                                              |
| ----------------------------- | ---------------------------------------------------- |
| None (default)                | Desktop-first, content centered in `$size-content-3` |
| `max-width: 480px` (optional) | Phone adjustments if needed                          |

## Form Element Replacement

### Custom Form Styles

Create `src/lib/styles/forms.scss`:

```scss
@use 'open-props-scss' as *;

// Base form element styles
input,
textarea,
select {
	display: block;
	width: 100%;
	padding: $size-2 $size-3;
	margin-block: $size-2;

	font-family: inherit;
	font-size: $font-size-1;
	line-height: $font-lineheight-3;

	color: $gray-9;
	background-color: $gray-0;
	border: 1px solid $gray-4;
	border-radius: $radius-2;

	transition: border-color 0.2s ease;

	&:focus {
		outline: none;
		border-color: $blue-6;
		box-shadow: 0 0 0 3px $blue-2;
	}

	&::placeholder {
		color: $gray-5;
	}
}

textarea {
	min-height: 6em;
	resize: vertical;
}

select {
	cursor: pointer;
	appearance: none;
	background-image: url('data:image/svg+xml,...'); // Dropdown arrow
	background-repeat: no-repeat;
	background-position: right $size-3 center;
	padding-right: $size-7;
}

// Checkbox and radio
input[type='checkbox'],
input[type='radio'] {
	display: inline-block;
	width: auto;
	margin-right: $size-2;
	accent-color: $blue-6;
}

// Submit button
input[type='submit'],
button[type='submit'] {
	display: block;
	width: 100%;
	padding: $size-3 $size-4;
	margin-top: $size-4;

	font-size: $font-size-2;
	font-weight: $font-weight-6;
	color: white;

	background-color: $blue-6;
	border: none;
	border-radius: $radius-2;
	cursor: pointer;

	transition: background-color 0.2s ease;

	&:hover {
		background-color: $blue-7;
	}

	&:active {
		background-color: $blue-8;
	}
}

// Labels
label {
	display: block;
	margin-top: $size-3;
	font-weight: $font-weight-5;
}

// Inline label (for checkbox/radio)
label:has(input[type='checkbox']),
label:has(input[type='radio']) {
	display: flex;
	align-items: center;
	font-weight: normal;
	cursor: pointer;
}
```

### Dark Mode Support

```scss
@media (prefers-color-scheme: dark) {
	input,
	textarea,
	select {
		color: $gray-1;
		background-color: $gray-9;
		border-color: $gray-6;

		&:focus {
			border-color: $blue-4;
			box-shadow: 0 0 0 3px $blue-9;
		}
	}

	input[type='submit'],
	button[type='submit'] {
		background-color: $blue-5;

		&:hover {
			background-color: $blue-4;
		}
	}
}
```

## Variable Mapping

Replace PicoCSS variables with Open Props equivalents:

| PicoCSS Variable                          | Replacement                                |
| ----------------------------------------- | ------------------------------------------ |
| `--pico-font-size`                        | `$font-size-1` or custom `--app-font-size` |
| `--pico-background-color`                 | `$gray-0` / `$gray-9` (dark)               |
| `--pico-color`                            | `$gray-9` / `$gray-1` (dark)               |
| `--pico-muted-color`                      | `$gray-5`                                  |
| `--pico-border-width`                     | `1px`                                      |
| `--pico-border-radius`                    | `$radius-2`                                |
| `--pico-form-element-border-color`        | `$gray-4` / `$gray-6` (dark)               |
| `--pico-card-sectioning-background-color` | `$gray-1` / `$gray-8` (dark)               |
| `--pico-muted-border-color`               | `$gray-3` / `$gray-7` (dark)               |
| `--pico-spacing`                          | `$size-3`                                  |

## Migration Steps

### Phase 1: Create Custom Styles

1. Create `src/lib/styles/forms.scss` with form element styles
2. Create `src/lib/styles/layout.scss` with container styles
3. Create `src/lib/styles/variables.scss` with custom CSS variables for theming

### Phase 2: Update Components

Update each component to use new variables:

1. `AutogrowingTextarea.svelte` - Replace pico vars
2. `NotificationBox.svelte` - Replace pico vars
3. `Sheet.svelte` - Replace pico vars
4. `StickyHeaderSummaryDetailsGrid.svelte` - Replace pico vars
5. `+layout.svelte` - Replace pico vars, remove `role="group"` reliance

### Phase 3: Update app.scss

```scss
// Remove this:
// @use '@picocss/pico/scss/pico' with ($theme-color: 'blue');

// Add this:
@use 'open-props-scss' as *;
@use '$lib/styles/variables';
@use '$lib/styles/forms';
@use '$lib/styles/layout';

// Base styles
html {
	scrollbar-gutter: stable;
	font-size: 115%;
}

body {
	font-family: $font-sans;
	line-height: $font-lineheight-3;
	color: $gray-9;
	background-color: $gray-0;
}

@media (prefers-color-scheme: dark) {
	body {
		color: $gray-1;
		background-color: $gray-9;
	}
}
```

### Phase 4: Remove PicoCSS

1. Remove `@picocss/pico` from `package.json`
2. Run `pnpm install`
3. Test all form elements and layouts

## Tab Button Fix (Related)

After removing PicoCSS, the tab button styling issue resolves itself since we'll have explicit styles for both `<button>` and `<a>` elements:

```scss
nav-buttons {
	display: flex;
	justify-content: center;
	gap: $size-1;

	button,
	a {
		// Explicit shared styles
		text-decoration: none;
		color: inherit;
		padding: $size-1 $size-4;
		background-color: transparent;
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: $radius-2;
		cursor: pointer;

		&.active {
			background-color: rgba(255, 255, 255, 0.1);
		}

		&:hover {
			background-color: rgba(255, 255, 255, 0.15);
		}
	}
}
```

## Benefits

1. **Smaller bundle** - Remove ~50KB of PicoCSS
2. **More control** - No unexpected style overrides
3. **Simpler debugging** - Explicit styles, no framework magic
4. **Consistent with Open Props** - Single design token source
5. **Tab button issue resolved** - No more `<button>` vs `<a>` style conflicts

## Risks

1. **Form styling effort** - Need to style all form elements manually
2. **Dark mode** - Need to implement manually
3. **Accessibility** - Need to ensure focus states, contrast ratios manually

## Testing Checklist

- [ ] All form input types render correctly
- [ ] Form validation states (required, invalid) display
- [ ] Dark mode works
- [ ] Focus states visible and accessible
- [ ] Submit button states (hover, active, disabled)
- [ ] Checkbox and radio alignment
- [ ] Select dropdown arrow
- [ ] Textarea resize behavior
- [ ] Layout containers centered correctly
- [ ] Tables overflow horizontally on mobile
- [ ] Tab buttons styled consistently
