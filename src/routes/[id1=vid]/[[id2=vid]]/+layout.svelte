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
	import { onDestroy, onMount, tick, untrack } from 'svelte'
	import { afterNavigate, goto } from '$app/navigation'
	import { browser } from '$app/environment'
	import { resolve } from '$app/paths'
	import type { Pathname } from '$app/types'
	import { linkifyRelative, makeTagFunctionMd } from '$lib/tag-functions/markdown.js'

	import markdownitDeflist from 'markdown-it-deflist'
	import MarkdownItGitHubAlerts from 'markdown-it-github-alerts'
	import centerText from 'markdown-it-center-text'

	import 'markdown-it-github-alerts/styles/github-colors-light.css'
	import 'markdown-it-github-alerts/styles/github-colors-dark-media.css'
	import 'markdown-it-github-alerts/styles/github-base.css'

	import { page } from '$app/state'
	import { DOCUMENT_URL_REGEX, urlFromVeneerId } from '$lib/google-document-util/url-id.js'
	import GoogleForm from '$lib/components/GoogleForm.svelte'
	import Sheet from '$lib/components/Sheet.svelte'
	import Confetti from 'svelte-confetti'
	import { confetti } from '@neoconfetti/svelte'
	import NotificationBox from '$lib/components/NotificationBox.svelte'
	import { slide } from 'svelte/transition'
	import { isOk } from 'wellcrafted/result'
	import FooterSection from '$lib/components/FooterSection.svelte'

	const md = makeTagFunctionMd({ html: true, linkify: true, typographer: true, breaks: true }, [
		[markdownitDeflist],
		[MarkdownItGitHubAlerts],
		[linkifyRelative],
		[centerText],
	])

	let { params, data, children } = $props()

	// Phase 3c: short URLs when viewing domain's default docs
	let docPath = $derived(
		data.usingDefaultDocs ? '' : params.id2 ? `/${params.id1}/${params.id2}` : `/${params.id1}`,
	)

	// Preserve search params (e.g. ?hostname=) for dev navigation
	const search = page.url.search

	let swiperContainer = $state<SwiperContainer>()
	let activeTab = $state(untrack(() => params.tid))
	let notificationBoxHidden = $state(false)

	let tid = $state(untrack(() => params.tid) || 'info')

	const successParty = untrack(() => data.successParty)

	let raw = $derived(makeRaw(data.sheet))

	let finalData = $derived(
		pipe(
			raw,
			extractColumnHeaders,
			stripEmptyRows,
			addIndex,
			adjustColumnTypes,
			adjustColumnLengths,
			stripEmptyColumns,
			hidePhoneNumbers,
			padNumericRenders,
			renderRelativeTimes,
			collectExtraDance,
		),
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
			const tabPath = tid === data.defaultTab ? docPath || '/' : `${docPath}/${tid}`
			goto(resolve(`${tabPath}${search}` as Pathname), {
				replaceState: false,
				noScroll: true,
				keepFocus: true,
			})
		}
	}

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
# Sources
<div>

