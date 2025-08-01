<script lang="ts">
	import dayjs from 'dayjs'
	import relativeTime from 'dayjs/plugin/relativeTime'
	import isBetween from 'dayjs/plugin/isBetween'
	import utc from 'dayjs/plugin/utc'

	dayjs.extend(relativeTime)
	dayjs.extend(isBetween)
	dayjs.extend(utc)

	import { gg } from '@leftium/gg'
	import { stringify } from '$lib/util'

	import type { GoogleSheet } from '$lib/google-document-util/types'
	import { expoInOut } from 'svelte/easing'
	import { slide } from 'svelte/transition'

	interface Props {
		googleSheet: GoogleSheet
		onToggle?: () => void
	}

	let { googleSheet, onToggle }: Props = $props()

	let detailsOpened = $state(-1)

	let gridTableElement = $state<HTMLElement>()
	let headerHeight = $derived((gridTableElement?.children[0] as HTMLElement).offsetHeight)

	function makeToggleDetails(index: number) {
		return function () {
			detailsOpened = detailsOpened === index ? -1 : index
			if (onToggle) {
				onToggle()
			}
		}
	}

	const numericRegex = /^[0-9-.,/: ]*$/
	const { type, columns, rows } = $derived.by(() => {
		let type = 'regular'
		const sheetJson = googleSheet
		if (sheetJson.rows) {
			let rows = [...sheetJson.rows]

			// Skip extraneous rows without timestamps.
			// Adjust title row if extra columns are found.
			while (false && !rows[1][0]) {
				rows[0] = Array(Math.max(rows[0].length, rows[1].length))
					.fill(1)
					.map((_, index) => rows[1][index] || rows[0][index])
				rows.splice(1, 1)
			}

			// Remove empty rows:
			rows = rows.filter((row) => row.join(''))

			// Add index column:
			rows = rows.map((row, indexRow) => [indexRow ? `${indexRow}` : '', ...row])

			// Gather column info:
			let columns = rows[0].map((cell) => ({
				title: cell as string,
				type: 'numeric',
				lengthMin: Number.MAX_SAFE_INTEGER,
				lengthMax: 0,
			}))

			rows.shift() // Remove title row

			for (let row of rows) {
				for (let [indexCol, cell] of row.entries()) {
					const valueString = (Array.isArray(cell) ? cell[0] : cell) as string
					const column = columns[indexCol]
					if (column) {
						column.lengthMax = Math.max(column.lengthMax, valueString.length)
						column.lengthMin = Math.min(column.lengthMin, valueString.length)
						if (!numericRegex.test(valueString)) {
							column.type = 'string'
						}
					}
				}
			}

			// Remove empty columns:
			rows = rows.map((row) => {
				return row.filter((cell, indexColumn) => columns[indexColumn]?.lengthMax !== 0)
			})
			columns = columns.filter((cell) => cell?.lengthMax !== 0)

			// Detect special types
			if (
				columns.filter(({ title }) => /(name)|(닉네임)/i.test(title)).length &&
				columns.filter(({ title }) => /(role|(역할)|(리드)|팔로우)/i.test(title)).length
			) {
				type = 'dance-event'
			} else if (
				columns.filter(({ title }) => /주소/i.test(title)).length &&
				columns.filter(({ title }) => /면적/i.test(title)).length
			) {
				type = 'real-estate'
			}

			const rowsRender = rows.map((row) => {
				return row.map((cell, indexColumn) => {
					const column = columns[indexColumn]
					const valueString = (Array.isArray(cell) ? cell[0] : cell) as string
					const valueTs = Array.isArray(cell) && cell[1] ? cell[1] : null

					let renderedString = ''

					if (valueTs) {
						const utcjs = dayjs.utc

						// Relative date if within one year:
						if (utcjs(valueTs).isBetween(utcjs().subtract(25, 'd'), utcjs().add(25, 'd'))) {
							renderedString = dayjs().utc().to(valueTs)
						} else {
							renderedString = dayjs.tz(valueTs, googleSheet?.timeZone).format('YYYY-MM-DD')
						}
					} else {
						renderedString =
							column?.type === 'numeric'
								? valueString.padStart(column?.lengthMax, '0')
								: valueString
					}
					if (type === 'dance-event' && /(contact)|(연락)/i.test(column.title)) {
						return {
							value: valueString.replaceAll(/[0-9]/g, '*'),
							rendered: renderedString.replaceAll(/[0-9]/g, '*'),
						}
					}
					return {
						value: valueString,
						rendered: renderedString,
					}
				})
			})

			if (type === 'dance-event') {
				rowsRender.reverse()
			}

			return { type, columns, rows: rowsRender }
		}
		return { type, columns: [], rows: [] }
	})

	const numDancers = $derived.by(() => {
		if (type !== 'dance-event') {
			return { total: 0, follows: 0, leads: 0 }
		}

		const columnRole = columns.findIndex((cell) => {
			return /(role|(역할)|(리드)|팔로우)/i.test(cell.title)
		})

		const follows = rows.filter((row) => {
			const result = /(팔뤄)|(follow)/i.test(row[columnRole].value)
			return result
		}).length

		const leads = rows.filter((row) => {
			return /(리더)|(lead)/i.test(row[columnRole].value)
		}).length

		return {
			total: follows + leads,
			follows,
			leads,
		}
	})
