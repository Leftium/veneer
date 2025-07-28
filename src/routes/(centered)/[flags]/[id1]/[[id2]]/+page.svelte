<script lang="ts">
	// import function to register Swiper custom elements
	import type { SwiperContainer } from 'swiper/element/bundle'
	import { register } from 'swiper/element/bundle'

	import { stringify } from '$lib/util'

	let { params, data } = $props()

	let swiperContainer = $state<SwiperContainer>()
	let activeIndex = $state(0)

	register()

	function makeSlideTo(slideIndex: number) {
		return function () {
			if (swiperContainer) {
				swiperContainer.swiper.slideTo(slideIndex)
				swiperContainer.scrollIntoView()
				activeIndex = slideIndex
			}
		}
	}
</script>

<main>
	<header>
		<div role="group">
			<button class={['outline', activeIndex === 0 && 'active']} onclick={makeSlideTo(0)}>
				ℹ️ Info
				<span class={['status']}></span>
			</button>
			<button class={['outline', activeIndex === 1 && 'active']} onclick={makeSlideTo(1)}>
				✍ Form
				<span class={['status']}></span>
			</button>
			<button class={['outline', activeIndex === 2 && 'active']} onclick={makeSlideTo(2)}>
				📋 Responses
				<span class={['status']}></span>
			</button>
		</div>
	</header>

	<swiper-container bind:this={swiperContainer} space-between={4} hash-navigation={true}>
		<swiper-slide data-hash="info">
			<pre>INFO</pre>
		</swiper-slide>

		<swiper-slide data-hash="form">
			<pre>FORM</pre>
		</swiper-slide>

		<swiper-slide data-hash="responses">
			<pre>REPONSES</pre>
		</swiper-slide>
	</swiper-container>

	<div>
		<pre>params: {stringify(params)}</pre>
		<pre>data: {stringify(data)}</pre>
	</div>
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
