import { dev } from '$app/environment'
import { fail, redirect } from '@sveltejs/kit'
import { PRESETS, resolvePresetName } from '$lib/presets'

export const actions = {
	default: async ({ params, request, url }) => {
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

		// on success — use short URLs when on domain's default docs
		const hostname = ((dev && url.searchParams.get('hostname')) || url.hostname).replace(
			/^www\./,
			'',
		)
		const presetName = url.searchParams.get('preset') || resolvePresetName(hostname) || 'base'
		const preset = PRESETS[presetName] || PRESETS['base']
		const usingDefaultDocs =
			!!preset.defaultFormId &&
			params.id1 === preset.defaultFormId &&
			(params.id2 === preset.defaultSheetId || (!params.id2 && !preset.defaultSheetId))
		const docPath = usingDefaultDocs
			? ''
			: params.id2
				? `/${params.id1}/${params.id2}`
				: `/${params.id1}`
		// Preserve search params (e.g. ?hostname=, ?preset=) and add ?yay
		const redirectParams = new URLSearchParams(url.search)
		redirectParams.delete('yay')
		const extra = redirectParams.toString()
		throw redirect(303, `${docPath}/list?yay${extra ? `&${extra}` : ''}`)
	},
}
