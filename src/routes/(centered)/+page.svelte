<script lang="ts">
	import AutogrowingTextarea from '$lib/components/AutogrowingTextarea.svelte'
	import { gg } from '$lib/gg'
	import { undent } from '$lib/undent'

	import * as linkify from 'linkifyjs'

	let value = $state(undent`
        신청
        https://forms.gle/egp2YUahB5kn7ysNA
        확인
        https://docs.google.com/spreadsheets/d/1Gqv0KjhVGWZrAr-f7TrORxDgn8ODE0N97QPNIHkERcE
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
