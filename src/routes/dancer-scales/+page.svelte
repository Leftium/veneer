<script lang="ts">
	import { DANCER_SCALES, BUBBLE_TOPS } from '$lib/dance-party'

	const STORAGE_KEY = 'dancer-scale-tuning'
	const REF_HEIGHT = 150

	type SectionKey = 'both' | 'lead' | 'follow'

	interface Section {
		key: SectionKey
		label: string
		count: number
		folder: string
		suffix: string
	}

	const sections: Section[] = [
		{ key: 'both', label: 'Both (1\u201332)', count: 32, folder: 'both', suffix: 'B' },
		{ key: 'lead', label: 'Leads (1\u20136)', count: 6, folder: 'leads', suffix: 'L' },
		{ key: 'follow', label: 'Follows (1\u20136)', count: 6, folder: 'follows', suffix: 'F' },
	]

	function makeDefaults(): Record<SectionKey, Record<number, number>> {
		return {
			both: { ...DANCER_SCALES.both },
			lead: { ...DANCER_SCALES.lead },
			follow: { ...DANCER_SCALES.follow },
		}
	}

	const DEFAULT_BUBBLE_TOP = 0.8

	function makeBubbleDefaults(): Record<SectionKey, Record<number, number>> {
		return {
			both: { ...BUBBLE_TOPS.both },
			lead: { ...BUBBLE_TOPS.lead },
			follow: { ...BUBBLE_TOPS.follow },
		}
	}

	function loadFromStorage(): Record<SectionKey, Record<number, number>> | null {
		try {
			const raw = sessionStorage.getItem(STORAGE_KEY)
			if (raw) return JSON.parse(raw)
		} catch {
			// ignore
		}
		return null
	}

	const BUBBLE_STORAGE_KEY = 'dancer-bubble-top-tuning'

	function loadBubbleTopsFromStorage(): Record<SectionKey, Record<number, number>> | null {
		try {
			const raw = sessionStorage.getItem(BUBBLE_STORAGE_KEY)
			if (raw) return JSON.parse(raw)
		} catch {
			// ignore
		}
		return null
	}

	let scales: Record<SectionKey, Record<number, number>> = $state(
		loadFromStorage() ?? makeDefaults(),
	)

	let bubbleTops: Record<SectionKey, Record<number, number>> = $state(
		loadBubbleTopsFromStorage() ?? makeBubbleDefaults(),
	)

	// Persist to sessionStorage whenever scales change (side-effect only, no state mutation)
	$effect(() => {
		const json = JSON.stringify(scales)
		sessionStorage.setItem(STORAGE_KEY, json)
	})

	$effect(() => {
		const json = JSON.stringify(bubbleTops)
		sessionStorage.setItem(BUBBLE_STORAGE_KEY, json)
	})

	function padNum(n: number): string {
		return String(n).padStart(2, '0')
	}

	function imgPath(section: Section, num: number): string {
		return `/dancers/${section.folder}/${padNum(num)}-${section.suffix}.png`
	}

	function resetOne(sectionKey: SectionKey, num: number) {
		scales[sectionKey][num] =
			DANCER_SCALES[sectionKey][String(num) as keyof (typeof DANCER_SCALES)[SectionKey]] ?? 1.0
	}

	function resetSection(sectionKey: SectionKey, count: number) {
		for (let i = 1; i <= count; i++) {
			scales[sectionKey][i] =
				DANCER_SCALES[sectionKey][String(i) as keyof (typeof DANCER_SCALES)[SectionKey]] ?? 1.0
		}
	}

	function resetBubbleOne(sectionKey: SectionKey, num: number) {
		bubbleTops[sectionKey][num] = BUBBLE_TOPS[sectionKey]?.[num] ?? DEFAULT_BUBBLE_TOP
	}

	function _resetBubbleSection(sectionKey: SectionKey, count: number) {
		for (let i = 1; i <= count; i++) {
			bubbleTops[sectionKey][i] = BUBBLE_TOPS[sectionKey]?.[i] ?? DEFAULT_BUBBLE_TOP
		}
	}

	function resetAll() {
		const defaults = makeDefaults()
		scales.both = defaults.both
		scales.lead = defaults.lead
		scales.follow = defaults.follow
		const bubbleDefaults = makeBubbleDefaults()
		bubbleTops.both = bubbleDefaults.both
		bubbleTops.lead = bubbleDefaults.lead
		bubbleTops.follow = bubbleDefaults.follow
	}

	let exportJson = $derived(
		`export const DANCER_SCALES = ${JSON.stringify(scales, null, '\t')} as const\n\nexport const BUBBLE_TOPS: Record<string, Record<number, number>> = ${JSON.stringify(bubbleTops, null, '\t')}`,
	)
