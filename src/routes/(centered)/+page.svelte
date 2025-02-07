<script lang="ts">
	import { DocumentId, type DocumentScan } from '$lib/common'
	import AutogrowingTextarea from '$lib/components/AutogrowingTextarea.svelte'
	import { gg } from '$lib/gg'

	import { undent } from '$lib/undent'
	import { stringify } from '$lib/util'

	import * as linkify from 'linkifyjs'
	import { SvelteMap } from 'svelte/reactivity'

	let value = $state(undent`
        신청 링크 : https://bit.ly/3MNmqm3
        확인 링크 : https://bit.ly/3XMqA3N

        ✍신청: https://shorturl.at/2q3PU
        📋확인: https://shorturl.at/lTT5D

        신청 : https://forms.gle/7nGG9LPxJerC6SGN9
        확인 : https://docs.google.com/spreadsheets/d/1vfSQYmHLU7Y2nSanbCAOIIgWxBsC_j4__LCpEY0SSIM
    `)

	let linksFromTextarea = $derived(linkify.find(value).map((link) => new DocumentId(link.href)))

	let linkDocumentData: SvelteMap<string, DocumentScan> = $state(new SvelteMap())

	let linksFromTextareaEnriched = $derived.by(() => {
		return linksFromTextarea.map((link) => {
			const documentScan = linkDocumentData.get(link.id)

			return {
				...link,
				...{ ...documentScan },
			}
		})
	})

	type LinkDocumentData = typeof linkDocumentData
	function generateVeneerUrl(links: LinkDocumentData) {
		return null
	}

	const urlVeneer = $derived(generateVeneerUrl(linkDocumentData))

	async function onclick() {
		for (const link of linksFromTextarea) {
			let documentScan: DocumentScan = new DocumentId(link.url)
			if (documentScan.id && !linkDocumentData.has(documentScan.id)) {
				documentScan.scan = 'scanning'
				linkDocumentData.set(documentScan.id, documentScan)

				const fetched = await fetch(`api/fetch-text?u=${link.url}`)
				documentScan = await fetched.json()
				documentScan.scan = 'quick scanned'
				linkDocumentData.set(documentScan.id, documentScan)
			}
		}
	}
</script>

<AutogrowingTextarea bind:value />

<dl>
	{#each linksFromTextareaEnriched as link}
		<dt><a href={link.url}>{link.url}</a></dt>
		<dd><b>id:</b> {link.id}</dd>
		<dd><b>scan:</b> {link.scan}</dd>
		<dd><b>status:</b> {link.status}</dd>
		{#if link.idForm}<dd><b>idForm:</b> {link.idForm}</dd>{/if}
		{#if link.idSheet}<dd><b>idSheet:</b> {link.idSheet}</dd>{/if}
	{/each}
</dl>

{#if urlVeneer}
	<div><a href={urlVeneer}>{urlVeneer}</a></div>
{/if}

<button {onclick}>Fetch Text</button>

<pre>linksFromTextareaEnriched = {stringify(linksFromTextareaEnriched)}</pre>
<pre>linkDocumentData = {stringify(Object.fromEntries(linkDocumentData))}</pre>
<pre>linksFromTextarea = {stringify(linksFromTextarea)}</pre>
