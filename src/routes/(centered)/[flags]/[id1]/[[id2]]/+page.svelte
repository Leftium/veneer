<script lang="ts">
	// import function to register Swiper custom elements
	import type { SwiperContainer } from 'swiper/element/bundle'
	import { register } from 'swiper/element/bundle'

	import { stringify } from '$lib/util'
	import { onMount } from 'svelte'
	import Sheet from './Sheet.svelte'
	import type { GoogleSheet, GoogleFormDocument } from '$lib/google-document-util/types'

	import * as linkify from 'linkifyjs'

	// @ts-expect-error
	import markdownitDeflist from 'markdown-it-deflist'
	import { linkifyRelative, makeTagFunctionMd } from '$lib/tag-functions/markdown.js'
	import { DOCUMENT_URL_REGEX, urlFromVeneerId } from '$lib/google-document-util/url-id'
	import GoogleForm from './GoogleForm.svelte'
	import { undent } from '$lib/tag-functions/undent'
	import { linkListifyDefinitionList } from '$lib/markdown/dl-to-link-list'
	import { page } from '$app/state'
	import { gg } from '@leftium/gg'

	const md = makeTagFunctionMd({ html: true, linkify: true, typographer: true, breaks: true }, [
		[markdownitDeflist],
		[linkifyRelative],
	])

	let { params, data } = $props()

	let swiperContainer = $state<SwiperContainer>()
	let activeHash = $state('info')

	let sourceUrlForm = $derived(
		data.form.isOk() ? urlFromVeneerId(data.form.value.documentId, false) : '',
	)
	let sourceUrlSheet = $derived(
		data.sheet.isOk() ? urlFromVeneerId(data.sheet.value.documentId, false) : '',
	)

	let footerSources = $derived(
		!sourceUrlForm && !sourceUrlSheet
			? ''
			: `
# Source Documents
<div>

${!sourceUrlForm ? '' : `Google Form\n~ ${sourceUrlForm}`}
${!sourceUrlSheet ? '' : `Google Sheet\n~ ${sourceUrlSheet}`}
`,
	)

	let standardFooter = $derived(undent`
		# Powered by Veneer

		<div>

		Home
		~ ${page.url.origin}

		Source code
		~ https://github.com/Leftium/veneer

		Made by Leftium
		~ https://leftium.com

		See other projects
		~ https://github.com/Leftium?tab=repositories&type=source
	`)

	register()

	import { goto } from '$app/navigation'

	function slideToHash(hash: string) {
		hash = hash.replace('#', '')
		if (swiperContainer) {
			const slideIndex = swiperContainer.swiper.slides.findIndex(
				(slide) => slide.dataset.hash === hash,
			)
			swiperContainer.swiper.slideTo(slideIndex)
			activeHash = hash
		}
	}

	function makeSlideToHash(hash: string) {
		return function () {
			slideToHash(hash)
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
			autoHeight: true,
		}

		if (swiperContainer) {
			Object.assign(swiperContainer, swiperParams)
			swiperContainer.initialize()
			document.querySelectorAll('swiper-slide[role="group"]').forEach((el) => {
				el.removeAttribute('role')
			})

			const swiper = swiperContainer.swiper
			swiper.on('slideChange', () => {
				gg('slideChange')
				// Assuming each slide has <div class="swiper-slide" data-hash="slide-2">
				const currentSlide = swiper.slides[swiper.activeIndex]
				const hash = currentSlide.getAttribute('data-hash') ?? swiper.activeIndex.toString()

				// Replace state so browser back/forward still works predictably
				goto(`#${hash}`, { replaceState: true, noScroll: true })
			})
		}
	})

	$effect(() => {
		// reading `$page` here auto-subscribes to changes
		slideToHash(page.url.hash)
	})

	function internalizeLinks(markdown: string): string {
		const lines = markdown.split(/\r?\n/)
		const out: string[] = []
		let i = 0

		const basepath = page.url.pathname.split('/')[1]

		while (i < lines.length) {
			const line = lines[i++]

			const links = linkify.find(line)
			if (links.length) {
				gg(line, links)
				const href = links[0].href

				let matches = href.match(DOCUMENT_URL_REGEX.g) || href.match(DOCUMENT_URL_REGEX.f)
				if (matches) {
					const documentId = matches.groups?.id || ''
					const prefix = documentId.length > 20 ? 'f' : 'g'
					const id = `${prefix}.${documentId}`

					let internalLink = `/${basepath}/${id}`

					// TODO: Remove hardcoded rules:
					if (/home/i.test(line)) {
						internalLink = `/7/${id}`
					}
					if (/오시는 길|수칙/i.test(line)) {
						internalLink = `/1/${id}`
					}

					if (/신청/.test(line)) {
						internalLink += '#form'
						if (
							data.form.isOk() &&
							[data.form.value.documentId, data.form.value.veneerId].includes(id)
						) {
							internalLink = '#form'
						}
						const button = `<a href="${internalLink}" role=button class=outline>신청 ➡️</a>`
						out.push(button)
						continue
					}

					out.push(line.replace(href, internalLink))
					continue
				}

				matches = href.match(DOCUMENT_URL_REGEX.s)
				if (matches) {
					const id = `s.${matches.groups?.id || ''}`

					let internalLink = `/${basepath}/${id}`

					if (/확인/.test(line)) {
						if (data.form.isOk() && data.sheet.isOk() && data.sheet.value.documentId === id) {
							internalLink = '#list'
						}
						const button = `<a href="${internalLink}" role=button class=outline>확인 👀</a>`
						out.push(button)
						continue
					}
					out.push(line.replace(href, internalLink))
					continue
				}
			}

			out.push(line)
		}
		return out.join('\n')
	}
