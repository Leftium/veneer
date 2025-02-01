<script lang="ts">
	import AutogrowingTextarea from '$lib/components/AutogrowingTextarea.svelte'
	import { gg } from '$lib/gg'
	import { undent } from '$lib/undent'

	let value = $state(undent`
        신청
        https://forms.gle/egp2YUahB5kn7ysNA
        확인
        https://docs.google.com/spreadsheets/d/1Gqv0KjhVGWZrAr-f7TrORxDgn8ODE0N97QPNIHkERcE/edit
    `)

	gg('Hello from +page script tag!)')
	gg()
</script>

<AutogrowingTextarea bind:value />
