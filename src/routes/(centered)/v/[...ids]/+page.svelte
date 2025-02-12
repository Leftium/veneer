<script lang="ts">
	import { stringify } from '$lib/util'
	import { onMount } from 'svelte'

	// import function to register Swiper custom elements
	import type { SwiperContainer } from 'swiper/element'
	import { register } from 'swiper/element/bundle'
	import Sheet from './Sheet.svelte'

	const swiperParams = {
		spaceBetween: 4,
		hashNavigation: true,
	}

	let { data } = $props()

	const googleForm = data.indexForm !== undefined ? data.googleDocuments[data.indexForm] : undefined
	const googleSheet =
		data.indexSheet !== undefined ? data.googleDocuments[data.indexSheet] : undefined

	let swiperContainer: SwiperContainer | undefined = $state()
	let headerElement: HTMLElement | undefined = $state()

	function makeSlideTo(slideIndex: number) {
		return function () {
			swiperContainer?.swiper.slideTo(slideIndex)
			swiperContainer?.scrollIntoView()
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

<header bind:this={headerElement}>
	<div role="group">
		<button class="outline" onclick={makeSlideTo(0)}>✍ Form</button>
		<button class="outline" onclick={makeSlideTo(1)}>📋 Responses</button>
	</div>
</header>

<swiper-container init="false" bind:this={swiperContainer}>
	<swiper-slide data-hash="form">
		<pre>{stringify(googleForm)}</pre>
	</swiper-slide>
	<swiper-slide data-hash="sheet">
		<Sheet doc={googleSheet}></Sheet>
	</swiper-slide>
</swiper-container>

<pre hidden>{stringify(data)}</pre>

<style lang="scss">
	@use 'open-props-scss' as *;

	swiper-container {
		//background-color: lightgreen;
		scroll-margin-top: 6rem;

		swiper-slide {
			display: block;
		}
	}

	header {
		position: sticky;
		top: 0px;

		padding: $size-2;

		background: var(--pico-background-color);

		left: 0.5rem;
		right: 0.5rem;

		z-index: 1000;

		& > div {
			margin-bottom: 0;
		}
	}
</style>
