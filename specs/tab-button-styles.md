# Tab Button Style Differences: temp vs main

## Visual Difference

The tab buttons on `temp-vivianblues-com` and `main` branches look different despite having nearly identical SCSS styles.

## Root Cause: `<button>` vs `<a>`

| Branch | Element    | Markup                                                       |
| ------ | ---------- | ------------------------------------------------------------ |
| temp   | `<button>` | `<button class={['glass', { active }]} onclick={...}>`       |
| main   | `<a>`      | `<a class={['glass', { active }]} href={...} onclick={...}>` |

Main switched from `<button>` to `<a>` to support route-based navigation (proper `href` for SEO, accessibility, and right-click "open in new tab").

## Why This Causes Style Differences

### 1. PicoCSS Default Styles

PicoCSS applies different default styles to `<button>` vs `<a>`:

- **`<button>`**: Has button-specific padding, background, border-radius, font-weight
- **`<a>`**: Has link-specific styles (underline, color, no background)

The `role="group"` on `<nav-buttons>` may also trigger PicoCSS group styling for buttons but not anchors.

### 2. SCSS Selector Mismatch

The SCSS was updated but may have residual issues:

```scss
// temp: targets button
nav-buttons {
	button {
		// styles...
	}
}

// main: targets a (but some selectors commented out)
nav-buttons {
	//button,
	a {
		// styles...
	}
}
```

### 3. Focus/Active State Selectors

```scss
// temp
&:has(button:focus) {
	box-shadow: none;
}

// main (partially commented)
&:focus-visible/*,
&:has(button:focus) &:has(a:focus)*/ {
	box-shadow: none;
}
```

## Solution Options

### Option 1: Reset anchor styles explicitly

Add CSS reset for anchors inside nav-buttons:

```scss
nav-buttons {
	a {
		// Reset link defaults
		text-decoration: none;
		color: inherit;

		// Apply button-like styles
		flex: 0 1 auto;
		min-width: 0;
		// ... rest of styles
	}
}
```

### Option 2: Use `role="button"` on anchors

```svelte
<a
    role="button"
    class={['glass', { active: activeTab === tid }]}
    href={`/${params.base}/${params.id1}/${tid}`}
    onclick={(e) => {
        e.preventDefault()
        slideToTab(tid)
    }}
>
```

This tells PicoCSS to style the anchor like a button.

### Option 3: Keep `<button>` but enhance accessibility

Keep `<button>` elements but wrap in an `<a>` or use progressive enhancement:

```svelte
{#if hasJS}
	<button class={['glass', { active }]} onclick={() => slideToTab(tid)}>
		{icon}
		{name}
	</button>
{:else}
	<a href={`/${params.base}/${params.id1}/${tid}`} class="glass">
		{icon}
		{name}
	</a>
{/if}
```

## Recommended Fix

Use **Option 1** (reset anchor styles) combined with ensuring all button-like properties are explicitly set:

```scss
nav-buttons {
	a {
		// Reset anchor defaults
		text-decoration: none;
		color: inherit;
		cursor: pointer;

		// Match button appearance
		flex: 0 1 auto;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		text-align: center;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: $size-1 $size-4;

		background-color: rgba(255, 255, 255, 0%);

		&.active {
			background-color: rgba(255, 255, 255, 10%);
		}

		&:hover {
			background-color: rgba(255, 255, 255, 15%);
		}
	}
}
```

## Files Affected

- `src/routes/(centered)/[base=base]/[id1=vid]/[[id2=vid]]/+layout.svelte`
