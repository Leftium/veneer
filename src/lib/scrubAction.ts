/**
 * Svelte action for horizontal scrub interaction on the dance floor.
 * Ported from weather-sense trackable.ts, adapted for normalized [0,1] position.
 *
 * Supports:
 * - Mouse hover (desktop): scrub follows pointer, starts on enter, ends on leave
 * - Mouse click-drag (desktop): locks scrub until mouse up
 * - Touch (mobile): horizontal vs vertical gesture discrimination
 * - RAF-throttled updates at 60fps
 */

export interface ScrubOptions {
	/** Convert pointer event to normalized [0,1] position along the dance floor. */
	getPosition: (e: PointerEvent | MouseEvent) => number
	/** Get the currently tracked element from shared state (for multi-element transfer). */
	getTrackedElement: () => HTMLElement | null
	/** Emit scrub position change. Called at most 60fps via RAF. */
	onScrubChange: (position: number) => void
	/** Scrub interaction started on this element. */
	onScrubStart: (node: HTMLElement) => void
	/** Scrub interaction ended. */
	onScrubEnd: () => void
}

export function scrubAction(node: HTMLElement, options: ScrubOptions) {
	let trackUntilMouseUp = false
	let mouseIsOver = false

	// Touch gesture state
	let touchStartX = 0
	let touchStartY = 0
	let savedScrollTop = 0
	let gestureDecided = false
	let isScrubbing = false
	let activePointerId: number | null = null
	const GESTURE_THRESHOLD = 8 // pixels to move before deciding gesture type

	// Throttling — limits updates to 60fps
	let pendingPosition: number | null = null
	let rafId: number | null = null
	let lastUpdateTime = 0
	const THROTTLE_MS = 1000 / 60

	function schedulePositionUpdate(pos: number) {
		pendingPosition = pos
		const now = performance.now()

		if (now - lastUpdateTime >= THROTTLE_MS) {
			if (rafId === null) {
				rafId = requestAnimationFrame(() => {
					if (pendingPosition !== null) {
						options.onScrubChange(pendingPosition)
						pendingPosition = null
						lastUpdateTime = performance.now()
					}
					rafId = null
				})
			}
		}
		// Otherwise, skip this update (throttled)
	}

	function trackToPosition(e: PointerEvent | MouseEvent, useRaf = false) {
		const pos = options.getPosition(e)
		if (useRaf) {
			schedulePositionUpdate(pos)
		} else {
			options.onScrubChange(pos)
		}
	}

	// --- Mouse/pen pointer handlers ---

	function handlePointerMove(e: PointerEvent) {
		if (e.pointerType === 'touch') return

		const trackedElement = options.getTrackedElement()
		if (trackedElement === node) {
			trackToPosition(e, true)
		} else if (mouseIsOver && trackedElement === null) {
			trackToPosition(e, true)
			options.onScrubStart(node)
		}
	}

	function handlePointerDown(e: PointerEvent) {
		if (e.pointerType === 'touch') return

		trackUntilMouseUp = true
		trackToPosition(e)
		options.onScrubStart(node)
	}

	function handlePointerUp(e: PointerEvent) {
		if (e.pointerType === 'touch') return

		if (options.getTrackedElement() === node) {
			trackUntilMouseUp = false
			options.onScrubEnd()
		}
	}

	// --- Delayed tracking end for seamless transfer ---
	let trackingEndTimeoutId: ReturnType<typeof setTimeout> | null = null
	const TRACKING_END_DELAY = 50

	function cancelPendingTrackingEnd() {
		if (trackingEndTimeoutId !== null) {
			clearTimeout(trackingEndTimeoutId)
			trackingEndTimeoutId = null
		}
	}

	function handleMouseEnter(e: MouseEvent) {
		mouseIsOver = true
		cancelPendingTrackingEnd()

		const currentTracked = options.getTrackedElement()
		if (!currentTracked) {
			trackToPosition(e)
			options.onScrubStart(node)
		} else if (currentTracked !== node) {
			trackToPosition(e)
			options.onScrubStart(node)
		}
	}

	function handleMouseLeave() {
		mouseIsOver = false
		if (options.getTrackedElement() === node && !trackUntilMouseUp) {
			cancelPendingTrackingEnd()
			trackingEndTimeoutId = setTimeout(() => {
				trackingEndTimeoutId = null
				if (!mouseIsOver && options.getTrackedElement() === node) {
					options.onScrubEnd()
				}
			}, TRACKING_END_DELAY)
		}
	}

	// --- Touch pointer handlers: horizontal scrub vs vertical scroll ---

	function handleTouchPointerDown(e: PointerEvent) {
		if (e.pointerType !== 'touch') return

		touchStartX = e.clientX
		touchStartY = e.clientY
		gestureDecided = false
		isScrubbing = false
		activePointerId = e.pointerId
	}

	function handleTouchPointerMove(e: PointerEvent) {
		if (e.pointerType !== 'touch') return
		if (activePointerId === null) return

		const deltaX = e.clientX - touchStartX
		const deltaY = e.clientY - touchStartY
		const absDeltaX = Math.abs(deltaX)
		const absDeltaY = Math.abs(deltaY)

		if (isScrubbing) {
			trackToPosition(e, true)
			// Lock scroll position
			document.documentElement.scrollTop = savedScrollTop
			document.body.scrollTop = savedScrollTop
			return
		}

		if (gestureDecided && !isScrubbing) {
			return // decided to scroll, let native handle it
		}

		if (!gestureDecided && (absDeltaX > GESTURE_THRESHOLD || absDeltaY > GESTURE_THRESHOLD)) {
			gestureDecided = true

			if (absDeltaX > absDeltaY) {
				// Horizontal = scrubbing
				isScrubbing = true
				// Capture scroll position NOW (not at pointerdown) to avoid iOS momentum drift
				savedScrollTop = document.documentElement.scrollTop || document.body.scrollTop
				node.style.touchAction = 'none'
				node.setPointerCapture(e.pointerId)
				trackToPosition(e, true)
				options.onScrubStart(node)
			} else {
				// Vertical = scrolling
				isScrubbing = false
				activePointerId = null
			}
		}
	}

	function handleTouchPointerUp(e: PointerEvent) {
		if (e.pointerType !== 'touch') return

		if (isScrubbing) {
			// Cancel any pending RAF update
			if (rafId !== null) {
				cancelAnimationFrame(rafId)
				rafId = null
			}
			// Apply final position immediately
			if (pendingPosition !== null) {
				options.onScrubChange(pendingPosition)
				pendingPosition = null
			}
			options.onScrubEnd()
			node.style.touchAction = '' // Restore native scroll
		}

		gestureDecided = false
		isScrubbing = false
		activePointerId = null
	}

	// --- Event binding with AbortController for clean teardown ---
	const abortController = new AbortController()
	const { signal } = abortController

	window.addEventListener('pointermove', handlePointerMove, { signal })
	node.addEventListener('pointerdown', handlePointerDown, { signal })
	window.addEventListener('pointerup', handlePointerUp, { signal })
	node.addEventListener('mouseenter', handleMouseEnter, { signal })
	node.addEventListener('mouseleave', handleMouseLeave, { signal })

	// Touch pointer events
	node.addEventListener('pointerdown', handleTouchPointerDown, { signal })
	window.addEventListener('pointermove', handleTouchPointerMove, { signal })
	window.addEventListener('pointerup', handleTouchPointerUp, { signal })

	return {
		destroy() {
			abortController.abort()
			cancelPendingTrackingEnd()
			if (rafId !== null) {
				cancelAnimationFrame(rafId)
				rafId = null
			}
		},
	}
}
