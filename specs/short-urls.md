# Short URL Support for Default Document

## Goal

Support shorter URLs when viewing the default document, similar to how the `temp-vivianblues-com` branch handles hash-based navigation.

## Current Behavior (main branch)

- `/` reroutes to `/base/g.chwbD7sLmAoLe65Z8`
- Tabs require full path: `/base/g.chwbD7sLmAoLe65Z8/info`
- Tab buttons link to full URLs

## Desired Behavior

Support these short URL patterns (all using the default document):

| Short URL    | Reroutes to                |
| ------------ | -------------------------- |
| `/`          | `/base/{DEFAULT_DOC}`      |
| `/info`      | `/base/{DEFAULT_DOC}/info` |
| `/form`      | `/base/{DEFAULT_DOC}/form` |
| `/list`      | `/base/{DEFAULT_DOC}/list` |
| `/base/info` | `/base/{DEFAULT_DOC}/info` |
| `/base/form` | `/base/{DEFAULT_DOC}/form` |
| `/base/list` | `/base/{DEFAULT_DOC}/list` |

## Implementation

### 1. Update `src/hooks.ts`

```typescript
import { deLocalizeUrl } from '$lib/paraglide/runtime'

const DEFAULT_DOC = 'g.chwbD7sLmAoLe65Z8'
const TABS = ['info', 'form', 'list', 'raw', 'dev']

export const reroute = ({ url }) => {
	const path = deLocalizeUrl(url).pathname

	// / → /base/{DEFAULT_DOC}
	if (path === '/') {
		return `/base/${DEFAULT_DOC}`
	}

	// /{tab} → /base/{DEFAULT_DOC}/{tab}
	const tabOnly = path.match(/^\/(\w+)$/)
	if (tabOnly && TABS.includes(tabOnly[1])) {
		return `/base/${DEFAULT_DOC}/${tabOnly[1]}`
	}

	// /base/{tab} → /base/{DEFAULT_DOC}/{tab}
	const baseTabOnly = path.match(/^\/base\/(\w+)$/)
	if (baseTabOnly && TABS.includes(baseTabOnly[1])) {
		return `/base/${DEFAULT_DOC}/${baseTabOnly[1]}`
	}

	return path
}
```

### 2. Update Tab Button Links in `+layout.svelte`

Tab buttons should link to the short URL form **only when viewing the default document**.

```typescript
// In +layout.svelte
const DEFAULT_DOC = 'g.chwbD7sLmAoLe65Z8'

const isDefaultDoc = $derived(params.id1 === DEFAULT_DOC && !params.id2)

function getTabUrl(tab: string) {
	if (isDefaultDoc) {
		// Short URL: /base/info or just /info
		return `/base/${tab}`
	}
	// Full URL for non-default documents
	return `/${params.base}/${params.id1}${params.id2 ? `/${params.id2}` : ''}/${tab}`
}
```

Then in the template:

```svelte
{#each tabs as tab}
	<a href={getTabUrl(tab.id)} class:active={activeTab === tab.id}>
		{tab.icon}
		{tab.name}
	</a>
{/each}
```

### 3. Consider: Shared Constants

Move `DEFAULT_DOC` and `TABS` to a shared location:

```typescript
// src/lib/constants.ts
export const DEFAULT_DOC = 'g.chwbD7sLmAoLe65Z8'
export const TABS = ['info', 'form', 'list', 'raw', 'dev'] as const
```

## URL Examples

### Default Document

| User visits  | Browser shows | Reroutes to        |
| ------------ | ------------- | ------------------ |
| `/`          | `/`           | `/base/g.xxx`      |
| `/form`      | `/form`       | `/base/g.xxx/form` |
| `/base/form` | `/base/form`  | `/base/g.xxx/form` |

When clicking tab buttons on default doc, URLs stay short (`/base/info`, `/base/form`).

### Non-Default Document

| User visits           | Browser shows         |
| --------------------- | --------------------- |
| `/base/g.abc123`      | `/base/g.abc123`      |
| `/base/g.abc123/form` | `/base/g.abc123/form` |

Tab buttons use full URLs (`/base/g.abc123/info`, `/base/g.abc123/form`).

## Benefits

1. Cleaner URLs for the primary/default document
2. Easier to share and remember
3. Full document IDs still work for non-default documents
4. SEO-friendly route-based navigation preserved

## Notes

- The `reroute` hook handles server-side routing transparently
- Client-side navigation via `goto()` should also use short URLs when appropriate
- Consider making `DEFAULT_DOC` configurable via environment variable for different deployments
