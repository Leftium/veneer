<script lang="ts">
	import { stringify } from '$lib/util'

	let { params, data } = $props()

	const visibleTabs = data.visibleTabs
</script>

<pre>{stringify(params)}</pre>
<pre>{stringify(visibleTabs)}</pre>
