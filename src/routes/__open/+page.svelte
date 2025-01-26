<script lang="ts">
	import { browser } from '$app/environment'

	let { data } = $props()

	if (browser) {
		window.close()
	}
</script>

<a href={data.fetchUrl}>{data.fetchUrl}</a>
