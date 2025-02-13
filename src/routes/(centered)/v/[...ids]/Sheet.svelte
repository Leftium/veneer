<script lang="ts">
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

	const [rowHead, ...rowsBody] = $derived.by(() => {
		if (doc?.json?.rows) {
			const rows = [...doc?.json?.rows]
			return rows.map((row) => {
				return row.map((cell) => {
					return (Array.isArray(cell) ? cell[0] : cell) as string
				})
			})
		}
		return []
	})
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
				{#each row as cell}
					<td>{cell}</td>
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
	}

	thead {
		position: sticky;
		z-index: 1;

		vertical-align: bottom;

		th {
			_background-color: lightsteelblue;
		}
	}

	tbody {
		white-space: nowrap;
	}
</style>
