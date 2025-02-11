<script lang="ts">
	import AutogrowingTextarea from '$lib/components/AutogrowingTextarea.svelte'
	import { gg } from '$lib/gg'
	import { GoogleDocument } from '$lib/GoogleDocument.svelte'

	import { undent } from '$lib/undent'
	import { stringify } from '$lib/util'

	import * as linkify from 'linkifyjs'
	import { SvelteMap } from 'svelte/reactivity'

	let value = $state(undent`
        https://forms.gle/yPTfUNW4jRCAjKdp6
        https://docs.google.com/spreadsheets/d/1mJ_jtZuqL40-5-tjl21pw4yQKIH3IBBpqbxxq_HF2k0/edit?resourcekey=&gid=181876389#gid=181876389
    `)

	let linksFromTextarea = $derived(linkify.find(value))

	let linkToGoogleDocument: SvelteMap<string, GoogleDocument> = $state(new SvelteMap())

	let linksFromTextareaEnriched = $derived.by(() => {
		return linksFromTextarea.map((link) => {
			return {
				url: link.href,
				doc: linkToGoogleDocument.get(link.href) || new GoogleDocument(link.href),
			}
		})
	})

	function generateVeneerUrl() {
		let idForm = ''
		let idSheet = ''

		for (const { doc } of linksFromTextareaEnriched) {
			if (!idForm && doc.type === 'form') {
				idForm = doc.idShort || doc.idLong || ''
			}
			if (!idSheet && doc.type === 'sheet') {
				idSheet = doc.idShort || doc.idLong || ''
			}
			if (idSheet && idForm) {
				return `/v/${idForm}/${idSheet}`
			}
		}
		if (idSheet || idForm) {
			return `/v/${idForm}${idSheet}`
		}
		return null
	}

	const urlVeneer = $derived(generateVeneerUrl())

	async function onclick() {
		for (const link of linksFromTextarea) {
			if (!linkToGoogleDocument.get(link.href)) {
				let googleDocument = new GoogleDocument(link.href)
				linkToGoogleDocument.set(link.href, googleDocument)
				googleDocument.fetch()
			}
		}
	}
</script>

<AutogrowingTextarea bind:value />

<dl>
	{#each linksFromTextareaEnriched as { url, doc }}
		<dt><a href={url}>{url}</a></dt>
		<dd><b>idShort:</b> {doc.idShort}</dd>
		<dd><b>idLong:</b> {doc.idLong}</dd>
		<dd><i>type:</i> {doc.type}</dd>
		<dd><i>title:</i> {doc.title}</dd>
		<dd><i>url:</i> {doc.url}</dd>
		<dd><b>text.length:</b> {doc?.text?.length}</dd>
		<dd><b>json.length:</b> {JSON.stringify(doc?.json)?.length}</dd>
	{/each}
</dl>

{#if urlVeneer}
	<div><a href={urlVeneer}>{urlVeneer}</a></div>
{/if}

<button {onclick}>Fetch Text</button>

<pre>linksFromTextareaEnriched = {stringify(linksFromTextareaEnriched)}</pre>
<pre>linkDocumentData = {stringify(Object.fromEntries(linkToGoogleDocument))}</pre>
<pre>linksFromTextarea = {stringify(linksFromTextarea)}</pre>
