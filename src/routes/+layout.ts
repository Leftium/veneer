// SSR is disabled globally to reduce serverless CPU usage on the free tier.
// OG meta tags are still present in the HTML because hooks.server.ts pre-fetches
// documents and injects OG tags via transformPageChunk (before resolve()).
// To re-enable full progressive enhancement (no-JS support), set ssr = true.
export const ssr = false
