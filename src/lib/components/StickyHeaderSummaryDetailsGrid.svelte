<script lang="ts">
	import type { Snippet } from 'svelte'
	import { expoInOut } from 'svelte/easing'
	import { slide } from 'svelte/transition'

	interface Props {
		data: any
		gridTemplateColumns: string
		onToggle: (() => void) | void
		header: Snippet
		rowSummary: Snippet<
			[{ title: string; isNumeric: boolean }[], string | any[], number, (arg0: number) => void]
		>
		rowDetails: Snippet<[string | any[], number]>
	}

	let { data, gridTemplateColumns, onToggle, header, rowSummary, rowDetails }: Props = $props()

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
			detailsOpened = detailsOpened === index ? -1 : index
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

		{#if ri === detailsOpened}
			<grid-details
				transition:slide={{ duration: 500, easing: expoInOut }}
				onclick={makeToggleDetails(ri)}
				role="none"
			>
				{@render rowDetails(row, ri)}
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
		box-shadow: shadow('inner-3');
	}
</style>
