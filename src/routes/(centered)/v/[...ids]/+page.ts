export const load = async ({ params }) => {
	// TODO: handle non happy routes like URL or ids pass via URL params.
	const idsSplit = params.ids.split('/')
	const idForm = idsSplit[0]
	const idSheet = idsSplit[1]

	return { idForm, idSheet }
}
