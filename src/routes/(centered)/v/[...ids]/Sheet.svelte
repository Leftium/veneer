<script lang="ts">
	import dayjs from 'dayjs'
	import relativeTime from 'dayjs/plugin/relativeTime'
	import isBetween from 'dayjs/plugin/isBetween'
	import utc from 'dayjs/plugin/utc'

	dayjs.extend(relativeTime)
	dayjs.extend(isBetween)
	dayjs.extend(utc)

	import { gg } from '$lib/gg'
	import { GoogleDocument } from '$lib/GoogleDocument.svelte'
	import { stringify } from '$lib/util'
	import { slide } from 'svelte/transition'

	interface Props {
		doc?: GoogleDocument
		top?: number
	}

	let { doc, top = $bindable(0) }: Props = $props()

	let tableWidth = $state(0)

	let theadElement: HTMLElement | undefined = $state()
	let theadHeight = $state(0)
	let theadLineHeight = $derived(
		theadElement ? window.getComputedStyle(theadElement).lineHeight : 0,
	)

	let topStyle = $derived(
		// -${theadHeight}px         : Hide header,
		// ${theadLineHeight} * 3.25 : except for (up to) 3 lines of text + alpha,
		// var(--pico-spacing) / 2   : and padding.
		`calc(min(${theadLineHeight} * 3.25 + var(--pico-spacing) / 2 - ${theadHeight}px, 0px) + ${top}px)`,
	)

	let detailsOpened = $state(-1)

	function makeToggleDetails(index: number) {
		return function () {
			detailsOpened = detailsOpened === index ? -1 : index
		}
	}

	const numericRegex = /^[0-9-.,/: ]*$/
	const { type, columns, rows } = $derived.by(() => {
		let type = 'regular'
		if (doc?.json?.rows) {
			let rows = [...doc?.json?.rows]

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

			for (let [indexRow, row] of rows.entries()) {
				for (let [indexCol, cell] of row.entries()) {
					const valueString = (Array.isArray(cell) ? cell[0] : cell) as string
					const column = columns[indexCol]
					if (indexRow && column) {
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

			// Detect special type
			if (
				columns.filter(({ title }) => /(name)|(닉네임)/i.test(title)).length &&
				columns.filter(({ title }) => /(role|(역할)|(리드)|팔로우)/i.test(title)).length
			) {
				type = 'dance-event'
			}

			const rowsRender = rows.map((row, indexRow) => {
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
							renderedString = dayjs.tz(valueTs, doc.timeZone).format('YYYY-MM-DD')
						}
					} else {
						renderedString =
							indexRow && column?.type === 'numeric'
								? valueString.padStart(column?.lengthMax, '0')
								: valueString
					}
					return {
						value: valueString,
						rendered: renderedString,
					}
				})
			})

			return { type, columns, rows: rowsRender }
		}
		return { type, columns: [], rows: [] }
	})

	const [rowHead, ...rowsBody] = $derived(rows)
</script>

<table bind:clientWidth={tableWidth}>
	<thead style:top={topStyle} bind:clientHeight={theadHeight} bind:this={theadElement}>
		<tr>
			{#each rowHead as cell}
				<th>{cell.rendered}</th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each rowsBody as row, indexRow (indexRow)}
			<tr onclick={makeToggleDetails(indexRow)}>
				{#each row as cell, indexColumn}
					{@const column = columns[indexColumn]}
					<td class:numeric={column?.type === 'numeric'}>
						{@html column?.type === 'numeric'
							? cell.rendered.replace(/^0*/, '<gz>$&</gz>')
							: cell.rendered}
					</td>
				{/each}
			</tr>
			{#if detailsOpened === indexRow}
				<tr class="details" onclick={makeToggleDetails(indexRow)} transition:slide>
					<td colspan={row.length}>
						<div transition:slide style:width={tableWidth ? `calc(${tableWidth}px - .5rem)` : ''}>
							<dl>
								{#each row as cell, indexColumn}
									{#if indexColumn}
										<dt>{columns[indexColumn]?.title}</dt>
										<dd>{cell.value}</dd>
									{/if}
								{/each}
							</dl>
						</div>
					</td>
				</tr>
			{/if}
		{/each}
	</tbody>
	<tfoot>
		<tr>
			<td colspan={columns.length}></td>
		</tr>
	</tfoot>
</table>

<pre>type    = {type}</pre>
<pre>columns = {stringify(columns)}</pre>
<pre>rows    = {stringify(rows)}</pre>
<pre>doc     = {stringify(doc)}</pre>

<style lang="scss">
	@use 'open-props-scss' as *;

	table {
		border-collapse: separate; /* Don't collapse */

		.numeric {
			font-family: Lato, sans-serif;
		}

		:global(gz) {
			opacity: 0;
			user-select: none;
		}

		thead {
			position: sticky;
			z-index: 1;

			vertical-align: bottom;

			th:not(:first-child) {
				min-width: 5rem;
				_background-color: lightsteelblue;
			}
		}

		tbody {
			white-space: nowrap;

			tr {
				height: $size-8;
			}
		}
	}

	dl {
		display: grid;

		dt {
			margin-top: $size-2;
			font-weight: bold;
			opacity: 15%;
		}

		dd {
			margin-left: 0;
		}
	}

	@media (max-width: 100px) {
		dl {
			grid-template-columns: 1fr;
		}
	}

	.details {
		td {
			padding-block: 0;
			padding-inline: $size-1;
		}
	}

	.details div {
		padding-inline: $size-7;
		box-shadow: shadow('inner-3');

		overflow: hidden;
	}
</style>
