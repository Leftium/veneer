# Tab Button Styles

## Status: Complete

## Problem

Tab navigation buttons (`<a>` elements inside `<nav-buttons>`) displayed as underlined links instead of a cohesive button bar. Root cause: switching from `<button>` to `<a>` for route-based navigation (SEO, accessibility, right-click support) meant anchor default styles (underline, link color) applied instead of button styles.

## Solution

Used **Option 1: Reset anchor styles explicitly** with a segmented button bar layout.

### Key styles applied:

1. **Anchor reset** on `nav-buttons a`: `text-decoration: none`, `color: inherit`
2. **Segmented button bar rounding**: flat edges between buttons, `$radius-round` only on first/last child
3. **Glass effect**: `.glass` class with backdrop blur, border, box-shadow; pseudo-elements inherit `border-radius`
4. **Focus selector**: `&:has(a:focus)` for proper focus state handling

### Final SCSS structure:

```scss
nav-buttons {
	a {
		text-decoration: none;
		color: inherit;
		border-radius: 0;

		&:first-child {
			border-radius: $radius-round 0 0 $radius-round;
		}
		&:last-child {
			border-radius: 0 $radius-round $radius-round 0;
		}
		&:only-child {
			border-radius: $radius-round;
		}
	}
}

.glass {
	// No border-radius here; inherits from button bar rules
	border: 1px solid rgba(255, 255, 255, 0.3);
}

.glass::before,
.glass::after {
	border-radius: inherit;
}
```

## File

- `src/routes/[id1=vid]/[[id2=vid]]/+layout.svelte`