</script>

<svelte:head>
	<title>{data.title}</title>
</svelte:head>

<article>
	<header>
		<fi-spacer></fi-spacer>

		<h1 class="title">{data.title}</h1>

		{#if data.numTabs > 1}
			<nav-buttons role="group">
				{#each Object.entries(data.navTabs) as [hash, { name, icon, error }]}
					{#if icon}
						<button
							class={['glass', { active: activeHash === hash }]}
							onclick={makeSlideToHash(hash)}
						>
							{icon}
							{name}{error ? ' ⚠️' : ''}
						</button>
					{/if}
				{/each}
			</nav-buttons>
		{/if}
	</header>
	<main>
		<swiper-container init="false" bind:this={swiperContainer}>
			{#if data.navTabs.info.icon}
				<swiper-slide data-hash="info">
					{#if data.info}
						<content class="markdown">{@html md`${internalizeLinks(data.info)}`}</content>
						<pre hidden>{data.info}</pre>
					{/if}
				</swiper-slide>
			{/if}

			{#if data.navTabs.form.icon}
				<swiper-slide data-hash="form">
					{#if data.form.isOk()}
						{#if !data.navTabs.info.icon}
							<content class="markdown">
								{@html md`${internalizeLinks(data.info)}`}
								<hr />
							</content>
						{/if}

						<content>
							<GoogleForm googleForm={data.form.value as GoogleFormDocument}></GoogleForm>
						</content>
						<pre hidden>{stringify(data.form.value)}</pre>
					{:else}
						<pre>{stringify(data.form.error)}</pre>
					{/if}
				</swiper-slide>
			{/if}

			{#if data.navTabs.list.icon}
				<swiper-slide data-hash="list">
					{#if data.sheet.isOk()}
						<Sheet
							googleSheet={data.sheet.value as GoogleSheet}
							onToggle={callSwiperUpdateAutoHeight}
						></Sheet>

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
		<content>
			{#each data.footers as footer}
				<section>{@html md`${internalizeLinks(linkListifyDefinitionList(footer))}`}</section>
			{/each}

			<section>{@html md`${linkListifyDefinitionList(footerSources)}`}</section>
			<section>{@html md`${linkListifyDefinitionList(standardFooter)}`}</section>
		</content>
	</footer>
</article>

<div hidden>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="0"
		height="0"
		style="position:absolute; overflow:hidden"
	>
		<defs>
			<filter id="glass-distortion" x="0%" y="0%" width="100%" height="100%">
				<feTurbulence
					type="fractalNoise"
					baseFrequency="0.008 0.008"
					numOctaves="2"
					seed="92"
					result="noise"
				/>
				<feGaussianBlur in="noise" stdDeviation="2" result="blurred" />
				<feDisplacementMap
					in="SourceGraphic"
					in2="blurred"
					scale="77"
					xChannelSelector="R"
					yChannelSelector="G"
				/>
			</filter>
		</defs>
	</svg>
</div>

<style lang="scss">
	@use 'open-props-scss' as *;

	article {
		padding: 0;
		margin-block: 0;

		h1 {
			margin-bottom: $size-2;
			text-align: center;
		}

		footer,
		header {
			margin: 0;
		}

		header {
			border-bottom: none;
		}

		footer {
			min-height: $size-13;
		}
	}

	nav-buttons {
		display: flex;
		justify-content: center;

		margin-bottom: $size-2;

		overflow: hidden;
		max-width: 100%;
		white-space: nowrap;

		&:focus-visible,
		&:has(button:focus) {
			box-shadow: none;
		}

		button {
			flex: 0 1 auto;
			min-width: 0;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			text-align: center; // Center the button text
			display: flex;
			align-items: center;
			justify-content: center;
			padding: $size-1 $size-4;

			background-color: rgba(255, 255, 255, 0%);

			&.active {
				background-color: rgba(255, 255, 255, 10%);
			}

			&:hover {
				background-color: rgba(255, 255, 255, 15%);
			}
		}
	}

	.glass {
		position: relative;

		isolation: isolate;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 0px 6px 24px rgba(0, 0, 0, 0.2);
		backdrop-filter: blur(1px);
		-webkit-backdrop-filter: blur(1px);
		border: 1px solid rgba(255, 255, 255, 0.3);
	}

	.glass::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 20;

		box-shadow: inset 0 0 20px -5px rgba(255, 255, 255, 0.6);
		background: rgba(255, 255, 255, 0.05);
	}

	.glass::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 10;

		backdrop-filter: blur(8px);
		filter: url(#glass-distortion);
		isolation: isolate;
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

	content {
		display: block;
		margin: auto;

		max-width: $size-content-2;
	}

	.markdown {
		margin-top: $size-2;
		:global {
			h1 {
				text-align: center;
			}

			a[role='button'] {
				width: 100%;
				margin-block: $size-1;
			}

			// Render definition lists as simple table:
			dl {
				display: grid;
				grid-template-columns: max-content 1fr;
				max-width: 100%;
				width: fit-content;
				margin-bottom: 0;
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

	header {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		//row-gap: $size-4;

		padding: 0;

		background-image: url(/dance_night.gif);
		background-size: cover;
		background-position: center;
		background-color: #0b4474;

		fi-spacer {
			height: 100px;
		}

		& * {
			color: white;
		}
	}

	footer {
		content {
			display: grid;
			grid-template-columns: repeat(
				auto-fit,
				minmax(calc(($size-content-2 - 2 * $size-3) / 3), 1fr)
			);
			grid-template-rows: repeat(20, auto);
			column-gap: $size-3;
		}

		:global {
			section {
				grid-row: span 2;
				display: grid;
				grid-template-rows: subgrid;
			}
			--pico-muted-color: color-mix(in srgb, var(--pico-color) 30%, transparent);

			:where(article, address, blockquote, dl, figure, form, ol, p, pre, table, ul)
				~ :is(h1, h2, h3, h4, h5, h6) {
				margin-top: $size-4;
			}

			h1 {
				grid-row: 1;
				align-self: end;
				margin-bottom: $size-1;

				color: var(--pico-muted-color);
				font-size: $font-size-1;
			}

			div {
				grid-row: 2;

				ul {
					padding: 0;
				}

				li {
					list-style: none; /* Removes the bullets */

					a {
						text-decoration: none; /* Removes underline */
						color: var(--pico-muted-color);

						&:hover {
							text-decoration: underline; /* Adds underline on hover */
						}
					}
				}
			}
		}
	}
</style>