</script>

<main>
	<h1>Dancer Scale Tuning</h1>
	<p class="subtitle">
		Adjust scale factors so all dancer images appear the same visual height. Reference height: <strong
			>{REF_HEIGHT}px</strong
		>
	</p>

	<div class="toolbar">
		<button onclick={resetAll}>Reset All to Defaults</button>
	</div>

	{#each sections as section (section.key)}
		<section class="dancer-section">
			<div class="section-header">
				<h2>{section.label}</h2>
				<button onclick={() => resetSection(section.key, section.count)}>
					Reset {section.label}
				</button>
			</div>

			<div class="gallery" style:--ref-height="{REF_HEIGHT}px">
				{#each Array.from({ length: section.count }, (_, i) => i + 1) as num (num)}
					{@const scale = scales[section.key][num] ?? 1.0}
					{@const bubbleTop = bubbleTops[section.key]?.[num] ?? DEFAULT_BUBBLE_TOP}
					<div class="dancer-card">
						<div class="image-container">
							<div class="reference-line"></div>
							<div class="bubble-preview" style:bottom="{REF_HEIGHT * scale * bubbleTop}px">
								<div class="bubble-preview-card">Name</div>
								<div class="bubble-preview-pointer"></div>
							</div>
							<img
								src={imgPath(section, num)}
								alt="Dancer {section.suffix}{num}"
								style:height="{REF_HEIGHT}px"
								style:transform="scale({scale})"
							/>
						</div>
						<div class="controls">
							<span class="num">#{num}</span>
							<label class="slider-row">
								<span class="slider-label">S</span>
								<input
									type="range"
									min="0.5"
									max="2.0"
									step="0.001"
									value={scale}
									oninput={(e) => {
										scales[section.key][num] = parseFloat(e.currentTarget.value)
									}}
								/>
								<span class="value">{scale.toFixed(3)}</span>
							</label>
							<label class="slider-row bubble-row">
								<span class="slider-label">B</span>
								<input
									type="range"
									min="0.5"
									max="1.2"
									step="0.005"
									value={bubbleTop}
									oninput={(e) => {
										bubbleTops[section.key][num] = parseFloat(e.currentTarget.value)
									}}
								/>
								<span class="value">{bubbleTop.toFixed(3)}</span>
							</label>
							<div class="reset-buttons">
								<button
									class="reset-btn"
									onclick={() => resetOne(section.key, num)}
									title="Reset scale"
								>
									S&#8634;
								</button>
								<button
									class="reset-btn"
									onclick={() => resetBubbleOne(section.key, num)}
									title="Reset bubble"
								>
									B&#8634;
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/each}

	<section class="export-section">
		<h2>Export JSON</h2>
		<p>Copy this into <code>dance-party.ts</code>:</p>
		<textarea readonly rows="40">{exportJson}</textarea>
	</section>
</main>

<style lang="scss">
	@use 'open-props-scss' as *;

	main {
		max-width: $size-content-3;
		margin-inline: auto;
		padding-inline: $size-5;
		padding-block: $size-5;
		background: $gray-9;
		color: $gray-1;
		min-height: 100vh;
	}

	h1 {
		margin-bottom: $size-2;
	}

	.subtitle {
		color: $gray-4;
		margin-bottom: $size-5;
	}

	.toolbar {
		margin-bottom: $size-5;

		button {
			padding: $size-2 $size-4;
			background: $red-7;
			color: white;
			border: none;
			border-radius: $radius-2;
			cursor: pointer;
			font-weight: $font-weight-6;

			&:hover {
				background: $red-6;
			}
		}
	}

	.dancer-section {
		margin-bottom: $size-8;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: $size-4;
		margin-bottom: $size-4;

		h2 {
			margin: 0;
		}

		button {
			padding: $size-1 $size-3;
			background: $gray-7;
			color: $gray-1;
			border: none;
			border-radius: $radius-2;
			cursor: pointer;
			font-size: $font-size-0;

			&:hover {
				background: $gray-6;
			}
		}
	}

	.gallery {
		display: flex;
		flex-wrap: wrap;
		gap: $size-3;
		position: relative;
		padding-bottom: $size-5;
	}

	.reference-line {
		position: absolute;
		left: 0;
		right: 0;
		bottom: var(--ref-height);
		height: 2px;
		background: $red-5;
		opacity: 0.6;
		z-index: 1;
		pointer-events: none;
	}

	.bubble-preview {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		z-index: 2;
		pointer-events: none;
	}

	.bubble-preview-card {
		background: $blue-6;
		color: white;
		font-size: 9px;
		font-weight: 600;
		border-radius: 4px;
		padding: 2px 6px;
		white-space: nowrap;
	}

	.bubble-preview-pointer {
		width: 0;
		height: 0;
		border-left: 5px solid transparent;
		border-right: 5px solid transparent;
		border-top: 6px solid $blue-6;
	}

	.dancer-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 110px;
	}

	.image-container {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		height: calc(var(--ref-height) * 1.5);
		overflow: visible;
		position: relative;

		img {
			transform-origin: bottom center;
			object-fit: contain;
		}
	}

	.controls {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: $size-1;
		margin-top: $size-2;
		width: 100%;

		.num {
			font-weight: $font-weight-7;
			font-size: $font-size-1;
			color: $gray-3;
		}

		.value {
			font-family: $font-mono;
			font-size: $font-size-0;
			color: $gray-4;
		}

		.reset-btn {
			background: none;
			border: 1px solid $gray-6;
			color: $gray-4;
			border-radius: $radius-round;
			width: 24px;
			height: 24px;
			display: flex;
			align-items: center;
			justify-content: center;
			cursor: pointer;
			font-size: $font-size-1;
			padding: 0;

			&:hover {
				border-color: $gray-4;
				color: $gray-1;
			}
		}
	}

	.slider-row {
		display: flex;
		align-items: center;
		gap: $size-1;
		width: 100%;

		.slider-label {
			font-size: 9px;
			font-weight: $font-weight-7;
			color: $gray-5;
			width: 10px;
			flex-shrink: 0;
		}

		input[type='range'] {
			flex: 1;
			min-width: 0;
		}

		&.bubble-row {
			.slider-label {
				color: $green-5;
			}

			input[type='range'] {
				accent-color: $green-5;
			}
		}
	}

	.reset-buttons {
		display: flex;
		gap: $size-1;
	}

	.export-section {
		margin-top: $size-8;

		h2 {
			margin-bottom: $size-2;
		}

		p {
			color: $gray-4;
			margin-bottom: $size-3;
		}

		code {
			background: $gray-8;
			padding: $size-1 $size-2;
			border-radius: $radius-2;
			font-size: $font-size-0;
		}

		textarea {
			width: 100%;
			background: $gray-10;
			color: $green-3;
			border: 1px solid $gray-7;
			border-radius: $radius-2;
			padding: $size-3;
			font-family: $font-mono;
			font-size: $font-size-0;
			resize: vertical;
		}
	}
</style>
