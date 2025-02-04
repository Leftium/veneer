<script lang="ts">
	import { stringify } from '$lib/util'

	let { data } = $props()

	// Length of sheetId is length 44; formId is 56 or ~18.
	function assignIds([id1, id2]: (string | undefined)[]) {
		let idForm = ''
		let idSheet = ''

		if (id1) {
			if (id1.length == 44) {
				idSheet = id1
				if (id2 && id2.length != 44) {
					idForm = id2
				}
			} else {
				idForm = id1
				if (id2 && id2.length == 44) {
					idSheet = id2
				}
			}
		}
		return { idForm, idSheet }
	}

	let { idForm, idSheet } = $state(assignIds(data.params.ids.split('/')))
</script>

<pre>{stringify({ 'params.ids': data.params.ids, idForm, idSheet })}</pre>
