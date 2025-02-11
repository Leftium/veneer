<script lang="ts">
	import { stringify } from '$lib/util'
	import { onMount } from 'svelte'

	// import function to register Swiper custom elements
	import type { SwiperContainer } from 'swiper/element'
	import { register } from 'swiper/element/bundle'

	const swiperParams = {
		hashNavigation: true,
	}

	let { data } = $props()

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
		<pre>{stringify(data.googleDocuments?.[0])}</pre>
	</swiper-slide>
	<swiper-slide data-hash="sheet">
		<pre>{stringify(data.googleDocuments?.[1])}</pre>
	</swiper-slide>
</swiper-container>

<style lang="scss">
	@use 'sass:map';
	@use '@yohns/picocss/scss/_settings' as *;

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

		background: $stone-2;

		left: 0.5rem;
		right: 0.5rem;

		z-index: 1000;

		& > div {
			margin-bottom: 0;
		}
	}
</style>
