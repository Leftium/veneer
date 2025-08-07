<script lang="ts">
	// Based on: https://codepen.io/alvarotrigo/pen/OJELWoM

	import type { Snippet } from 'svelte'
	import { fade } from 'svelte/transition'

	type NotificationLevel = 'info' | 'success' | 'warning'

	interface Props {
		notificationBoxHidden: boolean
		level?: NotificationLevel
		title: Snippet
		description?: Snippet
	}

	let {
		notificationBoxHidden = $bindable(false),
		level = 'info',
		title,
		description,
	}: Props = $props()

	function onclick() {
		notificationBoxHidden = true
	}
</script>

{#if !notificationBoxHidden}
	<d-wrap class={level} transition:fade|global>
		<d-card>
			<d-accent><s-icon></s-icon></d-accent>
			<d-body>
				<d-subject>
					<div>{@render title()}</div>
					<s-icon {onclick} class="close" role="none"></s-icon>
				</d-subject>
				<p>{@render description?.()}</p>
			</d-body>
		</d-card>
	</d-wrap>
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
	}

	d-card {
		display: flex;
		align-items: center;

		max-width: op.$size-content-2;
		margin: op.$size-1;
		padding: 0;

		background-color: var(--pico-card-sectioning-background-color);

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
		color: var(--pico-background-color);
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
</style>