${!sourceUrlForm ? '' : `Google Form\n~ ${sourceUrlForm}\n~ icon:simple-icons:googleforms`}
${!sourceUrlSheet ? '' : `Google Sheet\n~ ${sourceUrlSheet}\n~ icon:simple-icons:googlesheets`}
춤으로 전하는 힐링 대화
~ https://e.kakao.com/t/healing-message-with-dance
~ icon:simple-icons:kakaotalk
</div>
`,
	)

	let standardFooter = $derived(`
		# Powered by Veneer

		<div>

		Make your own!
		~ https://veneer.leftium.com

		Leftium/veneer
		~ https://github.com/Leftium/veneer
		~ icon:octicon:mark-github-16

		Leftium.com
		~ https://leftium.com
		~ icon:bi:globe

		</div>
	`)

	let hasJS = $state(false)
	onMount(async () => {
		register()
		// Set JS flag, then wait for swiper-js slides to become unhidden:
		hasJS = true
		await tick()

		// 1. Build an array of tab IDs in the order you render slides
		const orderedTabs = Object.entries(data.navTabs)
			.filter(([_key, tab]) => tab.icon) // only include tabs with icons
			.map(([key]) => key)

		// 2. Find the index of the current tid
		const initialSlide = orderedTabs.indexOf(tid || 'info')

		const swiperParams = {
			spaceBetween: 4,
			autoHeight: true,
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
		}
		// Listen for GroupRegistration height changes to update swiper slide height
		document.addEventListener('groupresize', handleGroupResize)
	})

	const handleGroupResize = () => callSwiperUpdateAutoHeight()

	onDestroy(() => {
		if (browser) {
			document.removeEventListener('groupresize', handleGroupResize)
		}
		swiperContainer?.swiper?.destroy(true, true)
	})

	// Phase 5: apply bgColor to outer <html> element (body background behind content column)
	$effect(() => {
		const bg = data.bgColor
		if (bg) {
			document.documentElement.style.backgroundColor = bg
		}
		return () => {
			document.documentElement.style.backgroundColor = ''
		}
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
		const lastSegment = to?.url.pathname.split('/').pop()
		const tid =
			lastSegment && ['info', 'form', 'list', 'raw', 'dev'].includes(lastSegment)
				? lastSegment
				: data.defaultTab
		slideToTab(tid, { updateHistory: false })
	})

	function internalizeLinks(markdown: string): string {
		const lines = markdown.split(/\r?\n/)
		const out: string[] = []
		let i = 0

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

					let internalLink = `/${id}`

					if (/home/i.test(line)) {
						internalLink = `/${id}`
					}
					if (/오시는 길|수칙/i.test(line)) {
						internalLink = `/${id}`
					}

					if (/신청/.test(line)) {
						internalLink = `${docPath}/form${search}`
						//@ts-expect-error: TODO
						const count = finalData.extra.count
						const callout = !count
							? ''
							: `<div class="tooltip">${count.total} people going! <span class="dancer-icon dancer-follow"><img src="/dancers/follows/06-F.png" alt="follow"></span>${count.follows} <span class="dancer-icon dancer-lead"><img src="/dancers/leads/06-L.png" alt="lead"></span>${count.leaders}</div>`
						const button = `<a href="${internalLink}" role=button class=outline>Sign up ➡️</a>`
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

					let internalLink = `/${id}`

					if (/확인/.test(line)) {
						internalLink = `${docPath}/list${search}`
						const button = `<a href="${internalLink}" role=button class=outline>Check who's going 👀</a>`
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

<d-article
	class="content-bg"
	style:--app-accent-color={data.accentColor}
	style:--app-accent-text={data.accentText}
	style:background-color={data.bgColor}
