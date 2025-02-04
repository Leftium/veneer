<script lang="ts">
	import { infoFromGoogleUrl } from '$lib/common'
	import AutogrowingTextarea from '$lib/components/AutogrowingTextarea.svelte'

	import { undent } from '$lib/undent'
	import { stringify } from '$lib/util'

	import * as linkify from 'linkifyjs'

	let value = $state(undent`
        신청 : https://forms.gle/7nGG9LPxJerC6SGN9
        확인 : https://docs.google.com/spreadsheets/d/1vfSQYmHLU7Y2nSanbCAOIIgWxBsC_j4__LCpEY0SSIM
    `)

	const links = $derived(linkify.find(value).map((link) => infoFromGoogleUrl(link.href)))

	let jsoned = $state({})

	async function onclick() {
		const searchParams = new URLSearchParams()

		for (const link of links) {
			searchParams.append('u', link.urlCanonical || link.urlFetch)
		}

		const fetched = await fetch(`api/fetch-text?${searchParams}`)
		jsoned = await fetched.json()
	}
</script>

<AutogrowingTextarea bind:value />

<pre>{stringify(links)}</pre>

<dl>
	{#each links as link}
		<dt><a href={link.urlFetch}>{link.urlCanonical || link.urlFetch}</a></dt>
		<dd><b>type:</b> {link.type}</dd>
		<dd><b>id:</b> {link.id}</dd>
	{/each}
</dl>

<button {onclick}>Fetch Text</button>

<pre>{stringify(jsoned)}</pre>
