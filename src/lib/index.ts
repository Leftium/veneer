// place files you want to import through the `$lib` alias in this folder.

export type QuestionType =
	| 'TEXT'
	| 'PARAGRAPH_TEXT'
	| 'MULTIPLE_CHOICE'
	| 'CHECKBOXES'
	| 'DROPDOWN'
	| 'DATE'
	| 'TIME'
	| 'SCALE'
	| 'TITLE_AND_DESCRIPTION'
	| 'GRID'
	| 'PAGE_BREAK'
	| 'FILE_UPLOAD'
	| 'IMAGE'
	| 'VIDEO'

export interface Question {
	itemId: number
	title: string
	titleHtml?: string
	description: string | null
	descriptionHtml?: string | null
	type: QuestionType
	options: string[]
	required: boolean
	id: string
	imageId?: string
	youtubeId?: string
	mediaWidth?: number
	mediaHeight?: number
	imgUrl?: string
	mediaMetaData?: unknown
	field?: unknown
	inputIndex?: number
}
