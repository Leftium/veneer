<script lang="ts">
	import { stringify } from '$lib/util'

	let { row, columns } = $props()

	let generalInfo: Record<string, string> = {}
	let name = ''
	let urlPhoto = ''
	let urlFloorPlan = ''

	for (const [i, column] of columns.entries()) {
		if (column.title === '이름') {
			name = row[i].value
		} else if (column.title === 'Photo URL') {
			urlPhoto = row[i].value
		} else if (column.title === 'Floor Plan URL') {
			urlFloorPlan = row[i].value
		} else if (column.title === 'Timestamp' || column.title === '') {
			// ignore these values
		} else {
			generalInfo[column.title] = row[i].value
		}
	}
</script>

<pre hidden>{stringify(generalInfo)}</pre>

<h2>{name}</h2>

<img src={urlPhoto} width="382" height="482" alt="" />

<h3>General Information</h3>
<table>
	{#each Object.entries(generalInfo) as [name, value], indexColumn}
		<tbody>
			<tr>
				<td><b>{name}</b></td>
				<td>{value}</td>
			</tr>
		</tbody>
	{/each}
</table>

<h3>Floor Plan</h3>
<img src={urlFloorPlan} alt="" />

<style>
</style>
