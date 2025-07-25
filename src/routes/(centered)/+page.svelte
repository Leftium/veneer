<script lang="ts">
	import AutogrowingTextarea from '$lib/components/AutogrowingTextarea.svelte'
	import { gg } from '@leftium/gg'
	import { GoogleDocument } from '$lib/GoogleDocument.svelte'

	import { undent } from '$lib/tag-functions/undent'
	import { stringify } from '$lib/util'

	import * as linkify from 'linkifyjs'
	import { SvelteMap } from 'svelte/reactivity'
	import { onMount } from 'svelte'
	import { getGoogleDocumentId } from '$lib/google-document-util/url-id'

	import { linkifyRelative, makeTagFunctionMd } from '$lib/tag-functions/markdown.js'
	const md = makeTagFunctionMd({ html: true, linkify: true }, [[linkifyRelative]])

	let value = $state(undent`
        https://docs.google.com/spreadsheets/d/1o5t26He2DzTweYeleXOGiDjlU4Jkx896f95VUHVgS8U/edit?gid=0#gid=0
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
				return `/w/${idForm}/${idSheet}`
			}
		}
		if (idSheet || idForm) {
			return `/w/${idForm}${idSheet}`
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

	let shortUrls = [
		'https://url.kr/o3kyn2',
		'b.3BInfae',
		's.1_bZqtj2UoVjNLm1GRqbAI-QjNSoyOa2veWAfvyhFQQo',
		'b.3BInfa',
		'g.yPTfUNW4jRCAjKdp6',
	]
	let results = $state<any>([])

	onMount(async function () {
		results = await Promise.all(
			shortUrls.map((url) => {
				return getGoogleDocumentId(url)
			}),
		)
	})
</script>

{@html md`
	- /v/g.tBMa9PThhCkkF72X9/s.1Q2BHPjrGeFOsytRjzhMXuQ-z7Bw_4xwBlKNshVymI34
	- /v/g.tBMa9PThhCkkF72X9
	- /v/g.yPTfUNW4jRCAjKdp6/s.1_bZqtj2UoVjNLm1GRqbAI-QjNSoyOa2veWAfvyhFQQo
	- /v/g.yPTfUNW4jRCAjKdp6
	- /v/f.1FAIpQLSeqSly5eKwlyxLGh4SQQmWobxfSrBxGAXoNL9XUrSw_J2Q9sQ
	- /v/s.1_bZqtj2UoVjNLm1GRqbAI-QjNSoyOa2veWAfvyhFQQo
`}

<hr />

<pre>{JSON.stringify(results, null, 4)}</pre>
<hr />

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
