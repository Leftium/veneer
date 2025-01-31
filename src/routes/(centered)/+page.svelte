<script lang="ts">
	import AutogrowingTextarea from '$lib/components/AutogrowingTextarea.svelte'
	import { gg } from '$lib/gg'

	const namespaces = gg.disable()

	// Force gg output:
	gg.enable('gg:*')

	gg('Hello from +page script tag. (Forced output, even if localStorage.debug/DEBUG not set.)')
	gg()

	// Restore namespaces
	gg.enable(namespaces)
</script>

<AutogrowingTextarea />

<h1>Welcome to SvelteKit</h1>
<p>
	Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation
</p>
