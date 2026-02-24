<script lang="ts">
	import { getBubbleAlignment, type PlacedUnit } from '$lib/dance-party'
	import type { DancerRow } from '$lib/util'

	interface Props {
		unit: PlacedUnit
		/** Horizontal center of the active dancer in px, relative to the parent container. */
		centerX: number
		/** Y anchor in px, relative to the parent container (dancer top if above, dancer bottom if below). */
		anchorY: number
		/** If true, render below the anchor; if false, render above. */
		below?: boolean
		/** Width of the parent container in px (for edge clamping). */
		containerWidth: number
	}

	let { unit, centerX, anchorY, below = false, containerWidth }: Props = $props()

	/** Measured bubble dimensions for edge clamping and above/below positioning.
	 *  Initial estimates avoid first-frame flicker before bind:client* fires. */
	let bubbleWidth = $state(0)
	let bubbleHeight = $state(32)

	const POINTER_HEIGHT = 8

	/** Top position of the wrapper: above the dancer (offset by bubble height) or below. */
	const wrapperTop = $derived(below ? anchorY : anchorY - bubbleHeight - POINTER_HEIGHT)

	/**
	 * Clamped left position for the bubble card.
	 * Centers on the dancer but shifts inward when near edges.
	 */
	const bubbleLeft = $derived.by(() => {
		if (bubbleWidth === 0) return centerX // first render: center as fallback
		const halfBubble = bubbleWidth / 2
		const idealLeft = centerX - halfBubble
		// Clamp: don't go past left edge (0) or right edge (containerWidth - bubbleWidth)
		const maxLeft = Math.max(0, containerWidth - bubbleWidth)
		return Math.max(0, Math.min(idealLeft, maxLeft))
	})

	const alignment = $derived(
		unit.type === 'pair' ? getBubbleAlignment(unit.imageNum, unit.flipped) : null,
	)

	/** For pairs, resolve which DancerRow goes on the left vs right. */
	const leftMember: DancerRow | undefined = $derived(
		alignment ? (alignment.leftMember === 'leader' ? unit.members[0] : unit.members[1]) : undefined,
	)
	const rightMember: DancerRow | undefined = $derived(
		alignment
			? alignment.rightMember === 'leader'
				? unit.members[0]
				: unit.members[1]
			: undefined,
	)

	function formatName(member: DancerRow): string {
		return member.paid ? `💰 ${member.name}` : member.name
	}

	function hasWish(member: DancerRow): boolean {
		return !!member.wish && member.wish.trim().length > 0
	}
</script>

<div
	class="speech-bubble-wrapper"
	class:below
	class:above={!below}
	style:top="{wrapperTop}px"
	style:--bubble-h="{bubbleHeight}px"
>
	<!-- Pointer triangle: stays centered on the dancer -->
	<div class="pointer" style:left="{centerX}px"></div>

	<!-- Bubble card: centered on dancer but clamped to container edges -->
	{#if unit.type === 'solo'}
		<div
			class="bubble solo"
			style:left="{bubbleLeft}px"
			bind:clientWidth={bubbleWidth}
			bind:clientHeight={bubbleHeight}
		>
			<div class="name">{formatName(unit.members[0])}</div>
			{#if hasWish(unit.members[0])}
				<div class="message">{unit.members[0].wish}</div>
			{/if}
		</div>
	{:else if leftMember && rightMember}
		<div
			class="bubble pair"
			style:left="{bubbleLeft}px"
			bind:clientWidth={bubbleWidth}
			bind:clientHeight={bubbleHeight}
		>
			<div class="inner-bubble left">
				<div class="name">{formatName(leftMember)}</div>
				{#if hasWish(leftMember)}
					<div class="message">{leftMember.wish}</div>
				{/if}
			</div>
			<div class="inner-bubble right">
				<div class="name">{formatName(rightMember)}</div>
				{#if hasWish(rightMember)}
					<div class="message">{rightMember.wish}</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	@use 'open-props-scss' as *;

	.speech-bubble-wrapper {
		position: absolute;
		left: 0;
		right: 0;
		pointer-events: none;
		z-index: 0;
	}

	// Shared pointer base
	.pointer {
		position: absolute;
		transform: translateX(-50%);
		width: 0;
		height: 0;
		border-left: 6px solid transparent;
		border-right: 6px solid transparent;
	}

	// Shared bubble base — frosted glass effect
	.bubble {
		position: absolute;
		width: fit-content;
		background: color-mix(in srgb, var(--app-accent-color, #{$blue-6}) 55%, transparent);
		color: var(--app-accent-text, white);
		font-size: 0.75rem;
		border-radius: 6px;
		padding: 6px 10px;
		max-width: min($size-content-2, 100%);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid color-mix(in srgb, var(--app-accent-text, white) 20%, transparent);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	// Above: bubble first, then pointer below it pointing down
	// wrapperTop = anchorY - bubbleHeight - pointerHeight
	// so: bubble at top:0, pointer at top:bubbleHeight
	.above .bubble {
		top: 0;
	}

	.above .pointer {
		top: var(--bubble-h);
		border-top: 8px solid color-mix(in srgb, var(--app-accent-color, #{$blue-6}) 70%, transparent);
	}

	// Below: pointer first pointing up, then bubble below it
	// wrapperTop = anchorY
	// so: pointer at top:0, bubble at top:pointerHeight
	.below .pointer {
		top: 0;
		border-bottom: 8px solid
			color-mix(in srgb, var(--app-accent-color, #{$blue-6}) 70%, transparent);
	}

	.below .bubble {
		top: 8px;
	}

	.bubble.pair {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.inner-bubble {
		flex: 1;
		min-width: 12ch;
		background: color-mix(in srgb, var(--app-accent-text, white) 12%, transparent);
		border-radius: 4px;
		padding: 4px 8px;
	}

	.name {
		font-weight: 800;
		font-size: 0.85rem;

		.right > & {
			text-align: right;
		}
	}

	.message {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		opacity: 0.85;
		margin-top: 2px;
		text-align: center;
	}
</style>
