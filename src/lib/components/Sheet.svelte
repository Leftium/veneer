<script lang="ts">
	import dayjs from 'dayjs'
	import relativeTime from 'dayjs/plugin/relativeTime'
	import isBetween from 'dayjs/plugin/isBetween'
	import utc from 'dayjs/plugin/utc'

	dayjs.extend(relativeTime)
	dayjs.extend(isBetween)
	dayjs.extend(utc)

	import { stringify } from '$lib/util'

	import StickyHeaderGrid from '$lib/components/StickyHeaderSummaryDetailsGrid.svelte'
	import { REGEX_DANCE_LEADER, REGEX_DANCE_FOLLOW } from '$lib/dance-constants'

	interface Props {
		data: any
		onToggle?: () => void
	}

	let { data, onToggle }: Props = $props()

	let extra = $derived(data.extra)
	let columns = $derived(data.columns)
	let rows = $derived(data.rows)
</script>

{#snippet rowDetails(row: string | any[], _r: any)}
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

<div class={extra.type}>
	{#if !extra.type}
		{@const gridTemplateColumns = `auto repeat(${columns.length - 1}, minmax(120px, 1fr))`}
		<StickyHeaderGrid {gridTemplateColumns} data={{ columns, rows }} {onToggle} {rowDetails}>
			{#snippet header()}
				{#each columns as column (column.title)}
					<gh>{column.title}</gh>
				{/each}
			{/snippet}

			{#snippet rowSummary(columns, row, r, makeToggleDetails)}
				{#each columns as { isNumeric }, c (c)}
					{@const render = row[c]?.render || ''}
					<gd class={{ numeric: isNumeric }} onclick={makeToggleDetails(r)} role="none">
						{@html isNumeric ? render.replace(/^0*/, '<gz>$&</gz>') : render}
					</gd>
				{/each}
			{/snippet}
		</StickyHeaderGrid>
	{:else if extra.type === 'dance-event'}
		<StickyHeaderGrid gridTemplateColumns="1fr" data={{ columns, rows }} {onToggle} {rowDetails}>
			{#snippet header()}
				{@const count = extra.count}
				<gh>
					<span>{count.total}명 신청</span>
					<span>💃{count.follows} 🕺{count.leaders}</span>
				</gh>
			{/snippet}

			{#snippet rowSummary(_columns, row, r, makeToggleDetails)}
				{@const ci = extra.ci}
				{@const groupIndex = (row as any)._groupIndex ?? -1}
				{@const isGroupMember = (row as any)._isGroupMember === true}
				<gd
					class={{
						'group-alt': groupIndex % 2 === 1,
						'group-member': isGroupMember,
					}}
					onclick={makeToggleDetails(r)}
					role="none"
				>
					<content>
						<fi-index>
							<div>{@html row[0].render.replace(/^0*/, '<gz>$&</gz>')}.</div>
							<div>{row[ci.paid]?.render ? '💰' : ''}</div>
						</fi-index>
						<fi-role
							>{REGEX_DANCE_LEADER.test(row[ci.role]?.render)
								? '🕺'
								: REGEX_DANCE_FOLLOW.test(row[ci.role]?.render)
									? '💃'
									: '❓'}
						</fi-role>
						<fi-info>
							<h4>{row[ci.name]?.render}</h4>
							{#if !isGroupMember}
								<div>{row[ci.wish]?.render}</div>
							{/if}
						</fi-info>
					</content>
				</gd>
			{/snippet}
		</StickyHeaderGrid>
	{/if}
</div>

<div hidden>
	<pre>columns = {stringify(columns)}</pre>
	<pre>rows    = {stringify(rows)}</pre>
</div>

<style lang="scss">
	@use 'open-props-scss' as *;

	gh,
	gd {
		padding: $size-2 $size-2;

		&:global(.numeric) {
			font-family: Lato, Helvetica, sans-serif;
			font-feature-settings: 'tnum';
			font-variant-numeric: tabular-nums;
		}

		// Ghost zero: takes up space for alignment but cannot be seen/selected.
		:global(gz) {
			opacity: 0;
			user-select: none;
		}
	}

	gh {
		position: sticky;
		z-index: 100;
		// At most 2 lines of header will become sticky:
		top: calc(min(0px, 2 * 1.5em + var(--app-spacing) / 2 - var(--header-height)));
		background-color: var(--app-card-section-bg);

		// Align items to bottom
		display: flex;
		align-items: flex-end;

		padding-bottom: $size-1;

		font-weight: $font-weight-7;

		border: 2px solid var(--app-muted-border-color);
		border-inline: none;
	}

	gd {
		display: block;
		white-space: nowrap;
		overflow: clip;
		text-overflow: ellipsis;

		border-top: 1px solid var(--app-muted-border-color);
	}

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

	.dance-event {
		gh {
			grid-column: 1 / -1;
			display: flex;
			flex-wrap: wrap;
			column-gap: 1rem;

			justify-content: center;
			font-size: 188%;
		}

		gd {
			grid-column: 1 / -1;

			&.group-alt {
				background-color: rgba(128, 128, 128, 0.06);
			}

			&.group-member {
				border-top-color: transparent;
			}

			content {
				display: flex;
				column-gap: $size-2;

				margin: auto;

				max-width: $size-content-3;

				fi-index {
					opacity: 0.5;
					text-align: right;
				}

				fi-role {
					font-size: $font-size-6;
				}

				fi-info {
					flex-shrink: 1;

					white-space: wrap;

					h4 {
						margin-bottom: $size-1;
					}

					div {
						opacity: 0.5;
					}
				}
			}
		}
	}
</style>
