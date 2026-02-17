<script lang="ts">
	import type { Snippet } from 'svelte'
	import { expoInOut } from 'svelte/easing'
	import { slide } from 'svelte/transition'

	interface Props {
		data: any
		gridTemplateColumns: string
		onToggle: (() => void) | void
		resolveToggleIndex?: (clickedIndex: number) => number
		showDetailsAfter?: (rowIndex: number, detailsOpened: number) => boolean
		header: Snippet
		rowSummary: Snippet<
			[{ title: string; isNumeric: boolean }[], string | any[], number, (arg0: number) => void]
		>
		rowDetails: Snippet<[string | any[], number]>
	}

	let {
		data,
		gridTemplateColumns,
		onToggle,
		resolveToggleIndex,
		showDetailsAfter,
		header,
		rowSummary,
		rowDetails,
	}: Props = $props()

	let gridTableElement = $state<HTMLElement>()
	let headerHeight = $derived((gridTableElement?.children[0] as HTMLElement)?.offsetHeight || 0)
	let detailsOpened = $state(-1)

	function makeToggleDetails(index: number) {
		return function () {
			const selection = window.getSelection()
			if (selection && selection.toString().length > 0) {
				// 🛑 User is selecting text — don't toggle
				return
			}

			// ✅ Proceed with toggle
			const resolved = resolveToggleIndex ? resolveToggleIndex(index) : index
			detailsOpened = detailsOpened === resolved ? -1 : resolved
			if (onToggle) {
				onToggle()
			}
		}
	}
</script>

<grid-table
	bind:this={gridTableElement}
	style:--header-height="{headerHeight}px"
	style:grid-template-columns={gridTemplateColumns}
>
	{@render header()}

	{#each data.rows as row, ri}
		{@render rowSummary(data.columns, row, ri, makeToggleDetails)}

		{#if showDetailsAfter?.(ri, detailsOpened) ?? ri === detailsOpened}
			<grid-details
				transition:slide={{ duration: 500, easing: expoInOut }}
				onclick={makeToggleDetails(ri)}
				role="none"
			>
				{@render rowDetails(data.rows[detailsOpened], detailsOpened)}
			</grid-details>
		{/if}
	{/each}
</grid-table>

<style lang="scss">
	@use 'open-props-scss' as *;

	grid-table {
		display: grid;
		// grid-template-columns: as inline style

		border-bottom: 2px solid var(--pico-muted-border-color);
	}

	grid-details {
		z-index: 10;
		grid-column: 1 / -1;

		background-color: var(--pico-card-sectioning-background-color);

		display: flex;
		justify-content: center;

		padding-inline: $size-3;
		box-shadow:
			inset 0 2px 8px 0 rgba(149, 157, 165, 25%),
			inset 0 -0.5px 0 0 #fff,
			inset 0 0.5px 0 0 rgba(0, 0, 0, 0.0666666667);
	}
</style>
