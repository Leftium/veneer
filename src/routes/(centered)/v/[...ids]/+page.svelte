<script lang="ts">
	import { onMount } from 'svelte'
	import { stringify } from '$lib/util.js'

	// import function to register Swiper custom elements
	import type { SwiperContainer } from 'swiper/element'
	import { register } from 'swiper/element/bundle'
	import { makeNsDocumentData, type DocumentDataEvents } from '$lib/ns-document-data.svelte'
	import { getEmitter } from '$lib/nation-state/emitter.js'

	const swiperParams = {
		spaceBetween: 4,
		hashNavigation: true,
	}

	const nsDocumentData = $state(makeNsDocumentData())
	const { emit } = getEmitter<DocumentDataEvents>(import.meta)

	let { data } = $props()

	emit('documentdata_requestedSetIds', data)

	let swiperContainer = $state<SwiperContainer>()
	let activeIndex = $state(0)

	function makeSlideTo(slideIndex: number) {
		return function () {
			if (swiperContainer) {
				swiperContainer.swiper.slideTo(slideIndex)
				swiperContainer.scrollIntoView()
				activeIndex = slideIndex
			}
		}
	}

	onMount(function () {
		// register Swiper custom elements
		register()

		if (swiperContainer) {
			Object.assign(swiperContainer, swiperParams)
			swiperContainer.initialize()
		}
	})
</script>

<main>
	<header>
		<div role="group">
			<button class={['outline', activeIndex === 0 && 'active']} onclick={makeSlideTo(0)}>
				ℹ️ Info
				<span class={['status', { busy: nsDocumentData.form.isBusy }]}
					>{nsDocumentData.form.error ? '⚠️' : ' '}</span
				>
			</button>
			<button class={['outline', activeIndex === 1 && 'active']} onclick={makeSlideTo(1)}>
				✍ Form
				<span class={['status', { busy: nsDocumentData.form.isBusy }]}
					>{nsDocumentData.form.error ? '⚠️' : ' '}</span
				>
			</button>
			<button class={['outline', activeIndex === 2 && 'active']} onclick={makeSlideTo(2)}>
				📋 Responses
				<span class={['status', { busy: nsDocumentData.sheet.isBusy }]}
					>{nsDocumentData.sheet.error ? '⚠️' : ''}</span
				>
			</button>
		</div>
	</header>

	<swiper-container init="false" bind:this={swiperContainer}>
		<swiper-slide data-hash="info">
			<pre>{stringify(nsDocumentData.form.toObject())}</pre>
		</swiper-slide>

		<swiper-slide data-hash="form">
			<pre>{stringify(nsDocumentData.form.toObject())}</pre>
		</swiper-slide>

		<swiper-slide data-hash="responses">
			<pre>{stringify(nsDocumentData.sheet.toObject())}</pre>
		</swiper-slide>
	</swiper-container>

	<pre>data: {stringify(data)}</pre>
</main>

<style lang="scss">
	main {
		display: grid;
		height: 100vh;

		grid-template-rows: auto 1fr auto;

		.active {
			background-color: #8882;
		}

		.status {
			display: inline-block;
			width: 1em;
			height: 1em;
			background-size: 1em auto;
			background-repeat: no-repeat;
			//vertical-align: -0.125em;
		}

		.busy {
			background-image: var(--pico-icon-loading);
		}

		div {
			margin: 0;
		}

		swiper-container {
			width: 100%;
			overflow: hidden;

			swiper-slide {
				display: grid;
				-place-items: center;
				background-color: #00f6;
			}
		}
	}
</style>
