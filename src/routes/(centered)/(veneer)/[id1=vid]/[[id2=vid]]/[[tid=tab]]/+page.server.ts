import { fail, redirect } from '@sveltejs/kit'

export const actions = {
	default: async ({ params, request }) => {
		const formData = await request.formData()

		const documentId = formData.get('documentId')?.toString()

		if (!documentId) {
			return fail(555, {
				status: 555,
				statusText: `No documentId: <${documentId}>`,
			})
		}

		const fetchUrl = `https://docs.google.com/forms/d/e/${documentId.slice(2)}/formResponse`
		const resp = await fetch(fetchUrl, {
			method: 'POST',
			body: formData,
		})

		if (resp.status !== 200) {
			return fail(resp.status, {
				status: resp.status,
				statusText: resp.statusText,
			})
		}

		// on success
		const docPath = params.id2 ? `/${params.id1}/${params.id2}` : `/${params.id1}`
		throw redirect(303, `${docPath}/list?yay`)
	},
}
