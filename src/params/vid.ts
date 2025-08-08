import { VENEER_ID_REGEX } from '$lib/google-document-util/url-id'

export function match(value) {
	return VENEER_ID_REGEX.test(value)
}
