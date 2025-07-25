import { err, ok } from 'neverthrow'

type MakeNsDocumentDataOptions = {
	idForm?: string
	idSheet?: string
}

export function makeNsDocumentData({ idForm, idSheet }: MakeNsDocumentDataOptions) {
	const form = idForm
		? err(`Id not set for form: ${idForm}`)
		: ok({
				id: idForm,
				status: 'pending',
			})

	const sheet = idSheet
		? err(`Id not set for sheet: ${idSheet}`)
		: ok({
				id: idSheet,
				status: 'pending',
			})

	const nsDocumentData = {
		get form() {
			return form
		},

		get sheet() {
			return sheet
		},
	}

	return nsDocumentData
}
