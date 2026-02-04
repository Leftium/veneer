# Spec: SSR/CSR Branch Strategy

## Goal

Support both CSR (fast, low CPU) and SSR (no-JS friendly) deployments while maintaining a single codebase.

## Background

- Cloudflare Workers free tier has 10ms CPU limit
- SSR rendering consumes significant CPU (~15-20ms on CF)
- CSR (`ssr = false`) reduces server CPU to ~1-4ms
- However, SSR is needed for:
  - No-JavaScript users
  - Demo of no-JS animations
  - SEO (if needed)

## Constraints

- SvelteKit's `ssr` option must be a static boolean (cannot be dynamic per-request)
- Want to maintain single set of routes (no duplication)

## Proposed Solution

### Branch Structure

```
temp-vivianblues-com           -> CSR (ssr = false)
                                  Deploys to: viviblues.com
                                  Fast, low CPU

temp-vivianblues-com-ssr       -> SSR (ssr = true)
                                  Deploys to: ssr.viviblues.com (or similar)
                                  No-JS friendly
```

### Maintenance Workflow

The `-ssr` branch stays one commit ahead, rebasing on top of the base branch:

```bash
# After making changes to temp-vivianblues-com:
git checkout temp-vivianblues-com-ssr
git rebase temp-vivianblues-com
# The single "enable SSR" commit stays on top
```

### The SSR Commit

Single commit difference in `src/routes/+layout.ts`:

```typescript
// temp-vivianblues-com (CSR)
export const ssr = false

// temp-vivianblues-com-ssr (SSR)
export const ssr = true
```

## No-JS User Redirect

Add to root `+layout.svelte` on CSR branch:

```svelte
<noscript>
	<div class="nojs-banner">
		This site works best with JavaScript.
		<a href="https://ssr.viviblues.com{$page.url.pathname}"> View no-JS version </a>
	</div>
</noscript>
```

Or auto-redirect:

```svelte
<noscript>
	<meta http-equiv="refresh" content="0; url=https://ssr.viviblues.com{$page.url.pathname}" />
</noscript>
```

## Deployment

Both branches deploy to Cloudflare Workers with different worker names:

- `viviblues-com` (CSR)
- `viviblues-com-ssr` (SSR)

## Alternatives Considered

1. **URL param toggle** - Not possible; `ssr` must be static
2. **Route groups with symlinks** - Git symlinks problematic on Windows
3. **Route groups with shared components** - More files to maintain
4. **Single SSR deployment** - Exceeds Cloudflare CPU limits

## Status

- [ ] Create `temp-vivianblues-com-ssr` branch
- [ ] Add noscript redirect to CSR branch
- [ ] Configure Cloudflare deployment for SSR branch
