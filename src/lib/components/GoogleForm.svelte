<script lang="ts">
	import type { GoogleFormDocument } from '$lib/google-document-util/types'
	import { m } from '$lib/paraglide/messages'

	import GoogleFormField from './GoogleFormField.svelte'
	import GroupRegistration from './GroupRegistration.svelte'
	import {
		detectGroupRegistration,
		type GroupRegistrationMatch,
	} from '$lib/group-registration/detect'
	import type { Question } from '$lib'

	interface Props {
		googleForm: GoogleFormDocument
		data?: any
		oldForm?: any
	}

	let { googleForm, data, oldForm }: Props = $props()

	// Build a render plan: sequence of items to render (individual fields or group widgets).
	// Group registration triples are collapsed into a single { type: 'group', match } entry.
	type RenderItem =
		| { kind: 'field'; field: Question }
		| { kind: 'group'; match: GroupRegistrationMatch }

	const renderPlan: RenderItem[] = $derived.by(() => {
		const fields = googleForm.fields || []
		const matches = detectGroupRegistration(fields)

		// Build a set of field indices that are consumed by group registration
		const consumed = new Set<number>()
		for (const match of matches) {
			consumed.add(match.startIndex)
			consumed.add(match.startIndex + 1)
			consumed.add(match.startIndex + 2)
		}

		const plan: RenderItem[] = []
		for (let i = 0; i < fields.length; i++) {
			if (consumed.has(i)) {
				// If this is the start of a group match, emit the group item
				const match = matches.find((m) => m.startIndex === i)
				if (match) {
					plan.push({ kind: 'group', match })
				}
				// Otherwise it's a consumed field (index +1 or +2), skip it
			} else {
				plan.push({ kind: 'field', field: fields[i] })
			}
		}
		return plan
	})
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

		{#each renderPlan as item, i (i)}
			{#if item.kind === 'field'}
				{#if googleForm.hasRequired && item.field.inputIndex === 1}
					<span class="required-mark">* {m.required()}</span>
				{/if}
				<GoogleFormField field={item.field} />
			{:else if item.kind === 'group'}
				{#if googleForm.hasRequired && item.match.nameField.inputIndex === 1}
					<span class="required-mark">* {m.required()}</span>
				{/if}
				<GroupRegistration match={item.match} />
			{/if}
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
