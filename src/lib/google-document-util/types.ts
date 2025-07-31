import type { adjustGoogleFormData } from '$lib/google-document-util/google-form'
import type { Result } from 'neverthrow'

export type GoogleDocumentError = {
	message: string
	documentId?: string
	type?: 'form' | 'sheet'
}

type GoogleSheetData = {
	title: string
	sheetTitle: string
	timeZone: string
	rows: (string | (string | number)[])[][]
	hiddenColumns: number[]
	hiddenRows: number[]
}

export type GoogleSheet = {
	type: 'sheet'
	documentId: string
} & GoogleSheetData

export type GoogleFormDocument = {
	type: 'form'
	documentId: string
} & ReturnType<typeof adjustGoogleFormData>

export type ResultGoogleForm = Result<GoogleFormDocument, GoogleDocumentError>
export type ResultGoogleSheet = Result<GoogleSheet, GoogleDocumentError>
