<script lang="ts">
	import dayjs from 'dayjs'
	import relativeTime from 'dayjs/plugin/relativeTime'
	import utc from 'dayjs/plugin/utc'

	dayjs.extend(relativeTime)
	dayjs.extend(utc)

	import SheetTable from './SheetTable.svelte'
	import DanceEventList from './DanceEventList.svelte'
	import PlaylistList from './PlaylistList.svelte'

	interface Props {
		data: any
		title?: string
		forceTable?: boolean
	}

	let { data, title = '', forceTable = false }: Props = $props()

	let columns = $derived(data.columns)
	let rows = $derived(data.rows)
</script>

{#snippet rowDetails(_row: string | any[], r: any)}
	{@const row = rows[r]}
	{@const skippedColumns = 1}
	<dl>
		{#each row.slice(skippedColumns) as cell, ci (ci)}
			<dt>{columns[ci + skippedColumns]?.title}</dt>
			<dd>
				{cell.value}
				{#if cell.ts}({dayjs().utc().to(cell.ts)}){/if}
			</dd>
		{/each}
	</dl>
{/snippet}

{#if forceTable || !data.extra?.type}
	<SheetTable {data} {rowDetails} />
{:else if data.extra.type === 'dance-event'}
	<DanceEventList {data} {title} {rowDetails} />
{:else if data.extra.type === 'playlist'}
	<PlaylistList {data} {rowDetails} />
{/if}

<style lang="scss">
	@use 'open-props-scss' as *;

	/* Styles for the rowDetails snippet (rendered inside sub-components via StickyHeaderGrid) */
	dl {
		display: grid;

		flex-basis: $size-content-3;
		flex-shrink: 1;

		dt {
			margin-top: $size-2;
			font-weight: bold;
			opacity: 15%;
		}

		dd {
			margin-left: 0;
		}
	}
</style>
