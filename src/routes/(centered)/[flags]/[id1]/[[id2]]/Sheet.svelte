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
			while (!rows[1][0]) {
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
</script>

<grid-table
	bind:this={gridTableElement}
	style:--col-count={columns.length}
	style:--header-height="{headerHeight}px"
	style:grid-template-columns={`auto repeat(${columns.length - 1}, minmax(120px, 1fr))`}
>
	{#each columns as column}
		<gh>{column.title}</gh>
	{/each}

	{#each rows as row}
		{#each columns as _, i}
			<gd>{row[i]?.rendered || ''}</gd>
		{/each}
	{/each}
</grid-table>

<div>
	<pre>type    = {type}</pre>
	<pre>columns = {stringify(columns)}</pre>
	<pre>rows    = {stringify(rows)}</pre>
</div>

<style lang="scss">
	@use 'open-props-scss' as *;

	grid-table {
		display: grid;
		// grid-template-columns: as inline style
	}

	gh,
	gd {
		padding: $size-2 $size-2;
		border-top: 1px solid lightgray;
	}

	gh {
		position: sticky;
		z-index: 0;
		// At most 2 lines of header will become sticky:
		top: calc(min(0px, 2 * 1.5em + var(--pico-spacing) / 2 - var(--header-height)));
		background-color: var(--pico-card-sectioning-background-color);

		// Align items to bottom
		display: flex;
		align-items: flex-end;

		padding-bottom: $size-1;

		font-weight: $font-weight-7;

		border-bottom: 2px solid lightgray;
	}

	gd {
		display: block;
		white-space: nowrap;
		overflow: clip;
		text-overflow: ellipsis;

		//border: 1px solid red;
	}
</style>
