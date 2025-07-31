<script lang="ts">
	// import function to register Swiper custom elements
	import type { SwiperContainer } from 'swiper/element/bundle'
	import { register } from 'swiper/element/bundle'

	import { stringify } from '$lib/util'
	import { onMount } from 'svelte'
	import Sheet from './Sheet.svelte'
	import type { GoogleSheet, GoogleFormDocument } from './types'

	// @ts-expect-error
	import markdownitDeflist from 'markdown-it-deflist'
	import { makeTagFunctionMd } from '$lib/tag-functions/markdown.js'
	import { urlFromDocumentId } from '$lib/google-document-util/url-id'
	import GoogleForm from './GoogleForm.svelte'
	const md = makeTagFunctionMd({ html: true, linkify: true, typographer: true, breaks: true }, [
		[markdownitDeflist],
	])

	let { params, data } = $props()

	let swiperContainer = $state<SwiperContainer>()
	let activeHash = $state('info')

	register()

	function makeSlideToHash(hash: string) {
		return function () {
			if (swiperContainer) {
				const slideIndex = swiperContainer.swiper.slides.findIndex(
					(slide) => slide.dataset.hash === hash,
				)
				swiperContainer.swiper.slideTo(slideIndex)
				///swiperContainer.scrollIntoView()
				activeHash = hash
			}
		}
	}

	function callSwiperUpdateAutoHeight() {
		const endTime = performance.now() + 1000

		function tick(currentTime: number) {
			if (currentTime < endTime) {
				if (swiperContainer) {
					swiperContainer.swiper.updateAutoHeight()
				}
				requestAnimationFrame(tick)
			}
		}
		requestAnimationFrame(tick)
	}

	onMount(() => {
		const swiperParams = {
			spaceBetween: 4,
			hashNavigation: {
				replaceState: true, // Prevents adding to history and scroll jump
			},
			autoHeight: true,
		}

		if (swiperContainer) {
			Object.assign(swiperContainer, swiperParams)
			swiperContainer.initialize()
			document.querySelectorAll('swiper-slide[role="group"]').forEach((el) => {
				el.removeAttribute('role')
			})
		}
	})
</script>

<svelte:head>
	<title>{data.title}</title>
</svelte:head>

