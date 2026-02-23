<script lang="ts">
	import { getDancerScale, type PlacedUnit } from '$lib/dance-party'
	import DancerIcon from './DancerIcon.svelte'

	interface Props {
		units: PlacedUnit[]
		baseIconHeight?: number
		/** Container height as a multiplier of baseIconHeight */
		heightMultiplier?: number
		/** Negative margin-top in px to overlap the count row above */
		marginTop?: number
		/** Icon vertical anchor within container (0 = top, 100 = bottom) */
		anchorPercent?: number
	}

	let {
		units,
		baseIconHeight = 109,
		heightMultiplier = 0.8,
		marginTop = -36,
		anchorPercent = 0,
	}: Props = $props()

	const containerHeight = $derived(baseIconHeight * heightMultiplier)
	const glowSize = $derived(baseIconHeight * 0.85)
</script>

<div class="dance-floor" style:height="{containerHeight}px" style:margin-top="{marginTop}px">
	{#each units as unit (unit.unitKey)}
		{@const displayRole =
			unit.type === 'pair'
				? 'both'
				: unit.members[0].role === 'lead' || unit.members[0].role === 'unknown'
					? 'lead'
					: 'follow'}
		{@const scaleFactor =
			displayRole === 'both' || displayRole === 'lead' || displayRole === 'follow'
				? getDancerScale(displayRole, unit.imageNum)
				: 1}
		<div
			class="icon-wrapper"
			style:left="{unit.x * 100}%"
			style:top="{anchorPercent}%"
			style:transform="translateX(-50%) translateY({unit.yOffset}px) scale({scaleFactor})"
			style:transform-origin="bottom center"
			style:--dancer-icon-size="{baseIconHeight}px"
			style:--dancer-glow-size="{glowSize}px"
		>
			<DancerIcon
				role={displayRole}
				directImageNum={unit.imageNum}
				flipped={unit.flipped}
				glow={false}
			/>
		</div>
	{/each}
</div>

<style>
	.dance-floor {
		position: relative;
		width: 100%;
	}

	.icon-wrapper {
		position: absolute;
		will-change: transform;
	}
</style>
