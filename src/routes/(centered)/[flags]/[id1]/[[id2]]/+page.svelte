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
		<h1 class="title">{data.title}</h1>
		<header>
			<div role="group">
				{#if data.visibleTabs.info}
					<button class={['outline', activeIndex === 0 && 'active']} onclick={makeSlideTo(0)}>
						ℹ️ Info
						<span class={['status']}>{data.form.isErr() ? '⚠️' : ''}</span>
					</button>
				{/if}

				{#if data.visibleTabs.form}
					<button class={['outline', activeIndex === 1 && 'active']} onclick={makeSlideTo(1)}>
						✍ Form
						<span class={['status']}>{data.form.isErr() ? '⚠️' : ''}</span>
					</button>
				{/if}

				{#if data.visibleTabs.responses}
					<button class={['outline', activeIndex === 2 && 'active']} onclick={makeSlideTo(2)}>
						📋 Responses
						<span class={['status']}>{data.sheet.isErr() ? '⚠️' : ''}</span>
					</button>
				{/if}

				{#if data.visibleTabs.dev}
					<button class={['outline', activeIndex === 3 && 'active']} onclick={makeSlideTo(3)}>
						🔧 Dev
						<span class={['status']}></span>
					</button>
				{/if}
			</div>
		</header>
	{/if}

	<swiper-container bind:this={swiperContainer} space-between={4} hash-navigation={true}>
		{#if data.visibleTabs.info}
			<swiper-slide data-hash="info">
				<h2>INFO</h2>
			</swiper-slide>
		{/if}

		{#if data.visibleTabs.form}
			<swiper-slide data-hash="form">
				<h2>FORM</h2>
				<pre>{stringify(data.form.isOk() ? data.form.value : data.form.error)}</pre>
			</swiper-slide>
		{/if}

		{#if data.visibleTabs.responses}
			<swiper-slide data-hash="responses">
				<h2>REPONSES</h2>
				<pre>{stringify(data.sheet.isOk() ? data.sheet.value : data.sheet.error)}</pre>
			</swiper-slide>
		{/if}

		{#if data.visibleTabs.dev}
			<swiper-slide data-hash="dev">
				<pre>params: {stringify(params)}</pre>
				<pre>data: {stringify(data)}</pre>
			</swiper-slide>
		{/if}
	</swiper-container>
</main>

<style lang="scss">
	main {
		display: grid;
		height: 100vh;

		grid-template-rows: auto auto 1fr;

		h1 {
			margin: auto;
		}

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
				display: block;
				background-color: #00f6;

				overflow: auto;

				pre {
					width: 100%;
					overflow: visible;
					margin-bottom: 0;
				}
			}
		}
	}
</style>
