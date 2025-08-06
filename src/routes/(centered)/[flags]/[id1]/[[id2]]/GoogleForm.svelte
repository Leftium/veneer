<script lang="ts">
	import type { GoogleFormDocument } from '$lib/google-document-util/types'
	import { m } from '$lib/paraglide/messages'

	import GoogleFormField from './GoogleFormField.svelte'

	interface Props {
		googleForm: GoogleFormDocument
		data?: any
		oldForm?: any
	}

	let { googleForm, data, oldForm }: Props = $props()
</script>

<main class="container">
	{#if oldForm?.success || oldForm?.status}
		<article>
			{#if oldForm?.success}
				<div class="success">Successfully signed up! 신청 성공!</div>
			{:else if oldForm?.status}
				<div class="error">Sorry! There was an error. 오류:</div>
				{oldForm.status}: {oldForm.statusText}
			{/if}
		</article>
	{/if}

	<form method="POST">
		<input type="hidden" name="documentId" value={googleForm.documentId} />

		{#each googleForm.fields || [] as field}
			{#if googleForm.hasRequired && field.inputIndex === 1}
				<span class="required-mark">* {m.required()}</span>
			{/if}

			<GoogleFormField {field} />
		{/each}

		{#if googleForm.firstInput !== -1}
			<input type="submit" value={m.submit()} />
		{/if}
	</form>

	<div hidden>
		<hr />
		<pre>{JSON.stringify(googleForm, null, 4)}</pre>
	</div>
</main>

<style lang="scss">
	@use 'open-props-scss' as *;

	main {
		padding-top: $size-2;
	}

	.required-mark {
		color: $red-7;
	}

	input[type='submit'] {
		font-size: $font-size-2;
		font-weight: $font-weight-7;
	}
</style>
