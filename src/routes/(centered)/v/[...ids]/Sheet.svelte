<script lang="ts">
	import { GoogleDocument } from '$lib/GoogleDocument.svelte'
	import { stringify } from '$lib/util'

	interface Props {
		doc?: GoogleDocument
	}

	let { doc }: Props = $props()

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
	<thead>
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
	th {
		vertical-align: bottom;
	}

	tbody {
		white-space: nowrap;
	}
</style>
