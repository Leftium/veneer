<script lang="ts">
	// Based on: https://codepen.io/alvarotrigo/pen/OJELWoM

	import { type Snippet } from 'svelte'
	import { fade } from 'svelte/transition'

	type NotificationLevel = 'info' | 'success' | 'warning'

	interface Props {
		notificationBoxHidden: boolean
		level?: NotificationLevel
		title: Snippet
		description?: Snippet
		confetti?: Snippet
	}

	let {
		notificationBoxHidden = $bindable(false),
		level = 'info',
		title,
		description,
		confetti,
	}: Props = $props()

	function onclick(e: Event) {
		e.preventDefault()
		notificationBoxHidden = true
	}
</script>

{#if !notificationBoxHidden}
	<div class="notification-wrapper">
		<input type="checkbox" class="vis-toggle" id="dismiss-toggle" hidden />

		{#if level === 'success'}
			<wrap-confetti>
				{@render confetti?.()}
			</wrap-confetti>
		{/if}

		<d-wrap class={level} transition:fade|global>
			<d-card>
				<d-accent><s-icon></s-icon></d-accent>
				<d-body>
					<d-subject>
						<div>{@render title()}</div>

						<label {onclick} for="dismiss-toggle" class="close-icon" role="none">
							<s-icon class="close"></s-icon>
						</label>
					</d-subject>
					<p>{@render description?.()}</p>
				</d-body>
			</d-card>
		</d-wrap>
	</div>
{/if}

<style lang="scss">
	@use 'open-props-scss' as op;

	$subject-font-size: op.$font-size-2;

	.info {
		--border-color: #3286e9;
	}

	.success {
		--border-color: #49d761;
	}

	.warning {
		--border-color: #fdc220;
	}

	/* success */
	d-wrap {
		display: grid;
		justify-content: center;
		margin: op.$size-3;
		margin-top: op.$size-2;
		overflow: hidden;
		max-height: 200px; // A sufficiently large initial max-height for the notification box
	}

	d-card {
		display: flex;
		align-items: center;

		max-width: op.$size-content-2;
		margin: op.$size-1;
		padding: 0;

		background-color: var(--app-card-section-bg);

		border: 1px solid var(--border-color);
		border-radius: op.$size-1;

		box-shadow: rgba(149, 157, 165, 25%) 0px 8px 24px;

		column-gap: op.$size-2;
	}

	d-subject {
		display: flex;
		align-items: center;
		justify-content: space-between;
		column-gap: op.$size-2;

		:first-child {
			font-size: $subject-font-size;
		}

		label {
			align-self: end;
			padding: 0;
			margin: 0;
			border: none;
		}
	}

	d-body {
		margin-right: op.$size-2;
		padding-block: op.$size-2;
		flex-grow: 1;
	}

	p {
		margin: 0;
		color: #909092;
	}

	d-accent {
		height: 100%;
		align-self: center;
		align-content: center;

		padding-inline: op.$size-1;

		font-size: $subject-font-size;
		color: var(--app-background-color);
		background-color: var(--border-color);
	}

	s-icon {
		display: inline-block;
		width: 1em;
		aspect-ratio: 1;

		margin: 0 0.05em 0 0.1em;
		vertical-align: -0.1em;

		background-color: currentColor;

		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;

		&.close {
			font-size: $subject-font-size;
			color: #c3c2c7;
			cursor: pointer;
		}
	}

	.info s-icon {
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath fill='%23000' d='M256 512a256 256 0 1 0 0-512a256 256 0 1 0 0 512m-32-352a32 32 0 1 1 64 0a32 32 0 1 1-64 0m-8 64h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24h-80c-13.3 0-24-10.7-24-24s10.7-24 24-24h24v-64h-24c-13.3 0-24-10.7-24-24s10.7-24 24-24'/%3E%3C/svg%3E");

		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
	}

	.success s-icon {
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath fill='%23000' d='M256 512a256 256 0 1 0 0-512a256 256 0 1 0 0 512m113-303L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z'/%3E%3C/svg%3E");
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
	}

	.warning s-icon {
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath fill='%23000' d='M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7.2 40.1S486.3 480 472 480H40c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8.2-40.1l216-368C228.7 39.5 241.8 32 256 32m0 128c-13.3 0-24 10.7-24 24v112c0 13.3 10.7 24 24 24s24-10.7 24-24V184c0-13.3-10.7-24-24-24m32 224a32 32 0 1 0-64 0a32 32 0 1 0 64 0'/%3E%3C/svg%3E");
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
	}

	s-icon.close {
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 384 512'%3E%3Cpath fill='%23000' d='M55.1 73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L147.2 256L9.9 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l137.3-137.4l137.4 137.3c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.8 256l137.3-137.4c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192.5 210.7z'/%3E%3C/svg%3E");
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
	}

	// CSS variables for animation timing
	:root {
		--notification-box-exit-duration: 500ms; // Notification box fades/slides out
		--parent-collapse-duration: 500ms; // Parent wrapper collapses
		--parent-collapse-delay: 0s; // Delay before parent collapse starts
	}

	// Keyframes for just fading out confetti
	@keyframes fadeOutConfetti {
		0% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			visibility: hidden; // Hide completely when faded
		}
	}

	// Keyframes for the notification box (d-wrap)
	@keyframes notificationBoxExit {
		0% {
			opacity: 1;
			transform: translateY(0);
			max-height: 200px; /* Keep initial max-height */
		}
		80% {
			// Fade out and slide up significantly
			opacity: 0;
			transform: translateY(-50px);
			max-height: 200px; /* Still maintains height during fade/slide */
		}
		100% {
			opacity: 0;
			transform: translateY(-50px);
			max-height: 0; /* NEW: Collapse height to remove space */
			margin-top: 0; /* NEW: Collapse margins */
			margin-bottom: 0; /* NEW: Collapse margins */
			padding: 0; /* NEW: Collapse padding */
			visibility: hidden; // Hide completely
		}
	}

	// Keyframes for the parent element (notification-wrapper)
	@keyframes collapseParent {
		0% {
			max-height: 300px; /* Initial max-height for the wrapper */
			padding-block: var(--op-size-3); // Retain original padding for wrapper
		}
		100% {
			max-height: 0; /* Collapse the parent */
			padding-block: 0; // Collapse padding
			margin-block: 0; // Collapse margins
			visibility: hidden; // Hide completely
		}
	}

	// Notification Wrapper styles for animation
	.notification-wrapper {
		max-height: 300px; // Initial max-height for the wrapper itself (needs to be large enough)
		overflow: hidden; // Important for parent collapse
		padding-block: var(--op-size-3); // This will be animated too
		// DELETED: Transition resets. Animations will control properties directly.
	}

	// Styles for dismissal animation
	:global {
		// When checkbox is checked:
		.vis-toggle:checked ~ d-wrap {
			animation: notificationBoxExit var(--notification-box-exit-duration) ease-out forwards;
		}

		.vis-toggle:checked ~ wrap-confetti {
			animation: fadeOutConfetti var(--notification-box-exit-duration) ease-out forwards;
		}

		// Animate the parent wrapper after a delay
		// The `notification-wrapper` itself is the one with `max-height` for overall collapse.
		.vis-toggle:checked ~ .notification-wrapper {
			animation: collapseParent var(--parent-collapse-duration) ease-in-out forwards;
			animation-delay: calc(var(--notification-box-exit-duration) + var(--parent-collapse-delay));
		}
	}
</style>
