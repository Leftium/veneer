<script lang="ts">
	import GoogleFormField from './GoogleFormField.svelte'
	import { onDestroy, onMount } from 'svelte'

	let { data, form } = $props()
</script>

<main class="container">
	{#if form?.success || form?.status}
		<article>
			{#if form?.success}
				<div class="success">Successfully signed up! 신청 성공!</div>
			{:else if form?.status}
				<div class="error">Sorry! There was an error. 오류:</div>
				{form.status}: {form.statusText}
			{/if}
		</article>
	{/if}

	<form method="POST">
		<input type="hidden" name="formUrl" value={data.formJson?.formUrl} />
		<input type="hidden" name="formAction" value={data.formJson?.formAction} />

		{#each data.formJson?.fields || [] as field}
			{#if data.formJson?.hasInput && data.formJson?.hasRequired && field.inputIndex === 1}
				<span class="required-mark">* Required 필수항목</span>
			{/if}

			<GoogleFormField {field} />
		{/each}

		{#if data.formJson?.hasInput}
			<input type="submit" value="Sign up 신청" />
		{/if}
	</form>

	<center><a href={data.formJson?.formUrl}>Go to original Google form</a></center>

	<div hidden>
		<hr />
		<pre>{JSON.stringify(data.formJson, null, 4)}</pre>
	</div>
</main>

<style lang="scss">
	article {
		margin-top: 1em;
		text-align: center;
	}

	:global(body) {
		overflow-x: hidden;
	}

	main {
		padding-top: 1em;
		max-width: 40ch;
	}

	main :global(h1),
	main :global(h6) {
		margin-top: 0em;
		margin-bottom: 0em;
	}

	main :global(h1 a:first-child:last-child),
	main :global(h2),
	main :global(h6 a:first-child:last-child) {
		display: block;
		text-align: center;
	}

	main :global(td) {
		vertical-align: top;
	}

	main :global(td:first-child p),
	main :global(td:first-child) {
		min-width: 2em;
		font-weight: bold;
		text-wrap: nowrap;
	}

	main :global(ul) {
		padding-left: 0px;
		margin-bottom: 0.2em;
	}

	main :global(ul a),
	main :global(td p) {
		margin-bottom: 0.2em;
	}

	main :global(li) {
		font-family: Lato, sans-serif;
	}

	main :global(.simpleParallax) {
		width: 100svw;
		aspect-ratio: 16 / 9;

		max-width: min(100svw, 1450px);
		max-height: 35svh;

		margin-left: -50svw;
		margin-right: -50svw;

		object-fit: cover;
	}

	@media (min-width: 576px) {
		main :global(.simpleParallax) {
			max-width: min(100svw, 510px);
		}
	}

	@media (min-width: 768px) {
		main :global(.simpleParallax) {
			max-width: min(100svw, 700px);
		}
	}

	@media (min-width: 1024px) {
		main :global(.simpleParallax) {
			max-width: min(100svw, 950px);
		}
	}

	@media (min-width: 1280px) {
		main :global(.simpleParallax) {
			max-width: min(100svw, 1200px);
		}
	}

	@media (min-width: 1536px) {
		main :global(.simpleParallax) {
			max-width: min(100svw, 1450px);
		}
	}

	.success {
		color: green;
		font-weight: bold;
	}

	.error {
		color: red;
		font-weight: bold;
	}

	.required-mark {
		color: red;
	}
</style>