<article>
	<header>
		<h1 class="title">{data.title}</h1>
	</header>
	<main>
		{#if data.numTabs > 1}
			<nav>
				<div role="group">
					{#if data.visibleTabs.info}
						<button
							class={['outline', activeHash === 'info' && 'active']}
							onclick={makeSlideToHash('info')}
						>
							ℹ️ Info
							<span class={['status']}>{data.form.isErr() ? '⚠️' : ''}</span>
						</button>
					{/if}

					{#if data.visibleTabs.form}
						<button
							class={['outline', activeHash === 'form' && 'active']}
							onclick={makeSlideToHash('form')}
						>
							✍ Form
							<span class={['status']}>{data.form.isErr() ? '⚠️' : ''}</span>
						</button>
					{/if}

					{#if data.visibleTabs.responses}
						<button
							class={['outline', activeHash === 'responses' && 'active']}
							onclick={makeSlideToHash('responses')}
						>
							📋 Responses
							<span class={['status']}>{data.sheet.isErr() ? '⚠️' : ''}</span>
						</button>
					{/if}

					{#if data.visibleTabs.dev}
						<button
							class={['outline', activeHash === 'dev' && 'active']}
							onclick={makeSlideToHash('dev')}
						>
							🔧 Dev
							<span class={['status']}></span>
						</button>
					{/if}
				</div>
			</nav>
		{/if}

		<swiper-container init="false" bind:this={swiperContainer}>
			{#if data.visibleTabs.info}
				<swiper-slide data-hash="info">
					{#if data.info}
						<div class="markdown">{@html md`${data.info}`}</div>
						<pre hidden>{data.info}</pre>
					{/if}
				</swiper-slide>
			{/if}

			{#if data.visibleTabs.form}
				<swiper-slide data-hash="form">
					{#if data.form.isOk()}
						{@const link = urlFromDocumentId(data.form.value.documentId)}

						{#if !data.visibleTabs.info}
							<div class="markdown">{@html md`${data.info}`}</div>
						{/if}

						<GoogleForm googleForm={data.form.value as GoogleFormDocument}></GoogleForm>

						<center><a href={link}>Original Google Form</a> </center>
						<pre hidden>{stringify(data.form.value)}</pre>
					{:else}
						<pre>{stringify(data.form.error)}</pre>
					{/if}
				</swiper-slide>
			{/if}

			{#if data.visibleTabs.responses}
				<swiper-slide data-hash="responses">
					{#if data.sheet.isOk()}
						{@const link = urlFromDocumentId(data.sheet.value.documentId, false)}
						<Sheet
							googleSheet={data.sheet.value as GoogleSheet}
							onToggle={callSwiperUpdateAutoHeight}
						></Sheet>

						<center><a href={link}>Original Google Sheet</a> </center>

						<pre hidden>{stringify(data.sheet.value)}}</pre>
					{:else}
						<pre>{stringify(data.sheet.error)}</pre>
					{/if}
				</swiper-slide>
			{/if}

			{#if data.visibleTabs.dev}
				<swiper-slide data-hash="dev">
					<pre>params: {stringify(params)}</pre>
					<pre>data: {stringify(data)}</pre>
				</swiper-slide>
			{/if}
		</swiper-container>
	</main>
	<footer>
		{@html md`
			- [Home](/)
			- [Source code](https://github.com/Leftium/veneer)
			- Made by [Leftium](https://leftium.com/)
			- See [other projects](https://github.com/Leftium?tab=repositories&type=source)
		`}
	</footer>
</article>

<style lang="scss">
	@use 'open-props-scss' as *;

	article {
		padding: 0;
		margin-block: 0;

		h1 {
			margin-bottom: 0;
			text-align: center;
		}

		footer,
		header {
			margin: 0;
		}

		footer {
			height: $size-13;
		}
	}

	main {
		.active {
			background-color: #8882;
		}

		.status {
			display: inline-block;
			width: 1em;
			height: 1em;
			background-size: 1em auto;
			background-repeat: no-repeat;
		}

		div {
			margin: 0;
		}

		swiper-container {
			//width: 100%;
			///overflow: hidden;

			swiper-slide {
				display: block;
				///max-height: 100vh; // define scrollable block
				margin-bottom: 0;
				///background-color: #00f6;

				overflow: auto;

				pre {
					width: 100%;
					overflow: visible;
					margin-bottom: 0;
				}
			}
		}
	}

	.markdown {
		///border: 1px solid blue;

		max-width: $size-15;
		margin: $size-3 auto;

		:global(h1) {
			text-align: center;
			margin-bottom: 0;
		}
		:global(dl) {
			///border: 1px solid green;
			display: grid;
			grid-template-columns: max-content 1fr;
			max-width: 100%; // prevents overflow
			width: fit-content; // shrink-to-fit content

			margin-inline: auto;

			padding: $size-3;
		}

		:global(dt),
		:global(dd) {
			margin: 0;
			padding: $size-2 0;
		}

		:global(dt) {
			font-weight: $font-weight-7;
			text-align: right;
			align-self: start;
			padding-right: $size-3;
		}

		// Suppress border on first dt; on dd after first dt
		:global(dt:first-of-type),
		:global(dt:first-of-type) + :global(dd) {
			border-top: none;
		}

		:global(dd) {
			grid-column: 2;
		}

		// Only the first dd after each dt gets a border
		:global(dt),
		:global(dt) + :global(dd) {
			border-top: 1px solid #dcdcdc;
		}
	}

	nav {
		overflow: hidden;
		max-width: 100%;
		white-space: nowrap;

		div[role='group'] {
			display: flex;
			gap: 0; // Remove spacing between buttons
			flex-wrap: nowrap;

			button {
				flex: 1 1 auto;
				min-width: 0;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
				text-align: center; // Center the button text
				display: flex;
				align-items: center;
				justify-content: center;
				padding-inline: $size-2;

				.status {
					margin-left: $size-1; // Ensure spacing from text
					flex-shrink: 0;
				}
			}
		}
	}
</style>
