import type { adjustGoogleFormData } from '$lib/google-document-util/google-form'

export type GoogleDocumentError = {
	message: string
	documentId?: string
	type?: 'form' | 'sheet'
}

export type GoogleSheetData = {
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
