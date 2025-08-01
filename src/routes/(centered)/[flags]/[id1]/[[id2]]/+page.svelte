<script lang="ts">
	// import function to register Swiper custom elements
	import type { SwiperContainer } from 'swiper/element/bundle'
	import { register } from 'swiper/element/bundle'

	import { stringify } from '$lib/util'
	import { onMount } from 'svelte'
	import Sheet from './Sheet.svelte'
	import type { GoogleSheet, GoogleFormDocument } from '$lib/google-document-util/types'

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
					{#each Object.entries(data.navTabs) as [hash, { name, icon, error }]}
						{#if icon}
							<button
								class={['outline', { active: activeHash === hash }]}
								onclick={makeSlideToHash(hash)}
							>
								{icon} {name}{error ? ' ⚠️' : ''}
							</button>
						{/if}
					{/each}
				</div>
			</nav>
		{/if}

		<swiper-container init="false" bind:this={swiperContainer}>
			{#if data.navTabs.info.icon}
				<swiper-slide data-hash="info">
					{#if data.info}
						<div class="markdown">{@html md`${data.info}`}</div>
						<pre hidden>{data.info}</pre>
					{/if}
				</swiper-slide>
			{/if}

			{#if data.navTabs.form.icon}
				<swiper-slide data-hash="form">
					{#if data.form.isOk()}
						{@const link = urlFromDocumentId(data.form.value.documentId)}

						{#if !data.navTabs.info}
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

			{#if data.navTabs.responses.icon}
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

			{#if data.navTabs.dev.icon}
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

	nav {
		overflow: hidden;
		max-width: 100%;
		white-space: nowrap;

		div[role='group'] {
			display: flex;
			gap: 0; // Remove spacing between buttons
			flex-wrap: nowrap;
			margin: 0;

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
			}
		}
	}

	main {
		.active {
			background-color: #8882;
		}

		// This prevents a scrolling context from forming,
		// so the <body> can be the scrolling context for sticky elements inside <swiper-slide>.
		swiper-container::part(container) {
			overflow: visible !important;
		}

		swiper-container {
			overflow: clip;

			// Hide the now visible overflow with a mask:
			//mask-image: linear-gradient(to right, transparent 0%, black 0%, black 100%, transparent 100%);
			//mask-mode: alpha;

			//width: 100%;
			///overflow: hidden;

			swiper-slide {
				display: block;
				///max-height: 100vh; // define scrollable block
				margin-bottom: 0;
				///background-color: #00f6;

				///overflow: auto;

				pre {
					width: 100%;
					overflow: visible;
					margin-bottom: 0;
				}
			}
		}
	}

	.markdown {
		max-width: $size-15;
		margin: $size-3 auto;

		:global {
			h1 {
				text-align: center;
				margin-bottom: 0;
			}

			// Render definition lists as simple table:
			dl {
				display: grid;
				grid-template-columns: max-content 1fr;
				max-width: 100%;
				width: fit-content;
				margin-inline: auto;
				padding: $size-3;

				dt,
				dd {
					margin: 0;
					padding: $size-2 0;
				}

				dt {
					font-weight: $font-weight-7;
					text-align: right;
					align-self: start;
					padding-right: $size-3;
				}

				dt:first-of-type,
				dt:first-of-type + dd {
					border-top: none;
				}

				dd {
					grid-column: 2;
				}

				dt,
				dt + dd {
					border-top: 1px solid #dcdcdc;
				}
			}
		}
	}
</style>
