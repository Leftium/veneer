<script lang="ts">
	import { gg } from '$lib/gg'
	import { GoogleDocument } from '$lib/GoogleDocument.svelte'
	import { stringify } from '$lib/util'

	interface Props {
		doc?: GoogleDocument
		top?: number
	}

	let { doc, top = $bindable(0) }: Props = $props()

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

	const numericRegex = /^[0-9-.,/: ]*$/
	const { columns, rows } = $derived.by(() => {
		if (doc?.json?.rows) {
			let rows = [...doc?.json?.rows].map((row, indexRow) => {
				return [indexRow ? `${indexRow}` : '', ...row]
			})

			const columns = rows[0].map((cell) => {
				const title = (Array.isArray(cell) ? cell[0] : cell) as string
				return {
					title,
					type: 'numeric',
					lengthMin: Number.MAX_SAFE_INTEGER,
					lengthMax: 0,
				}
			})

			for (let [indexRow, row] of rows.entries()) {
				for (let [indexCol, cell] of row.entries()) {
					const stringValue = (Array.isArray(cell) ? cell[0] : cell) as string
					const column = columns[indexCol]
					if (indexRow) {
						column.lengthMax = Math.max(column.lengthMax, stringValue.length)
						column.lengthMin = Math.min(column.lengthMin, stringValue.length)
						if (!numericRegex.test(stringValue)) {
							gg(numericRegex.test(stringValue), stringValue)
							column.type = 'string'
						}
					}
				}
			}

			rows = rows.map((row, indexRow) => {
				return row.map((cell, indexColumn) => {
					const value = (Array.isArray(cell) ? cell[0] : cell) as string
					const column = columns[indexColumn]

					return indexRow && column.type === 'numeric'
						? value.padStart(column.lengthMax, '0').replace(/^0*/, '<gz>$&</gz>')
						: value
				})
			})
			return { columns, rows }
		}
		return { columns: [], rows: [] }
	})

	const [rowHead, ...rowsBody] = $derived(rows)
</script>

<table>
	<thead style:top={topStyle} bind:clientHeight={theadHeight} bind:this={theadElement}>
		<tr>
			{#each rowHead as cell}
				<th>{cell}</th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each rowsBody as row}
			<tr>
				{#each row as cell, indexColumn}
					<td class:numeric={columns[indexColumn].type === 'numeric'}>{@html cell}</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>

<pre hidden>
    {stringify(doc)}
</pre>

<style>
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
		}
	}
</style>