</script>

{#snippet tableHeader()}
	{#each columns as column}
		<gh>{column.title}</gh>
	{/each}
{/snippet}

{#snippet tableRow(row, r)}
	{#each columns as _, c}
		{@const column = columns[c]}
		<gd onclick={makeToggleDetails(r)} role="none">
			{@html column?.type === 'numeric'
				? row[c]?.rendered.replace(/^0*/, '<gz>$&</gz>')
				: row[c]?.rendered}</gd
		>
	{/each}
	{#if r === detailsOpened}
		{@const transitionOptions = { duration: 500, easing: expoInOut }}
		<grid-details transition:slide={transitionOptions} onclick={makeToggleDetails(r)} role="none">
			<dl>
				{#each row.slice(1) as cell, indexColumn}
					<dt>{columns[indexColumn + 1]?.title}</dt>
					<dd>{cell.value}</dd>
				{/each}
			</dl>
		</grid-details>
	{/if}
{/snippet}

{#snippet danceEventHeaders()}
	<gh>
		<span>{numDancers.total}명 신청</span>
		<span>💃{numDancers.follows} 🕺{numDancers.leads}</span>
	</gh>
{/snippet}

{#snippet danceEventRow(row, r)}
	<gd onclick={makeToggleDetails(r)} role="none">
		<fi-index>
			<div>{@html row[0].rendered.replace(/^0*/, '<gz>$&</gz>')}.</div>
			<div>{row[7]?.rendered ? '💰' : ''}</div>
		</fi-index>
		<fi-role>{`${/lead/i.test(row[3].rendered) ? '🕺' : '💃'}`}</fi-role>
		<fi-info>
			<h4>{row[2].rendered}</h4>
			<div>{row[6]?.rendered}</div>
		</fi-info>
	</gd>

	{#if r === detailsOpened}
		{@const transitionOptions = { duration: 500, easing: expoInOut }}
		<grid-details transition:slide={transitionOptions} onclick={makeToggleDetails(r)} role="none">
			<dl>
				{#each row.slice(1) as cell, indexColumn}
					<dt>{columns[indexColumn + 1]?.title}</dt>
					<dd>{cell.value}</dd>
				{/each}
			</dl>
		</grid-details>
	{/if}
{/snippet}

{#snippet tableGrid(gridTemplateColumns: string, header, snippetRow, classes = '')}
	<grid-table
		class={classes}
		bind:this={gridTableElement}
		style:--col-count={columns.length}
		style:--header-height="{headerHeight}px"
		style:grid-template-columns={gridTemplateColumns}
	>
		{@render header()}

		{#each rows as row, r}
			{@render snippetRow(row, r)}
		{/each}
	</grid-table>
{/snippet}

{#if type === 'dance-event'}
	{@render tableGrid(`1fr`, danceEventHeaders, danceEventRow, type)}
{:else}
	{@render tableGrid(
		`auto repeat(${columns.length - 1}, minmax(120px, 1fr))`,
		tableHeader,
		tableRow,
	)}
{/if}

<div hidden>
	<pre>type    = {type}</pre>
	<pre>columns = {stringify(columns)}</pre>
	<pre>rows    = {stringify(rows)}</pre>
</div>

<style lang="scss">
	@use 'open-props-scss' as *;

	grid-table {
		display: grid;
		// grid-template-columns: as inline style

		border-bottom: 2px solid var(--pico-muted-border-color);

		margin-bottom: $size-4;
	}

	gh,
	gd {
		padding: $size-2 $size-2;

		.numeric {
			font-family: Lato, sans-serif;
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
		top: calc(min(0px, 2 * 1.5em + var(--pico-spacing) / 2 - var(--header-height)));
		background-color: var(--pico-card-sectioning-background-color);

		// Align items to bottom
		display: flex;
		align-items: flex-end;

		padding-bottom: $size-1;

		font-weight: $font-weight-7;

		border-bottom: 2px solid var(--pico-muted-border-color);
	}

	gd {
		display: block;
		white-space: nowrap;
		overflow: clip;
		text-overflow: ellipsis;

		border-top: 1px solid var(--pico-muted-border-color);
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

	dl {
		display: grid;

		flex-basis: $size-content-2;
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
			display: flex;
			justify-content: center;

			width: 100%;
			column-gap: $size-2;

			fi-index {
				opacity: 0.5;
				text-align: right;
			}

			fi-role {
				font-size: $font-size-6;
			}

			fi-info {
				flex-basis: $size-content-2;
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
</style>
