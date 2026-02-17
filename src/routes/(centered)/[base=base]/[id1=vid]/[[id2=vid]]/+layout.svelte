<script lang="ts">
	import type { GoogleFormDocument } from '$lib/google-document-util/types'

	import type { SwiperContainer } from 'swiper/element/bundle'
	import { register } from 'swiper/element/bundle'

	import * as linkify from 'linkifyjs'

	import { pipe } from 'fp-ts/lib/function.js'

	import { stringify } from '$lib/util.js'

	import {
		addIndex,
		adjustColumnLengths,
		adjustColumnTypes,
		collectExtraDance,
		extractColumnHeaders,
		hidePhoneNumbers,
		makeRaw,
		padNumericRenders,
		renderRelativeTimes,
		stripEmptyColumns,
		stripEmptyRows,
	} from '$lib/google-document-util/sheet-data-pipeline.svelte.js'
	import { onDestroy, onMount, tick } from 'svelte'
	import { afterNavigate, goto } from '$app/navigation'
	import { gg } from '@leftium/gg'
	import { linkifyRelative, makeTagFunctionMd } from '$lib/tag-functions/markdown.js'

	// @ts-expect-error
	import markdownitDeflist from 'markdown-it-deflist'
	import MarkdownItGitHubAlerts from 'markdown-it-github-alerts'

	import 'markdown-it-github-alerts/styles/github-colors-light.css'
	import 'markdown-it-github-alerts/styles/github-colors-dark-media.css'
	import 'markdown-it-github-alerts/styles/github-base.css'

	import { page } from '$app/state'
	import { DOCUMENT_URL_REGEX } from '$lib/google-document-util/url-id.js'
	import GoogleForm from '$lib/components/GoogleForm.svelte'
	import Sheet from '$lib/components/Sheet.svelte'
	import Confetti from 'svelte-confetti'
	import { confetti } from '@neoconfetti/svelte'
	import NotificationBox from '$lib/components/NotificationBox.svelte'
	import { slide } from 'svelte/transition'

	const md = makeTagFunctionMd({ html: true, linkify: true, typographer: true, breaks: true }, [
		[markdownitDeflist],
		[MarkdownItGitHubAlerts],
		[linkifyRelative],
	])

	let { params, data, children } = $props()

	let swiperContainer = $state<SwiperContainer>()
	let activeTab = $state(params.tid)
	let notificationBoxHidden = $state(false)

	let tid = $state(params.tid)

	const successParty = page.url.searchParams.has('yay')

	const raw = makeRaw(data.sheet)

	const finalData = pipe(
		raw,
		extractColumnHeaders,
		stripEmptyRows,
		addIndex,
		adjustColumnTypes,
		adjustColumnLengths,
		stripEmptyColumns,
		hidePhoneNumbers,
		padNumericRenders,
		//ghostLeadingZeros,
		//appendColumnLabel,
		renderRelativeTimes,
		collectExtraDance,
	)

	let skipNextSlideChange = false

	function slideToTab(tid: string, { updateHistory = true } = {}) {
		const swiper = swiperContainer?.swiper
		if (!swiper) return

		const slideIndex = swiper.slides.findIndex((s) => s.dataset.tid === tid)
		if (slideIndex < 0) {
			activeTab = tid
			return
		}

		// only slide if we’re not already there
		if (swiper.activeIndex !== slideIndex) {
			// if we're *not* pushing history, suppress our slideChange→goto
			if (!updateHistory) {
				skipNextSlideChange = true
			}
			swiper.slideTo(slideIndex)
		}
		activeTab = tid

		// after sliding, update URL *only* on user-driven calls
		if (updateHistory) {
			goto(`/${params.base}/${params.id1}/${tid}`, {
				replaceState: false,
				noScroll: true,
				keepFocus: true,
			})
		}
	}

	register()

	let hasJS = $state(false)
	onMount(async () => {
		// Set JS flag, then wait for swiper-js slides to become unhidden:
		hasJS = true
		await tick()

		// 1. Build an array of tab IDs in the order you render slides
		const orderedTabs = Object.entries(data.navTabs)
			.filter(([key, tab]) => tab.icon) // only include tabs with icons
			.map(([key]) => key)

		// 2. Find the index of the current tid
		const initialSlide = orderedTabs.indexOf(tid || 'info')

		const swiperParams = {
			spaceBetween: 4,
			autoHeight: true,
			// Prevent role=group attributes interfering with PicoCSS.
			a11y: {
				enabled: false,
			},
			// ✅ Allow touch swipe on mobile
			simulateTouch: window.matchMedia('(pointer: coarse)').matches,

			// ✅ Prevent default touch behavior only on desktop
			touchStartPreventDefault: !window.matchMedia('(pointer: coarse)').matches,

			initialSlide,
		}

		if (swiperContainer) {
			Object.assign(swiperContainer, swiperParams)
			swiperContainer.initialize()

			const { swiper } = swiperContainer
			swiper.on('slideChange', () => {
				const tid = swiper.slides[swiper.activeIndex].dataset.tid
				if (!tid || activeTab === tid) return

				if (skipNextSlideChange) {
					// we just called slideToTab(programmatic), so skip the goto
					skipNextSlideChange = false
				} else {
					// a real user swipe
					slideToTab(tid)
				}
			})

			// Re-measure slide height when group registration adds/removes members
			swiperContainer.addEventListener('groupresize', callSwiperUpdateAutoHeight)
		}
	})

	onDestroy(() => {
		swiperContainer?.removeEventListener('groupresize', callSwiperUpdateAutoHeight)
		swiperContainer?.swiper?.destroy(true, true)
	})

	afterNavigate(({ to, type }) => {
		// 1) skip if this was our own programmatic slideToTab
		if (skipNextSlideChange) {
			skipNextSlideChange = false
			return
		}

		// 2) only respond to link, goto, or popstate navigations
		if (type !== 'link' && type !== 'goto' && type !== 'popstate') return

		// 3) extract the tab ID and slide WITHOUT touching history
		const tid = to?.url.pathname.split('/').pop()
		if (tid && ['info', 'form', 'list', 'raw', 'dev'].includes(tid)) {
			slideToTab(tid, { updateHistory: false })
		}
	})

	function internalizeLinks(markdown: string): string {
		const lines = markdown.split(/\r?\n/)
		const out: string[] = []
		let i = 0

		const basepath = page.url.pathname.split('/')[1] || '7'

		while (i < lines.length) {
			const line = lines[i++]

			const links = linkify.find(line)
			if (links.length) {
				const href = links[0].href

				let matches = href.match(DOCUMENT_URL_REGEX.g) || href.match(DOCUMENT_URL_REGEX.f)
				if (matches) {
					const documentId = matches.groups?.id || ''
					const prefix = documentId.length > 20 ? 'f' : 'g'
					const id = `${prefix}.${documentId}`

					let internalLink = `/${basepath}/${id}`

					// TODO: Remove hardcoded rules:
					if (/home/i.test(line)) {
						internalLink = `/base/${id}`
					}
					if (/오시는 길|수칙/i.test(line)) {
						internalLink = `/base/${id}`
					}

					if (/신청/.test(line)) {
						internalLink += '/form'
						if (
							data.form.isOk() &&
							[data.form.value.documentId, data.form.value.veneerId].includes(id)
						) {
							internalLink = './form'
						}
						const count = finalData.extra.count
						const callout = !count
							? ''
							: `<div class="tooltip">${count.total}명 신청 💃${count.follows} 🕺${count.leaders}</div>`
						const button = `<a href="${internalLink}" role=button class=outline>신청 ➡️</a>`
						out.push(callout)
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
							internalLink = './list'
						}
						const button = `<a href="${internalLink}" role=button class=outline">확인 👀</a>`
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
</script>

<article>
	<header>
		<fi-spacer></fi-spacer>

		<h1 class="title">{data.title}</h1>

		{#if data.numTabs > 1}
			<nav-buttons role="group">
				{#each Object.entries(data.navTabs) as [tid, { name, icon, error }]}
					{#if icon}
						<a
							class={['glass', { active: activeTab === tid }]}
							onclick={(e) => {
								e.preventDefault()
								slideToTab(tid)
							}}
							href={`/${params.base}/${params.id1}/${tid}`}
						>
							{icon}
							{name}{error ? ' ⚠️' : ''}
						</a>
					{/if}
				{/each}
			</nav-buttons>
		{/if}
	</header>

	<main>
		{#if (page.form || successParty) && !notificationBoxHidden}
			{@const form = page.form}
			{@const level = successParty ? 'success' : 'warning'}
			{@const subject = successParty ? 'Successfully signed up!' : 'Sorry! There was a problem:'}
			{@const message = successParty ? '' : `${form?.status}: ${form?.statusText}`}

			<wrap-confetti>
				<div use:confetti={{ duration: 10_000, force: 0.5, stageHeight: 1600 }}></div>
			</wrap-confetti>

			<pre hidden>{stringify({ form })}</pre>

			<div transition:slide={{ delay: 300 }}>
				<NotificationBox {level} bind:notificationBoxHidden>
					{#snippet title()}
						{subject}
					{/snippet}

					{#snippet description()}
						{@html message}
					{/snippet}

					{#snippet confetti()}
						<wrap-confetti>
							<Confetti
								x={[-4, 4]}
								y={[0, 0]}
								delay={[0, 9000]}
								infinite
								duration={9000}
								amount={500}
								fallDistance="1600px"
							></Confetti>
						</wrap-confetti>
					{/snippet}
				</NotificationBox>
			</div>
		{/if}

		<swiper-container init="false" bind:this={swiperContainer}>
			{#if data.navTabs.info.icon}
				<swiper-slide data-tid="info" hidden={!hasJS && tid !== 'info'}>
					{#if data.info}
						<content class="markdown">{@html md`${internalizeLinks(data.info)}`}</content>
						<pre hidden>{data.info}</pre>
					{/if}
				</swiper-slide>
			{/if}

			{#if data.navTabs.form.icon}
				<swiper-slide data-tid="form" hidden={!hasJS && tid !== 'form'}>
					{#if data.form.isOk()}
						{#if !data.navTabs.info.icon}
							<content class="markdown">
								{@html md`${internalizeLinks(data.info)}`}
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
				<swiper-slide data-tid="list" hidden={!hasJS && tid !== 'list'}>
					{#if data.sheet.isOk()}
						<Sheet data={finalData} onToggle={callSwiperUpdateAutoHeight}></Sheet>

						<pre hidden>{stringify(data.sheet.value)}}</pre>
					{:else}
						<pre>{stringify(data.sheet.error)}</pre>
					{/if}
				</swiper-slide>
			{/if}

			{#if data.navTabs.dev.icon}
				<swiper-slide data-tid="raw" hidden={!hasJS && tid !== 'raw'}>
					{#if data.sheet.isOk()}
						<Sheet data={raw} onToggle={callSwiperUpdateAutoHeight}></Sheet>
					{/if}
					<pre hidden>{stringify(raw)}</pre>
				</swiper-slide>

				<swiper-slide data-tid="dev" hidden={!hasJS && tid !== 'dev'}>
					<pre>params: {stringify(params)}</pre>
					<pre>finalData: {stringify(finalData)}</pre>
					<pre>raw: {stringify(raw)}</pre>
					<pre>data: {stringify(data)}</pre>
				</swiper-slide>
			{/if}
		</swiper-container>
	</main>
	<footer>
		<content> </content>
	</footer>
</article>

{#if false}
	<hr />
	{@render children()}

	<hr />

	<pre>params = {stringify(params)}</pre>
	<pre>finalData = {stringify(finalData)}</pre>
	<pre>data = {stringify(data)}</pre>
{/if}

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
		&:has(button:focus) &:has(a:focus) {
			box-shadow: none;
		}

		button,
		a {
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
			//background-color: #8882;
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

				overflow: clip;

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
				margin-bottom: $size-2;

				font-size: $font-size-4;
				font-weight: $font-weight-7;
			}

			img {
				border-radius: $size-9;
				//border-bottom-left-radius: $size-1;
				//border-top-right-radius: $size-1;
				border-top-left-radius: $size-2;
				border-bottom-right-radius: $size-2;
			}

			// Render definition lists as simple table:
			dl {
				display: grid;
				grid-template-columns: max-content 1fr;
				max-width: 100%;
				width: fit-content;
				margin-block: $size-2;
				margin-inline: auto;
				padding: 0;
				padding-inline: $size-3;

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

	:global {
		// Based on: https://css-generators.com/tooltip-speech-bubble
		/* HTML: <div class="tooltip">This is a Tooltip with a border and with a border radius. Border and background have a solid coloration</div> */
		.tooltip {
			//color: #fff;
			font-size: $font-size-2;
			//font-weight: $font-weight-9;
			//max-width: 22ch;
			width: fit-content;
			text-align: center;

			margin: auto;
			margin-bottom: $size-2;
		}
		.tooltip {
			/* triangle dimension */
			--a: 90deg; /* angle */
			--h: #{$size-2}; /* height */

			--p: 50%; /* triangle position (0%:left 100%:right) */
			--r: #{$size-2}; /* the radius */
			--b: 2px; /* border width  */
			--c1: color-mix(in srgb, var(--pico-color) 60%, transparent);
			--c2: var(--pico-card-sectioning-background-color);

			padding: $size-1 $size-3;
			border-radius: var(--r) var(--r) min(var(--r), 100% - var(--p) - var(--h) * tan(var(--a) / 2))
				min(var(--r), var(--p) - var(--h) * tan(var(--a) / 2)) / var(--r);
			clip-path: polygon(
				0 100%,
				0 0,
				100% 0,
				100% 100%,
				min(100%, var(--p) + var(--h) * tan(var(--a) / 2)) 100%,
				var(--p) calc(100% + var(--h)),
				max(0%, var(--p) - var(--h) * tan(var(--a) / 2)) 100%
			);
			background: var(--c1);
			border-image: conic-gradient(var(--c1) 0 0) fill 0 / var(--r)
				max(0%, 100% - var(--p) - var(--h) * tan(var(--a) / 2)) 0
				max(0%, var(--p) - var(--h) * tan(var(--a) / 2)) / 0 0 var(--h) 0;
			position: relative;
		}
		.tooltip:before {
			content: '';
			position: absolute;
			z-index: -1;
			inset: 0;
			padding: var(--b);
			border-radius: inherit;
			clip-path: polygon(
				0 100%,
				0 0,
				100% 0,
				100% 100%,
				min(
						100% - var(--b),
						var(--p) + var(--h) * tan(var(--a) / 2) - var(--b) * tan(45deg - var(--a) / 4)
					)
					calc(100% - var(--b)),
				var(--p) calc(100% + var(--h) - var(--b) / sin(var(--a) / 2)),
				max(
						var(--b),
						var(--p) - var(--h) * tan(var(--a) / 2) + var(--b) * tan(45deg - var(--a) / 4)
					)
					calc(100% - var(--b))
			);
			background: var(--c2) content-box;
			border-image: conic-gradient(var(--c2) 0 0) fill 0 / var(--r)
				max(var(--b), 100% - var(--p) - var(--h) * tan(var(--a) / 2)) 0
				max(var(--b), var(--p) - var(--h) * tan(var(--a) / 2)) / 0 0 var(--h) 0;
		}
	}

	wrap-confetti {
		position: fixed;
		inset: 0;
		top: -50px;
		height: calc(50vh + 50px);

		z-index: 9999;

		display: flex;
		justify-content: center;
		overflow: visible;
		pointer-events: none;
	}
</style>
