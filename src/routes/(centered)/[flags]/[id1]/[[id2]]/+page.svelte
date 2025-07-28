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
	{#if data.numTabs > 1}
		<header>
			<div role="group">
				{#if data.visibleTabs.info}
					<button class={['outline', activeIndex === 0 && 'active']} onclick={makeSlideTo(0)}>
						ℹ️ Info
						<span class={['status']}></span>
					</button>
				{/if}

				{#if data.visibleTabs.form}
					<button class={['outline', activeIndex === 1 && 'active']} onclick={makeSlideTo(1)}>
						✍ Form
						<span class={['status']}></span>
					</button>
				{/if}

				{#if data.visibleTabs.responses}
					<button class={['outline', activeIndex === 2 && 'active']} onclick={makeSlideTo(2)}>
						📋 Responses
						<span class={['status']}></span>
					</button>
				{/if}
			</div>
		</header>
	{/if}

	<swiper-container bind:this={swiperContainer} space-between={4} hash-navigation={true}>
		{#if data.visibleTabs.info}
			<swiper-slide data-hash="info">
				<pre>INFO</pre>
			</swiper-slide>
		{/if}

		{#if data.visibleTabs.form}
			<swiper-slide data-hash="form">
				<pre>FORM</pre>
			</swiper-slide>
		{/if}

		{#if data.visibleTabs.responses}
			<swiper-slide data-hash="responses">
				<pre>REPONSES</pre>
			</swiper-slide>
		{/if}
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
