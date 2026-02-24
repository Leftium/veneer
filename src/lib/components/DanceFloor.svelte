<script lang="ts">
	import {
		getDancerScale,
		getBubbleTop,
		getDockScale,
		findNearestUnit,
		type PlacedUnit,
		type DockConfig,
		DEFAULT_DOCK,
	} from '$lib/dance-party'
	import { scrubAction } from '$lib/scrubAction'
	import DancerIcon from './DancerIcon.svelte'

	/** Info about the currently active (nearest) unit during scrub. */
	export interface ActiveUnitInfo {
		unitIndex: number
		/** Bounding rect of the active dancer's icon-wrapper element. */
		rect: DOMRect
	}

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
		/** Called with active unit info during scrub, or null when scrub ends. */
		onActiveUnit?: (info: ActiveUnitInfo | null) => void
		/** Global multiplier applied on top of the per-image bubble-top fraction.
		 *  1.0 = use per-image value as-is; <1 shifts bubbles down, >1 shifts up. */
		bubbleHeightFraction?: number
	}

	let {
		units,
		dockConfig = DEFAULT_DOCK,
		baseIconHeight = 109,
		heightMultiplier = 0.8,
		marginTop = -2,
		anchorPercent = 0,
		onActiveUnit,
		bubbleHeightFraction = 1.0,
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

	/** Cached reference to the <gh> sticky ancestor (looked up once on first scrub). */
	let ghAncestor: HTMLElement | null | undefined = undefined // undefined = not yet looked up

	/** Cached reference to the ancestor swiper-container (looked up once on first scrub). */
	let swiperAncestor: (HTMLElement & { swiper?: { allowTouchMove: boolean } }) | null | undefined =
		undefined

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

		// Detect sticky state: compare the <gh> ancestor's viewport position
		// against its CSS `top` value. When stuck, rect.top ≈ computed top.
		if (ghAncestor === undefined) {
			ghAncestor = containerEl.closest('gh') as HTMLElement | null
		}
		let isSticky = false
		if (ghAncestor) {
			const ghRect = ghAncestor.getBoundingClientRect()
			const computedTop = parseFloat(getComputedStyle(ghAncestor).top) || 0
			// When stuck, ghRect.top is pinned at the CSS top value.
			// When not stuck, ghRect.top > computedTop (element is further down the page).
			isSticky = ghRect.top <= computedTop + 1
		}
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

			// Active dancer gets highest z-index; others revert to priority order
			el.style.zIndex = i === nearestIdx ? String(units.length + 1) : String(units.length - i)

			// Floor shadow: activate on nearest unit, deactivate on others
			const iconSpan = el.querySelector('.dancer-icon') as HTMLElement | null
			if (iconSpan) {
				iconSpan.style.setProperty('--dancer-shadow-opacity', i === nearestIdx ? '1' : '0')
			}
		}

		// Emit active unit info for speech bubble positioning.
		// The rendered dancer height = baseIconHeight * scaleFactor * dockScale (CSS
		// scale() applies scaleFactor × dockScale). The bubble anchor is a fraction of
		// that height measured up from the feet: bubbleTop × scaleFactor × baseIconHeight
		// × dockScale. bubbleHeightFraction is a global multiplier for fine-tuning.
		if (onActiveUnit && nearestIdx >= 0 && wrapperEls[nearestIdx]) {
			const wrapperRect = wrapperEls[nearestIdx].getBoundingClientRect()
			const nearestUnit = units[nearestIdx]
			const nearestRole =
				nearestUnit.type === 'pair'
					? 'both'
					: nearestUnit.members[0].role === 'lead' || nearestUnit.members[0].role === 'unknown'
						? 'lead'
						: ('follow' as const)
			const scaleFactor = getDancerScale(nearestRole, nearestUnit.imageNum)
			const nearestDistance = Math.abs(positions[nearestIdx] - scrubX)
			const nearestDockScale = getDockScale(nearestDistance, neighborRadius, effectiveDock)
			const perImageBubbleTop = getBubbleTop(nearestRole, nearestUnit.imageNum)
			const visualHeight =
				baseIconHeight * scaleFactor * perImageBubbleTop * bubbleHeightFraction * nearestDockScale
			const visualTop = wrapperRect.bottom - visualHeight
			const adjustedRect = new DOMRect(wrapperRect.x, visualTop, wrapperRect.width, visualHeight)
			onActiveUnit({
				unitIndex: nearestIdx,
				rect: adjustedRect,
			})
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

			// Reset z-index to priority order
			el.style.zIndex = String(units.length - i)

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
		// Prevent swiper from intercepting horizontal gestures during scrub
		if (swiperAncestor === undefined) {
			swiperAncestor = (containerEl?.closest('swiper-container') as typeof swiperAncestor) ?? null
		}
		if (swiperAncestor?.swiper) {
			swiperAncestor.swiper.allowTouchMove = false
		}
	}

	function handleScrubEnd() {
		trackedElement = null
		isScrubbing = false
		resetTransforms()
		onActiveUnit?.(null)
		document.body.style.userSelect = ''
		document.body.style.webkitUserSelect = ''
		if (containerEl) {
			containerEl.style.cursor = ''
		}
		// Re-enable swiper touch after scrub ends
		if (swiperAncestor?.swiper) {
			swiperAncestor.swiper.allowTouchMove = true
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
			style:z-index={units.length - i}
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
		z-index: 1;
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
