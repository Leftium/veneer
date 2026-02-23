// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Result } from 'wellcrafted/result'
import type {
	GoogleSheet,
	GoogleFormDocument,
	GoogleDocumentError,
} from '$lib/google-document-util/types'

type DocumentResult = Result<GoogleSheet | GoogleFormDocument, GoogleDocumentError>

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** OG metadata computed in hooks.server.ts, injected into HTML via transformPageChunk */
			ogMeta?: {
				title: string
				image: string | null
				url: string
			}
			/** Pre-fetched document results from hooks.server.ts (avoids double-fetch with ssr=false) */
			documents?: {
				document1: DocumentResult
				document2: DocumentResult
			}
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {}
