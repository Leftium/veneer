<script lang="ts">
	// import function to register Swiper custom elements
	import type { SwiperContainer } from 'swiper/element/bundle'
	import { register } from 'swiper/element/bundle'

	import { stringify } from '$lib/util'
	import { onMount } from 'svelte'

	import type { GoogleFormDocument } from '$lib/google-document-util/types'

	import * as linkify from 'linkifyjs'

	// @ts-expect-error
	import markdownitDeflist from 'markdown-it-deflist'
	import { linkifyRelative, makeTagFunctionMd } from '$lib/tag-functions/markdown.js'
	import { DOCUMENT_URL_REGEX, urlFromVeneerId } from '$lib/google-document-util/url-id'

	import { undent } from '$lib/tag-functions/undent'
	import { linkListifyDefinitionList } from '$lib/markdown/dl-to-link-list'
	import { page } from '$app/state'
	import { gg } from '@leftium/gg'

	import { Confetti } from 'svelte-confetti'

	import { pipe } from 'fp-ts/lib/function.js'

	const md = makeTagFunctionMd({ html: true, linkify: true, typographer: true, breaks: true }, [
		[markdownitDeflist],
		[linkifyRelative],
	])

	let { params, data, form } = $props()

	let notificationBoxHidden = $state(false)

	let swiperContainer = $state<SwiperContainer>()
	let activeHash = $state('info')

	let sourceUrlForm = $derived(
		isOk(data.form) ? urlFromVeneerId(data.form.data.documentId, false) : '',
	)
	let sourceUrlSheet = $derived(
		isOk(data.sheet) ? urlFromVeneerId(data.sheet.data.documentId, false) : '',
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
	} from '$lib/google-document-util/sheet-data-pipeline.svelte'
	import NotificationBox from '$lib/components/NotificationBox.svelte'
	import { slide } from 'svelte/transition'
	import type { Swiper } from 'swiper/types'
	import { pushState } from '$app/navigation'
	import GoogleForm from '$lib/components/GoogleForm.svelte'
	import Sheet from '$lib/components/Sheet.svelte'
	import { isOk } from 'wellcrafted/result'

	function slideToHash(hash: string) {
		hash = hash.replace('#', '')
		if (swiperContainer && swiperContainer.swiper) {
			const slideIndex = swiperContainer.swiper.slides.findIndex(
				(slide) => slide.dataset.hash === hash,
			)
			// Only slide if the index is valid and it's not already the active slide
			if (slideIndex !== -1 && swiperContainer.swiper.activeIndex !== slideIndex) {
				swiperContainer.swiper.slideTo(slideIndex)
				activeHash = hash // Update component state when we slide
			} else if (slideIndex !== -1) {
				// If it's already the active slide, ensure our internal hash state is correct
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
			autoHeight: true,
			// ✅ Allow touch swipe on mobile
			simulateTouch: window.matchMedia('(pointer: coarse)').matches,

			// ✅ Prevent default touch behavior only on desktop
			touchStartPreventDefault: !window.matchMedia('(pointer: coarse)').matches,
		}

		let swiper: Swiper
		if (swiperContainer) {
			Object.assign(swiperContainer, swiperParams)
			swiperContainer.initialize()

			swiper = swiperContainer.swiper
			swiper.on('slideChange', () => {
				// Assuming each slide has <div class="swiper-slide" data-hash="slide-2">
				const currentSlide = swiper.slides[swiper.activeIndex]
				const hash = currentSlide.getAttribute('data-hash') ?? swiper.activeIndex.toString()

				// Only push state if the hash is different to avoid unnecessary history entries
				if (activeHash !== hash) {
					setTimeout(() => {
						pushState(`#${hash}`, {})
					}, 0)

					activeHash = hash // Update internal state immediately
				}
			})
		}

		// Listen for GroupRegistration height changes to update swiper slide height
		const handleGroupResize = () => callSwiperUpdateAutoHeight()
		document.addEventListener('groupresize', handleGroupResize)

		return () => {
			document.removeEventListener('groupresize', handleGroupResize)
			if (swiper) {
				swiper.destroy(true, true) // optional: clean DOM and detach
			}
		}
	})

	$effect(() => {
		// reading `$page` here auto-subscribes to changes

		const targetHash = form?.success ? 'list' : page.url.hash.replace('#', '')

		//if (targetHash !== untrack(() => activeHash) {
		slideToHash(targetHash)
		//}
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
						internalLink = `/7/${id}`
					}
					if (/오시는 길|수칙/i.test(line)) {
						internalLink = `/1/${id}`
					}

					if (/신청/.test(line)) {
						internalLink += '#form'
						if (
							isOk(data.form) &&
							[data.form.data.documentId, data.form.data.veneerId].includes(id)
						) {
							internalLink = '#form'
						}
						// @ts-expect-error: TODO
						const count = finalData.extra.count
						const callout = !count
							? ''
							: `<div class="tooltip">${count.total}명 신청 💃${count.follows} 🕺${count.leaders}</div>`
						const button = `<a href="${internalLink}" role=button class=outline onclick="window.location.hash='#form'">신청 ➡️</a>`
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
						if (isOk(data.form) && isOk(data.sheet) && data.sheet.data.documentId === id) {
							internalLink = '#list'
						}
						const button = `<a href="${internalLink}" role=button class=outline onclick="window.location.hash='#list'">확인 👀</a>`
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
</script>

<svelte:head>
	<title>{data.title}</title>
</svelte:head>

<article>
	<header>
		<fi-spacer></fi-spacer>

		<h1 class="title">{data.title}</h1>

		{#if data.numTabs > 1}
			<nav-buttons>
				{#each Object.entries(data.navTabs) as [hash, { name, icon, error }]}
					{#if icon}
						<button
							class={['glass', { active: activeHash === hash }]}
							onclick={() => slideToHash(hash)}
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
		<pre hidden>{stringify({ form })}</pre>
		{#if form && !notificationBoxHidden}
			{@const level = form.success ? 'success' : 'warning'}
			{@const subject = form.success ? 'Successfully signed up!' : 'Sorry! There was a problem:'}
			{@const message = form.success ? '' : `${form.status}: ${form.statusText}`}

			{#if form.success}
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
			{/if}

			<div transition:slide={{ delay: 300 }}>
				<NotificationBox {level} bind:notificationBoxHidden>
					{#snippet title()}
						{subject}
					{/snippet}
					{#snippet description()}
						{@html message}
					{/snippet}
				</NotificationBox>
			</div>
		{/if}

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
					{#if isOk(data.form)}
						{#if !data.navTabs.info.icon}
							<content class="markdown">
								{@html md`${internalizeLinks(data.info)}`}
							</content>
						{/if}

						<content>
							<GoogleForm googleForm={data.form.data as GoogleFormDocument}></GoogleForm>
						</content>
						<pre hidden>{stringify(data.form.data)}</pre>
					{:else}
						<pre>{stringify(data.form.error)}</pre>
					{/if}
				</swiper-slide>
			{/if}

			{#if data.navTabs.list.icon}
				<swiper-slide data-hash="list">
					{#if isOk(data.sheet)}
						<Sheet data={finalData} onToggle={callSwiperUpdateAutoHeight}></Sheet>

						<pre hidden>{stringify(data.sheet.data)}}</pre>
					{:else}
						<pre>{stringify(data.sheet.error)}</pre>
					{/if}
				</swiper-slide>
			{/if}

			{#if data.navTabs.dev.icon}
				<swiper-slide data-hash="raw">
					{#if isOk(data.sheet)}
						<Sheet data={raw} onToggle={callSwiperUpdateAutoHeight}></Sheet>
					{/if}
					<pre hidden>{stringify(raw)}</pre>
				</swiper-slide>

				<swiper-slide data-hash="dev">
					<pre>params: {stringify(params)}</pre>
					<pre>finalData: {stringify(finalData)}</pre>
					<pre>raw: {stringify(raw)}</pre>
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
			padding-block: $size-3;
			background-color: var(--app-card-section-bg);
			border-top: 1px solid var(--app-muted-border-color);
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
				minmax(calc(($size-content-3 - 2 * $size-3) / 3), 1fr)
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
			--app-muted-color: color-mix(in srgb, var(--app-color) 30%, transparent);

			:where(article, address, blockquote, dl, figure, form, ol, p, pre, table, ul)
				~ :is(h1, h2, h3, h4, h5, h6) {
				margin-top: $size-4;
			}

			h1 {
				grid-row: 1;
				align-self: end;
				margin-bottom: $size-1;

				color: var(--app-muted-color);
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
						color: var(--app-muted-color);

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
			--c1: color-mix(in srgb, var(--app-color) 60%, transparent);
			--c2: var(--app-card-section-bg);

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
