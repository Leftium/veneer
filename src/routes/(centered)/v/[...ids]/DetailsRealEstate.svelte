<script lang="ts">
	import { stringify } from '$lib/util'
	import { onMount } from 'svelte'

	import { gg } from '@leftium/gg'

	let { row, columns } = $props()

	let mapElement = $state<HTMLDivElement>()

	let generalInfo: Record<string, string> = {}
	let name = ''
	let address = ''
	let urlPhoto = ''
	let urlFloorPlan = ''
	let latitude = $state(0)
	let longitude = $state(0)

	for (const [i, column] of columns.entries()) {
		if (column.title === '이름') {
			name = row[i].value
		} else if (column.title === '주소') {
			address = row[i].value
			generalInfo[column.title] = row[i].value
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

	function geocode(address) {
		return new Promise((resolve, reject) => {
			naver.maps.Service.geocode({ address }, function (status, response) {
				if (status !== naver.maps.Service.Status.OK) {
					reject(new Error('Something went wrong!'))
				} else {
					resolve(response.result.items) // Returning the search result items
				}
			})
		})
	}

	onMount(async () => {
		const results = await geocode(address)
		gg({ results })
		if (results.length) {
			latitude = Number(results[0].point.y)
			longitude = Number(results[0].point.x)
		}

		if (!mapElement) {
			return
		}
		const map = new naver.maps.Map(mapElement, {
			center: new naver.maps.LatLng(latitude, longitude),
			zoom: 13,
			zoomControl: true,
			zoomControlOptions: {
				style: naver.maps.ZoomControlStyle.SMALL,
				position: naver.maps.Position.TOP_RIGHT,
			},
		})

		var marker = new naver.maps.Marker({
			position: new naver.maps.LatLng(latitude, longitude),
			map: map,
		})

		gg(map)
	})
</script>

<pre hidden>{stringify(generalInfo)}</pre>

<h2>{name}</h2>

<img src={urlPhoto} width="382" height="482" alt="" />

<h3>Location</h3>

<wrap-map bind:this={mapElement}></wrap-map>

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
	wrap-map {
		display: block;
		height: 400px;
	}
</style>