>
	<d-header
		style:background-image={data.header.image ? `url(${data.header.image})` : 'none'}
		style:background-color={data.header.color}
		style:background-size={data.header.imageFit}
		style:--header-text-color={data.header.textColor}
	>
		<fi-spacer style:height={data.header.height}></fi-spacer>

		<h1 class="title">{data.title}</h1>

		{#if data.numTabs > 1}
			<nav-buttons>
				{#each Object.entries(data.navTabs) as [tid, { name, icon, error }] (tid)}
					{#if icon}
						<a
							class={['glass', { active: activeTab === tid }]}
							onclick={(e) => {
								e.preventDefault()
								slideToTab(tid)
							}}
							href={resolve(
								(tid === data.defaultTab
									? `${docPath || '/'}${search}`
									: `${docPath}/${tid}${search}`) as Pathname,
							)}
						>
							{icon}
							{name}{error ? ' ⚠️' : ''}
						</a>
					{/if}
				{/each}
			</nav-buttons>
		{/if}
	</d-header>

	<d-main>
		{#if (page.form || successParty) && !notificationBoxHidden}
			{@const form = page.form}
			{@const level = successParty ? 'success' : 'warning'}
			{@const subject = successParty ? 'Successfully signed up!' : 'Sorry! There was a problem:'}
			{@const message = successParty ? '' : `${form?.status}: ${form?.statusText}`}

			{#if successParty}
				<wrap-confetti>
					<div use:confetti={{ duration: 10_000, force: 0.5, stageHeight: 1600 }}></div>
				</wrap-confetti>
			{/if}

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
				<swiper-slide data-tid="list" hidden={!hasJS && tid !== 'list'}>
					{#if isOk(data.sheet)}
						<Sheet data={finalData} title={data.title} onToggle={callSwiperUpdateAutoHeight}
						></Sheet>

						<pre hidden>{stringify(data.sheet.data)}}</pre>
					{:else}
						<pre>{stringify(data.sheet.error)}</pre>
					{/if}
				</swiper-slide>
			{/if}

			{#if data.navTabs.raw.icon}
				<swiper-slide data-tid="raw" hidden={!hasJS && tid !== 'raw'}>
					{#if isOk(data.sheet)}
						<Sheet data={raw} title={data.title} onToggle={callSwiperUpdateAutoHeight}></Sheet>
					{/if}
					<pre hidden>{stringify(raw)}</pre>
				</swiper-slide>
			{/if}

			{#if data.navTabs.dev.icon}
				<swiper-slide data-tid="dev" hidden={!hasJS && tid !== 'dev'}>
					<pre>params: {stringify(params)}</pre>
					<pre>finalData: {stringify(finalData)}</pre>
					<pre>raw: {stringify(raw)}</pre>
					<pre>data: {stringify(data)}</pre>
				</swiper-slide>
			{/if}
		</swiper-container>
	</d-main>
	<d-footer>
		<content>
			{#each data.footers as footer, i (i)}
				<FooterSection md={footer} transform={internalizeLinks} />
			{/each}

			<FooterSection md={footerSources} />
			<FooterSection md={standardFooter} />
		</content>
	</d-footer>
</d-article>

<!-- OG meta tags are injected into app.html by hooks.server.ts via transformPageChunk,
     so they work even with ssr=false. Do NOT duplicate them here. -->
<svelte:head>
	<title>{data.title}</title>
</svelte:head>

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

	d-article {
		max-width: $size-content-3;
		margin-inline: auto;
		padding: 0;
		margin-block: 0;

		h1 {
			margin-bottom: $size-2;
			text-align: center;
		}

		d-footer,
		d-header {
			margin: 0;
		}

		d-header {
			border-bottom: none;
		}

		d-footer {
			min-height: $size-13;
			padding-block: $size-3;
			padding-inline: $size-5;
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
		&:has(a:focus) {
			box-shadow: none;
		}

		a {
			// Reset anchor defaults
			text-decoration: none;
			color: inherit;

			flex: 0 1 auto;
			min-width: 0;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			text-align: center;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: $size-1 $size-4;

			// Button bar: no rounding by default, round only the ends
			border-radius: 0;

			&:first-child {
				border-radius: $radius-round 0 0 $radius-round;
			}

			&:last-child {
				border-radius: 0 $radius-round $radius-round 0;
			}

			&:only-child {
				border-radius: $radius-round;
			}

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

		// Softer text shadow than the header title for a glass-integrated look
		text-shadow:
			0 0 10px rgba(0, 0, 0, 0.4),
			0 1px 5px rgba(0, 0, 0, 0.5);
	}

	.glass::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		border-radius: inherit;

		box-shadow: inset 0 0 20px -5px rgba(255, 255, 255, 0.6);
		background: rgba(255, 255, 255, 0.25);
	}

	.glass::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -2;
		border-radius: inherit;

		backdrop-filter: blur(8px);
		filter: url(#glass-distortion);
		isolation: isolate;
	}

	d-main {
		// Notification box sits outside swiper, needs its own padding
		& > div {
			padding-inline: $size-5;
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
		padding-inline: $size-7;
	}

	d-footer content {
		padding-inline: 0;
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
				padding-inline: $size-5;

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

	d-header {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		padding: 0;
		background-position: center;

		& * {
			color: var(--header-text-color, white);
			text-shadow:
				0 0 8px rgba(0, 0, 0, 0.7),
				0 1px 3px rgba(0, 0, 0, 0.9);
		}

		// Bottom gradient scrim for text readability over images
		&::after {
			content: '';
			position: absolute;
			inset: 0;
			background: linear-gradient(to bottom, transparent 40%, rgba(0, 0, 0, 0.45) 100%);
			pointer-events: none;
			z-index: 0;
		}

		// Ensure content sits above the scrim
		& > * {
			position: relative;
			z-index: 1;
		}
	}

	d-footer {
		content {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
			grid-template-rows: repeat(20, auto);
			column-gap: $size-3;
		}

		:global {
			d-section {
				grid-row: span 2;
				display: grid;
				grid-template-rows: subgrid;
			}
			--app-muted-color: color-mix(in srgb, var(--app-color) 30%, transparent);

			:where(d-article, address, blockquote, dl, figure, form, ol, p, pre, table, ul)
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
				0 -50%,
				100% -50%,
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

		.dancer-icon {
			display: inline-flex;
			align-items: flex-end;
			justify-content: center;
			position: relative;
			width: 2.2em;
			height: 2.2em;
			vertical-align: middle;
			overflow: visible;
		}
		.dancer-icon::before {
			content: '';
			position: absolute;
			inset: 0;
			border-radius: 50%;
		}
		.dancer-follow::before {
			background: radial-gradient(
				circle,
				rgba(255, 105, 180, 0.55) 0%,
				rgba(255, 105, 180, 0.15) 55%,
				transparent 70%
			);
		}
		.dancer-lead::before {
			background: radial-gradient(
				circle,
				rgba(65, 135, 255, 0.55) 0%,
				rgba(65, 135, 255, 0.15) 55%,
				transparent 70%
			);
		}
		.dancer-icon img {
			position: relative;
			height: 3.5em;
			width: auto;
			object-fit: contain;
			object-position: bottom;
			filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.3)) drop-shadow(0 0 3px rgba(0, 0, 0, 0.15));
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
