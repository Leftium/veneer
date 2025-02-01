<script lang="ts">
	import AutogrowingTextarea from '$lib/components/AutogrowingTextarea.svelte'
	import { gg } from '$lib/gg'
	import { undent } from '$lib/undent'
	import { stringify } from '$lib/util'

	import * as linkify from 'linkifyjs'

	let value = $state(undent`
        신청 : https://forms.gle/7nGG9LPxJerC6SGN9
        확인 : https://docs.google.com/spreadsheets/d/1vfSQYmHLU7Y2nSanbCAOIIgWxBsC_j4__LCpEY0SSIM
    `)

	const links = $derived(linkify.find(value))

	let jsoned = $state({})

	async function onclick() {
		const searchParams = new URLSearchParams()

		for (const link of links) {
			searchParams.append('u', link.href)
		}

		const fetched = await fetch(`api/fetch-text?${searchParams}`)
		jsoned = await fetched.json()
	}
</script>

<AutogrowingTextarea bind:value />

<pre>{stringify(links)}</pre>

{#each links as link, index}
	<div><a href={link.href}>{link.href}</a></div>
{/each}

<button {onclick}>Fetch Text</button>

<pre>{stringify(jsoned)}</pre>
