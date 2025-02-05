<script lang="ts">
	import { infoFromGoogleUrl } from '$lib/common'
	import AutogrowingTextarea from '$lib/components/AutogrowingTextarea.svelte'
	import { gg } from '$lib/gg'

	import { undent } from '$lib/undent'
	import { stringify } from '$lib/util'

	import * as linkify from 'linkifyjs'

	let value = $state(undent`
        ✍신청: https://shorturl.at/2q3PU
        📋확인: https://shorturl.at/lTT5D

        신청 : https://forms.gle/7nGG9LPxJerC6SGN9
        확인 : https://docs.google.com/spreadsheets/d/1vfSQYmHLU7Y2nSanbCAOIIgWxBsC_j4__LCpEY0SSIM
    `)

	// svelte-ignore state_referenced_locally
	let links = $state(linkify.find(value).map((link) => infoFromGoogleUrl(link.href)))

	type Links = typeof links
	function generateVeneerUrl(links: Links) {
		let idFirstForm = ''
		let idFirstSheet = ''

		for (const { type, id } of links) {
			if (!idFirstForm && type === 'form') {
				idFirstForm = id
			}

			if (!idFirstSheet && type === 'sheet') {
				idFirstSheet = id
			}

			if (idFirstForm && idFirstSheet) {
				return `/v/${idFirstForm}/${idFirstSheet}`
			}
		}

		if (idFirstForm || idFirstSheet) {
			return `/v/${idFirstForm}${idFirstSheet}`
		}

		return null
	}

	const urlVeneer = $derived(generateVeneerUrl(links))

	async function onclick() {
		const searchParams = new URLSearchParams()

		for (const link of links) {
			searchParams.append('u', link.urlCanonical || link.urlFetch)
		}

		const fetched = await fetch(`api/fetch-text?${searchParams}`)
		links = await fetched.json()
	}

	function oninput() {
		const newLinks = linkify.find(value).map((link) => infoFromGoogleUrl(link.href))
		links = newLinks
	}
</script>

<AutogrowingTextarea bind:value {oninput} />

<dl>
	{#each links as link}
		<dt><a href={link.urlFetch}>{link.urlCanonical || link.urlFetch}</a></dt>
		<dd><b>type:</b> {link.type}</dd>
		<dd><b>id:</b> {link.id}</dd>
	{/each}
</dl>

{#if urlVeneer}
	<div><a href={urlVeneer}>{urlVeneer}</a></div>
{/if}

<button {onclick}>Fetch Text</button>

<pre>{stringify(links)}</pre>
