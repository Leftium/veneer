import type { adjustGoogleFormData } from '$lib/google-document-util/google-form'
import type { Result } from 'wellcrafted/result'

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
	veneerId: string | null
} & GoogleSheetData

export type GoogleFormDocument = {
	type: 'form'
	documentId: string
	veneerId: string | null
} & ReturnType<typeof adjustGoogleFormData>

export type ResultGoogleForm = Result<GoogleFormDocument, GoogleDocumentError>
export type ResultGoogleSheet = Result<GoogleSheet, GoogleDocumentError>
