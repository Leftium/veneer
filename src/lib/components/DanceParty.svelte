<script lang="ts">
	import type { DancerRow } from '$lib/util'
	import {
		computeDanceFloor,
		getSongNumber,
		DEFAULT_CONFIG,
		type DancePartyConfig,
		type PlacedUnit,
	} from '$lib/dance-party'
	import DanceFloor from './DanceFloor.svelte'
	import DevTuningPanel from './DevTuningPanel.svelte'
	import { page } from '$app/state'

	interface Props {
		dancers: DancerRow[]
		formTitle: string
		firstSignupTs?: number | null
	}

	let { dancers, formTitle, firstSignupTs }: Props = $props()

	// Dev mode detection: read ?dev query param
	let isDev = $derived(page.url.searchParams.get('dev') != null)

	// Config state: mutable, initialized from defaults
	let config: DancePartyConfig = $state({ ...DEFAULT_CONFIG })

	// View layout params (not part of engine config — purely visual)
	let viewHeightMultiplier = $state(0.8)
	let viewMarginTop = $state(-36)
	let viewAnchorPercent = $state(0)

	// Current real song number (always up-to-date from firstSignupTs)
	let currentSongNumber = $derived(getSongNumber(firstSignupTs))

	// Song number override from dev panel (null means use the real value)
	let songNumberOverride: number | null = $state(null)

	// Effective song number: use override if set, otherwise the real current song
	let songNumber = $derived(songNumberOverride ?? currentSongNumber)

	// Synthetic dancer override from dev panel (null means use real data)
	let dancerOverride: DancerRow[] | null = $state(null)

	// Effective dancers: use override if set, otherwise real prop
	let effectiveDancers = $derived(dancerOverride ?? dancers)

	// Compute the dance floor layout
	let placedUnits: PlacedUnit[] = $derived(
		computeDanceFloor(effectiveDancers, formTitle, songNumber, config),
	)
</script>

{#if effectiveDancers.length > 0}
	<div class="dance-party">
		<DanceFloor
			units={placedUnits}
			dockConfig={config.dock}
			baseIconHeight={config.dock.baseIconHeight}
			heightMultiplier={viewHeightMultiplier}
			marginTop={viewMarginTop}
			anchorPercent={viewAnchorPercent}
		/>
	</div>
{/if}
{#if isDev}
	<DevTuningPanel
		{config}
		{songNumber}
		maxSong={currentSongNumber}
		{viewHeightMultiplier}
		{viewMarginTop}
		{viewAnchorPercent}
		onchange={(newConfig, newSong) => {
			config = newConfig
			songNumberOverride = newSong
		}}
		onviewchange={(hm, mt, ap) => {
			viewHeightMultiplier = hm
			viewMarginTop = mt
			viewAnchorPercent = ap
		}}
		ondancers={(d) => {
			dancerOverride = d
		}}
	/>
{/if}

<style>
	.dance-party {
		position: relative;
	}
</style>
