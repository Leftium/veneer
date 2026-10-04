import { defineParams } from '@sveltejs/kit/params'
import { VENEER_ID_REGEX } from '#lib/google-document-util/url-id.ts'

function matchTab(value: string) {
	return ['info', 'form', 'list', 'table', 'raw', 'dev'].includes(value)
}

function matchVid(value: string) {
	return VENEER_ID_REGEX.test(value)
}

export const params = defineParams({
	tab: (param) => (matchTab(param) ? param : undefined),
	vid: (param) => (matchVid(param) ? param : undefined),
})
