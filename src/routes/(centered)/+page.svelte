<script lang="ts">
	import AutogrowingTextarea from '$lib/components/AutogrowingTextarea.svelte'
	import { gg } from '$lib/gg'

	gg('Hello from +page script tag!)')
	gg()
</script>

<AutogrowingTextarea />
