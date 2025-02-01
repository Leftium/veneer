<script lang="ts">
	import AutogrowingTextarea from '$lib/components/AutogrowingTextarea.svelte'
	import { gg } from '$lib/gg'
	import { undent } from '$lib/undent'

	import * as linkify from 'linkifyjs'

	let value = $state(undent`
        신청 : https://forms.gle/7nGG9LPxJerC6SGN9
        확인 : https://docs.google.com/spreadsheets/d/1vfSQYmHLU7Y2nSanbCAOIIgWxBsC_j4__LCpEY0SSIM
    `)

	const links = $derived(linkify.find(value))

	gg('Hello from +page script tag!)')
	gg()
</script>

<AutogrowingTextarea bind:value />

{#each links as link}
	<div><a href={link.href}>{link.href}</a></div>
{/each}

<pre>{JSON.stringify(links, null, 4)}</pre>
