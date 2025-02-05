<script lang="ts">
	import { DocumentId } from '$lib/common'
	import AutogrowingTextarea from '$lib/components/AutogrowingTextarea.svelte'
	import { gg } from '$lib/gg'

	import { undent } from '$lib/undent'
	import { stringify } from '$lib/util'

	import * as linkify from 'linkifyjs'

	let value = $state(undent`
        신청 링크 : https://bit.ly/3MNmqm3
        확인 링크 : https://bit.ly/3XMqA3N

        ✍신청: https://shorturl.at/2q3PU
        📋확인: https://shorturl.at/lTT5D

        신청 : https://forms.gle/7nGG9LPxJerC6SGN9
        확인 : https://docs.google.com/spreadsheets/d/1vfSQYmHLU7Y2nSanbCAOIIgWxBsC_j4__LCpEY0SSIM
    `)

	// svelte-ignore state_referenced_locally
	let linkDocumentData = $state(linkify.find(value).map((link) => new DocumentId(link.href)))

	type LinkDocumentData = typeof linkDocumentData
	function generateVeneerUrl(links: LinkDocumentData) {
		let idFirstForm = ''
		let idFirstSheet = ''

		for (const { id, idForm, idSheet } of links) {
			if (!idFirstForm && idForm) {
				idFirstForm = id
			}

			if (!idFirstSheet && idSheet) {
				idFirstSheet = id
			}

			if (idFirstForm && idFirstSheet) {
				if (idFirstForm === idFirstSheet) {
					return `/v/${idFirstForm}`
				}
				return `/v/${idFirstForm}/${idFirstSheet}`
			}
		}

		if (idFirstForm || idFirstSheet) {
			return `/v/${idFirstForm}${idFirstSheet}`
		}

		return null
	}

	const urlVeneer = $derived(generateVeneerUrl(linkDocumentData))

	async function onclick() {
		const searchParams = new URLSearchParams()

		for (const link of linkDocumentData) {
			searchParams.append('u', link.url)
		}

		const fetched = await fetch(`api/fetch-text?${searchParams}`)
		linkDocumentData = await fetched.json()
	}

	function oninput() {
		const newLinks = linkify.find(value).map((link) => new DocumentId(link.href))
		linkDocumentData = newLinks
	}
</script>

<AutogrowingTextarea bind:value {oninput} />

<dl>
	{#each linkDocumentData as link}
		<dt><a href={link.url}>{link.url}</a></dt>
		<dd><b>id:</b> {link.id}</dd>
		{#if link.idForm}<dd><b>idForm:</b> {link.idForm}</dd>{/if}
		{#if link.idSheet}<dd><b>idSheet:</b> {link.idSheet}</dd>{/if}
	{/each}
</dl>

{#if urlVeneer}
	<div><a href={urlVeneer}>{urlVeneer}</a></div>
{/if}

<button {onclick}>Fetch Text</button>

<pre>idToFetchedInfo = {stringify(linkDocumentData)}</pre>
