<script lang="ts">
	import { stringify } from '$lib/util'

	import Sheet from './Sheet.svelte'

	let { data } = $props()

	const googleForm = data.indexForm !== undefined ? data.googleDocuments[data.indexForm] : undefined
	const googleSheet =
		data.indexSheet !== undefined ? data.googleDocuments[data.indexSheet] : undefined

	let headerElement: HTMLElement | undefined = $state()
	let headerHeight: number = $state(0)
</script>

<svelte:head>
	{#if googleSheet}
		<title>{googleSheet.json?.title}</title>
	{/if}
</svelte:head>

<div class="wrap">
	<header bind:this={headerElement} bind:clientHeight={headerHeight}>
		{#if googleSheet}
			<h1>{googleSheet.json?.title}</h1>
		{/if}
		<div role="group">
			<button class="outline">✍ Form</button>
			<button class="outline">📋 Responses</button>
		</div>
	</header>

	<Sheet doc={googleSheet} bind:top={headerHeight}></Sheet>

	<pre hidden>{stringify(data)}</pre>
</div>

<style lang="scss">
	@use 'open-props-scss' as *;

	div.wrap {
		display: block;
		overflow-x: clip;
	}

	header {
		position: sticky;
		top: 0px;
		z-index: 1000;

		left: 0.5rem;
		right: 0.5rem;

		padding: $size-2;

		background: var(--pico-background-color);
		_background: green;

		& > div {
			margin-bottom: 0;
		}
	}
</style>
