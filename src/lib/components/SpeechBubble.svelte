<script lang="ts">
	import { getBubbleAlignment, type PlacedUnit } from '$lib/dance-party'
	import type { DancerRow } from '$lib/util'

	interface Props {
		unit: PlacedUnit
		/** Horizontal center of the active dancer in px, relative to the parent container. */
		centerX: number
		/** Top of the bubble area in px, relative to the parent container (bottom edge of the dancer). */
		topY: number
		/** Width of the parent container in px (for edge clamping). */
		containerWidth: number
	}

	let { unit, centerX, topY, containerWidth }: Props = $props()

	/** Measured bubble width for edge clamping (Svelte bind:clientWidth). */
	let bubbleWidth = $state(0)

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

<div class="speech-bubble-wrapper" style:top="{topY}px">
	<!-- Pointer triangle: stays centered on the dancer -->
	<div class="pointer" style:left="{centerX}px"></div>

	<!-- Bubble card: centered on dancer but clamped to container edges -->
	{#if unit.type === 'solo'}
		<div class="bubble solo" style:left="{bubbleLeft}px" bind:clientWidth={bubbleWidth}>
			<div class="name">{formatName(unit.members[0])}</div>
			{#if hasWish(unit.members[0])}
				<div class="message">{unit.members[0].wish}</div>
			{/if}
		</div>
	{:else if leftMember && rightMember}
		<div class="bubble pair" style:left="{bubbleLeft}px" bind:clientWidth={bubbleWidth}>
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
		z-index: 200;
	}

	.pointer {
		position: absolute;
		top: 0;
		transform: translateX(-50%);
		width: 0;
		height: 0;
		border-left: 6px solid transparent;
		border-right: 6px solid transparent;
		border-bottom: 8px solid var(--app-accent-color, #{$blue-6});
	}

	.bubble {
		position: absolute;
		top: 8px; // below the pointer triangle
		width: fit-content;
		background: var(--app-accent-color, #{$blue-6});
		color: var(--app-accent-text, white);
		font-size: 0.75rem;
		border-radius: 6px;
		padding: 6px 10px;
		max-width: min($size-content-2, 100%);
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
		font-weight: 600;

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
