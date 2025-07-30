import type { adjustGoogleFormData } from '$lib/google-document-util/google-form'
import type { stripHidden } from '$lib/google-document-util/google-sheets'
import type { Result } from 'neverthrow'

export type GoogleDocumentError = {
	message: string
	documentId?: string
	type?: 'form' | 'sheet'
}

export type GoogleSheet = {
	type: 'sheet'
	documentId: string
} & ReturnType<typeof stripHidden>

export type GoogleForm = {
	type: 'form'
	documentId: string
} & ReturnType<typeof adjustGoogleFormData>

export type FetchWithDocumentIdResult = Result<GoogleSheet | GoogleForm, GoogleDocumentError>
