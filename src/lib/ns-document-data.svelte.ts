import { getGoogleDocumentId, urlFromDocumentId } from './google-document-util/url-id'
import { getEmitter } from './nation-state/emitter'
import { browser } from '$app/environment'
import { gg } from '@leftium/gg'

import * as linkify from 'linkifyjs'

export type DocumentDataEvents = {
	documentdata_requestedSetIds: {
		idForm?: string
		idSheet?: string
	}
}

const { on, emit } = getEmitter<DocumentDataEvents>(import.meta)

class DocumentState {
	type: 'form' | 'sheet'
	id = $state<string | null>(null)
	status = $state('no.id')
	error = $state<string>()
	text = $state<string>()
	json = $state<unknown>()

	isBusy = $derived(!this.error && this.status.includes('pending'))

	constructor(type: 'form' | 'sheet') {
		this.type = type
	}

	async fetchDocument(needSheetId = false) {
		if (!this.id) {
			return
		}

		this.status = 'pending.google-document-id'
		const googleDocumentId = await getGoogleDocumentId(this.id)
		if (googleDocumentId.isOk()) {
			this.id = googleDocumentId.value
			this.status = 'pending.document'
			if (this?.id) {
				this.status = 'pending.id'
				const urlForm = urlFromDocumentId(this.id)
				const fetched = await fetch(`/api/fetch-document?u=${urlForm}`)
				if (fetched.ok) {
					const jsoned = await fetched.json()
					if (jsoned.type === this.type) {
						this.json = jsoned.json
						this.status = 'ready'

						if (needSheetId && this.type === 'form') {
							gg('Trying to autodetect sheet id.')
							// TODO: Try to set sheet.id based on form contents.

							const formJson = this.json as { fields: Array<{ description: string }> }
							const links = formJson.fields.map((field) => linkify.find(field.description)).flat()

							// Move first link to last place: usually link to form itself.
							const shifted = links.shift()
							if (shifted !== undefined) {
								links.push(shifted)
							}

							for (const link of links) {
								gg(`Trying ${link.href}`)
								const googleDocumentId = await getGoogleDocumentId(link.href)
								if (googleDocumentId.isOk() && googleDocumentId.value[0] === 's') {
									emit('documentdata_requestedSetIds', { idSheet: googleDocumentId.value })
									break
								}
							}
						}
					} else {
						this.error = `Expected Google ${this.type} (${urlForm})`
					}
				} else {
					this.error = `[${fetched.status}: ${fetched.statusText}] while fetching Google ${this.type} (${urlForm})`
				}
			}
		} else {
			this.error = googleDocumentId.error
			this.id = null
		}
	}

	toObject() {
		return {
			type: this.type,
			id: this.id,
			status: this.status,
			error: this.error,
			text: this.text,
			json: this.json,
		}
	}
}

export function makeNsDocumentData() {
	const form = $state<DocumentState>(new DocumentState('form'))

	const sheet = $state<DocumentState>(new DocumentState('sheet'))

	if (browser) {
		on('documentdata_requestedSetIds', async function (params) {
			if (params.idForm && params.idForm !== form.id) {
				form.id = params.idForm
				form.fetchDocument(!params.idSheet)
			}

			if (params.idSheet && params.idSheet !== sheet.id) {
				sheet.id = params.idSheet
				sheet.fetchDocument()
			}
		})
	}

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
