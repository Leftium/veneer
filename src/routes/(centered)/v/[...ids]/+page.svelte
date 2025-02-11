<script lang="ts">
	import { stringify } from '$lib/util'

	let { data } = $props()
</script>

<pre>{stringify({ data })}</pre>
