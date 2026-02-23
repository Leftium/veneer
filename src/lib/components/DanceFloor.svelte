<script lang="ts">
	import {
		getDancerScale,
		getDockScale,
		findNearestUnit,
		type PlacedUnit,
		type DockConfig,
		DEFAULT_DOCK,
	} from '$lib/dance-party'
	import { scrubAction } from '$lib/scrubAction'
	import DancerIcon from './DancerIcon.svelte'

	interface Props {
		units: PlacedUnit[]
		dockConfig?: DockConfig
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
		dockConfig = DEFAULT_DOCK,
		baseIconHeight = 109,
		heightMultiplier = 0.8,
		marginTop = -36,
		anchorPercent = 0,
	}: Props = $props()

	const containerHeight = $derived(baseIconHeight * heightMultiplier)
	const glowSize = $derived(baseIconHeight * 0.85)

	// --- Scrub state (managed imperatively for performance) ---
	let containerEl: HTMLElement | undefined = $state(undefined)
	let trackedElement: HTMLElement | null = $state(null)
	let isScrubbing = $state(false)

	// Refs to icon-wrapper DOM elements, keyed by index.
	// Truncated when units.length decreases to avoid stale refs.
	let wrapperEls: HTMLElement[] = []

	$effect(() => {
		// When units array shrinks, trim stale refs
		if (wrapperEls.length > units.length) {
			wrapperEls.length = units.length
		}
	})

	function getPosition(e: PointerEvent | MouseEvent): number {
		if (!containerEl) return 0
		const rect = containerEl.getBoundingClientRect()
		const x = (e.clientX - rect.left) / rect.width
		return Math.max(0, Math.min(1, x))
	}

	/** Max scale when the sticky header is active (prevents overflow past viewport top). */
	const STICKY_MAX_SCALE = 1.5

	function applyDockTransforms(scrubX: number) {
		if (!containerEl || units.length === 0) return

		// Detect sticky state: if the dance floor container is near the viewport top,
		// the header is stuck and we cap magnification to avoid overflow.
		const rect = containerEl.getBoundingClientRect()
		const isSticky = rect.top < 10
		const effectiveMaxScale = isSticky
			? Math.min(dockConfig.maxScale, STICKY_MAX_SCALE)
			: dockConfig.maxScale
		const effectiveDock =
			effectiveMaxScale !== dockConfig.maxScale
				? { ...dockConfig, maxScale: effectiveMaxScale }
				: dockConfig

		const positions = units.map((u) => u.x)
		const nearestIdx = findNearestUnit(positions, scrubX)

		// Compute neighbor radius: average spacing * neighborCount
		// Adapts to dancer density — sparse floors get wider radius, dense floors tighter
		const sorted = [...positions].sort((a, b) => a - b)
		let neighborRadius: number
		if (sorted.length <= 1) {
			neighborRadius = 0.2 * effectiveDock.neighborCount
		} else {
			let totalGap = 0
			for (let j = 1; j < sorted.length; j++) {
				totalGap += sorted[j] - sorted[j - 1]
			}
			neighborRadius = (totalGap / (sorted.length - 1)) * effectiveDock.neighborCount
		}

		for (let i = 0; i < wrapperEls.length; i++) {
			const el = wrapperEls[i]
			if (!el) continue

			const unit = units[i]
			if (!unit) continue

			const displayRole =
				unit.type === 'pair'
					? 'both'
					: unit.members[0].role === 'lead' || unit.members[0].role === 'unknown'
						? 'lead'
						: 'follow'
			const scaleFactor =
				displayRole === 'both' || displayRole === 'lead' || displayRole === 'follow'
					? getDancerScale(displayRole, unit.imageNum)
					: 1

			// Scale-only magnification: no positional shifts, dancers grow in place
			const distance = Math.abs(positions[i] - scrubX)
			const dockScale = getDockScale(distance, neighborRadius, effectiveDock)
			const combinedScale = scaleFactor * dockScale

			el.style.transform = `translateX(-50%) translateY(${unit.yOffset}px) scale(${combinedScale})`

			// Floor shadow: activate on nearest unit, deactivate on others
			const iconSpan = el.querySelector('.dancer-icon') as HTMLElement | null
			if (iconSpan) {
				iconSpan.style.setProperty('--dancer-shadow-opacity', i === nearestIdx ? '1' : '0')
			}
		}
	}

	function resetTransforms() {
		for (let i = 0; i < wrapperEls.length; i++) {
			const el = wrapperEls[i]
			if (!el) continue

			const unit = units[i]
			if (!unit) continue

			const displayRole =
				unit.type === 'pair'
					? 'both'
					: unit.members[0].role === 'lead' || unit.members[0].role === 'unknown'
						? 'lead'
						: 'follow'
			const scaleFactor =
				displayRole === 'both' || displayRole === 'lead' || displayRole === 'follow'
					? getDancerScale(displayRole, unit.imageNum)
					: 1

			el.style.transform = `translateX(-50%) translateY(${unit.yOffset}px) scale(${scaleFactor})`

			// Reset floor shadow
			const iconSpan = el.querySelector('.dancer-icon') as HTMLElement | null
			if (iconSpan) {
				iconSpan.style.removeProperty('--dancer-shadow-opacity')
			}
		}
	}

	function handleScrubChange(position: number) {
		applyDockTransforms(position)
	}

	function handleScrubStart(node: HTMLElement) {
		trackedElement = node
		isScrubbing = true
		document.body.style.userSelect = 'none'
		document.body.style.webkitUserSelect = 'none'
		if (containerEl) {
			containerEl.style.cursor = 'pointer'
		}
	}

	function handleScrubEnd() {
		trackedElement = null
		isScrubbing = false
		resetTransforms()
		document.body.style.userSelect = ''
		document.body.style.webkitUserSelect = ''
		if (containerEl) {
			containerEl.style.cursor = ''
		}
	}

	// Collect wrapper element refs after each render.
	// Svelte action: receives (node, param), returns { update, destroy }.
	function bindWrapper(el: HTMLElement, index: number) {
		wrapperEls[index] = el
		return {
			update(newIndex: number) {
				wrapperEls[newIndex] = el
			},
			destroy() {
				// Remove stale ref when element is removed from DOM
				const idx = wrapperEls.indexOf(el)
				if (idx !== -1) wrapperEls[idx] = undefined as unknown as HTMLElement
			},
		}
	}
</script>

<div
	class="dance-floor"
	class:scrubbing={isScrubbing}
	style:height="{containerHeight}px"
	style:margin-top="{marginTop}px"
	bind:this={containerEl}
	use:scrubAction={{
		getPosition,
		getTrackedElement: () => trackedElement,
		onScrubChange: handleScrubChange,
		onScrubStart: handleScrubStart,
		onScrubEnd: handleScrubEnd,
	}}
>
	{#each units as unit, i (unit.unitKey)}
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
			use:bindWrapper={i}
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
		overflow: visible;
		touch-action: pan-y;
	}

	.dance-floor.scrubbing {
		cursor: pointer;
	}

	.icon-wrapper {
		position: absolute;
		will-change: transform;
		user-select: none;
		-webkit-user-select: none;
	}

	.dance-floor.scrubbing .icon-wrapper {
		pointer-events: none;
	}
</style>
