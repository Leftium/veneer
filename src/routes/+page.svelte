<script lang="ts">
	import { browser } from '$app/environment'
	import * as linkify from 'linkifyjs'
	import { DOCUMENT_URL_REGEX } from '$lib/google-document-util/url-id'
	import { PRESETS } from '$lib/presets'

	// Convert any CSS color to #rrggbb hex for <input type="color">
	function toHex(color: string): string {
		if (!color) return '#000000'
		// Already hex
		if (/^#[0-9a-f]{6}$/i.test(color)) return color
		// Use an off-screen element to resolve CSS color names / rgb() etc.
		const el = document.createElement('span')
		el.style.color = color
		document.body.appendChild(el)
		const computed = getComputedStyle(el).color
		document.body.removeChild(el)
		const match = computed.match(/(\d+),\s*(\d+),\s*(\d+)/)
		if (!match) return '#000000'
		const [, r, g, b] = match
		return '#' + [r, g, b].map((c) => Number(c).toString(16).padStart(2, '0')).join('')
	}

	const ALL_TABS = ['info', 'form', 'list', 'raw', 'dev']

	const TAB_META: Record<string, { icon: string; name: string }> = {
		info: { icon: 'ℹ️', name: 'Info' },
		form: { icon: '✍', name: 'Form' },
		list: { icon: '📋', name: 'List' },
		raw: { icon: '🔧', name: 'RAW' },
		dev: { icon: '🔧', name: 'Dev' },
	}

	let urlInput = $state('')
	let sheetInput = $state('')

	// Advanced options
	let preset = $state('')
	let tabs = $state('')
	let headerImageMode = $state('') // '' | 'form' | 'none' | 'custom'
	let headerImageCustom = $state('')
	let headerColor = $state('')
	let headerHeight = $state('')
	let headerTextColor = $state('')
	let headerImageFit = $state('')

	// Tracks the URL that was last copied; resets when veneerPath changes
	let copiedUrl = $state('')

	// Pre-populate inputs from URL params (for sharing launcher links)
	if (browser) {
		const params = new URLSearchParams(window.location.search)
		const urlParam = params.get('url')
		const sheetParam = params.get('sheet')
		if (urlParam) urlInput = urlParam
		if (sheetParam) sheetInput = sheetParam
	}

	// Form metadata from /api/form-meta (Phase 4)
	let formMeta = $state<{ title: string; headerImageUrl: string | null } | null>(null)
	let formMetaLoading = $state(false)

	$effect(() => {
		const id = formResult ? `${formResult.prefix}.${formResult.id}` : null
		if (!id || formResult?.prefix === 's') {
			formMeta = null
			return
		}
		const controller = new AbortController()
		formMetaLoading = true
		fetch(`/api/form-meta?id=${id}`, { signal: controller.signal })
			.then((r) => r.json())
			.then((data) => {
				formMeta = data
			})
			.catch((e) => {
				if (e.name !== 'AbortError') formMeta = null
			})
			.finally(() => {
				formMetaLoading = false
			})
		return () => controller.abort()
	})

	// Extract veneer ID from a URL by trying all DOCUMENT_URL_REGEX patterns
	function veneerIdFromUrl(url: string): { prefix: string; id: string } | null {
		for (const [prefix, regex] of Object.entries(DOCUMENT_URL_REGEX)) {
			const match = url.match(regex)
			if (match?.groups?.id) {
				return { prefix, id: match.groups.id }
			}
		}
		return null
	}

	// Extract first URL from input text using linkifyjs
	let extractedUrl = $derived.by(() => {
		if (!urlInput.trim()) return null
		const links = linkify.find(urlInput)
		const firstLink = links.find((l) => l.type === 'url')
		return firstLink?.href ?? null
	})

	// Parse the extracted URL into a veneer ID
	let formResult = $derived(extractedUrl ? veneerIdFromUrl(extractedUrl) : null)

	// Parse the optional sheet URL
	let sheetResult = $derived.by(() => {
		if (!sheetInput.trim()) return null
		const links = linkify.find(sheetInput)
		const firstLink = links.find((l) => l.type === 'url')
		if (!firstLink) return null
		const parsed = veneerIdFromUrl(firstLink.href)
		return parsed?.prefix === 's' ? parsed : null
	})

	// Type detection helpers
	function typeLabel(prefix: string): string {
		switch (prefix) {
			case 'f':
				return 'Google Form detected'
			case 'g':
				return 'Google Form (shortened) detected'
			case 's':
				return 'Google Sheet detected'
			case 'b':
			case 'h':
				return 'Shortened URL — type detected when opened'
			default:
				return 'Unknown type'
		}
	}

	let isFormType = $derived(formResult?.prefix === 'f' || formResult?.prefix === 'g')

	// Generated veneer path
	let veneerPath = $derived.by(() => {
		if (!formResult) return null
		const formPart = `${formResult.prefix}.${formResult.id}`
		const base = sheetResult
			? `/${formPart}/${sheetResult.prefix}.${sheetResult.id}`
			: `/${formPart}`

		const params = new URLSearchParams()
		if (preset) params.set('preset', preset)
		if (tabs) params.set('tabs', tabs)
		// Resolve header image param:
		// - explicit mode → emit that value
		// - '(not set)' + preset has no image + form has image → auto-emit 'form'
		// - '(not set)' + preset has image → omit param (server uses preset image)
		const imgVal =
			headerImageMode === 'custom'
				? headerImageCustom
				: headerImageMode || (!selectedPreset.headerImage && formMeta?.headerImageUrl ? 'form' : '')
		if (imgVal) params.set('headerImage', imgVal)
		if (headerColor) params.set('headerColor', headerColor)
		if (headerHeight) params.set('headerHeight', headerHeight)
		if (headerTextColor) params.set('headerTextColor', headerTextColor)
		if (headerImageFit) params.set('headerImageFit', headerImageFit)

		const qs = params.toString()
		return qs ? `${base}?${qs}` : base
	})

	const presetNames = Object.keys(PRESETS)

	// Resolved preset for placeholder hints and preview
	let selectedPreset = $derived(PRESETS[preset] ?? PRESETS['base'])

	// Preview header values: use filled-in state value, fall back to form, then preset
	let previewBgImage = $derived.by(() => {
		if (headerImageMode === 'none') return 'none'
		if (headerImageMode === 'custom')
			return headerImageCustom ? `url(${headerImageCustom})` : 'none'
		if (headerImageMode === 'form') {
			// Explicit 'from form': use form image if available, else none
			return formMeta?.headerImageUrl ? `url(${formMeta.headerImageUrl})` : 'none'
		}
		// '(not set)': preset image wins; fall back to form image; then none
		if (selectedPreset.headerImage) return `url(${selectedPreset.headerImage})`
		if (formMeta?.headerImageUrl) return `url(${formMeta.headerImageUrl})`
		return 'none'
	})
	let previewBgColor = $derived(headerColor || selectedPreset.headerColor)
	let previewHeight = $derived(headerHeight || selectedPreset.headerHeight)
	let previewBgSize = $derived(headerImageFit || selectedPreset.headerImageFit)

	let previewTitle = $derived(formMeta?.title || '')

	let resolvedTabs = $derived.by(() => {
		const tabList = tabs
			? tabs.split('.').filter((t: string) => ALL_TABS.includes(t))
			: selectedPreset.tabs
		return tabList
			.filter((t: string) => TAB_META[t])
			.map((t: string) => ({ id: t, ...TAB_META[t] }))
	})
</script>

<main class="content-bg">
	{#if formResult}
		<div class="sticky-preview">
			<div
				class="header-preview"
				style:background-image={previewBgImage}
				style:background-color={previewBgColor}
				style:background-size={previewBgSize}
				style:background-position="center"
				style:--header-text-color={headerTextColor || selectedPreset.headerTextColor}
			>
				{#if formMetaLoading}
					<span class="preview-note">loading…</span>
				{:else if headerImageMode === 'form' && !formMeta?.headerImageUrl}
					<span class="preview-note">form has no header image</span>
				{/if}
				<fi-spacer style:height={previewHeight}></fi-spacer>
				{#if formMetaLoading}
					<h1 class="preview-title shimmer" aria-label="Loading title">&nbsp;</h1>
				{:else if previewTitle}
					<h1 class="preview-title">{previewTitle}</h1>
				{/if}
				{#if resolvedTabs.length > 1}
					<nav-buttons>
						{#each resolvedTabs as tab (tab.id)}
							<span class="glass">{tab.icon} {tab.name}</span>
						{/each}
					</nav-buttons>
				{/if}
			</div>
			<div class="preview-bar">
				{#if veneerPath}
					<input
						class="veneer-url"
						type="text"
						readonly
						value={window.location.origin + veneerPath}
						onfocus={(e) => e.currentTarget.select()}
					/>
					<p class="preview-actions-prose">
						<a href={veneerPath} target="_blank">Open</a> this veneer in a new tab, or
						<button
							class:copied={copiedUrl && copiedUrl === window.location.origin + veneerPath}
							onclick={() => {
								const full = window.location.origin + veneerPath
								navigator.clipboard.writeText(full)
								copiedUrl = full
							}}
						>
							{copiedUrl && copiedUrl === window.location.origin + veneerPath
								? 'Copied!'
								: 'Copy URL'}</button
						>
						to share.
					</p>
				{/if}
			</div>
		</div>
	{/if}

	<!-- URL Builder -->
	<section>
		<h2>Veneer Builder</h2>
		<label>
			Paste a Google Form or Sheet URL
			{#if formResult}
				<span class="detected">{typeLabel(formResult.prefix)}</span>
			{/if}
			<input
				type="url"
				placeholder="https://docs.google.com/forms/d/e/... or https://forms.gle/..."
				bind:value={urlInput}
				onfocus={(e) => e.currentTarget.select()}
			/>
		</label>

		{#if formResult}
			{#if isFormType}
				<label>
					Optional: paste a Google Sheet URL (for response data)
					<input
						type="url"
						placeholder="https://docs.google.com/spreadsheets/d/..."
						bind:value={sheetInput}
						onfocus={(e) => e.currentTarget.select()}
					/>
				</label>
				{#if sheetInput && !sheetResult}
					<small>No valid Google Sheet URL detected in input.</small>
				{/if}
			{/if}

			<details open>
				<summary>Advanced options</summary>

				<div class="advanced-grid">
					<label for="opt-preset">Preset</label>
					<select id="opt-preset" bind:value={preset}>
						<option value="">(not set)</option>
						{#each presetNames as name (name)}
							<option value={name}>{name}</option>
						{/each}
					</select>

					<label for="opt-tabs">Tabs</label>
					<div class="field-with-hint">
						<input id="opt-tabs" type="text" placeholder="e.g. info.form.list" bind:value={tabs} />
						<small>dot-separated; <code>*</code> for all</small>
					</div>

					<label for="opt-header-image">Header image</label>
					<div class="field-with-hint">
						<select id="opt-header-image" bind:value={headerImageMode}>
							<option value="">(not set)</option>
							<option value="form">form</option>
							<option value="none">none</option>
							<option value="custom">custom URL…</option>
						</select>
						{#if headerImageMode === 'custom'}
							<input type="url" placeholder="https://…" bind:value={headerImageCustom} />
						{/if}
					</div>

					<label for="opt-image-fit">Image fit</label>
					<select id="opt-image-fit" bind:value={headerImageFit}>
						<option value="">(not set — {selectedPreset.headerImageFit})</option>
						<option value="cover">cover — crop to fill</option>
						<option value="contain">contain — fit, no crop</option>
						<option value="100%">fill width</option>
						<option value="100% 100%">stretch</option>
					</select>

					<label for="opt-header-color">Header color</label>
					<div class="color-field">
						<input
							id="opt-header-color"
							type="text"
							placeholder={selectedPreset.headerColor}
							bind:value={headerColor}
						/>
						<input
							type="color"
							value={toHex(headerColor || selectedPreset.headerColor)}
							oninput={(e) => (headerColor = e.currentTarget.value)}
						/>
					</div>

					<label for="opt-header-height">Extra height</label>
					<div class="slider-field">
						<input
							id="opt-header-height"
							type="text"
							placeholder={selectedPreset.headerHeight}
							bind:value={headerHeight}
						/>
						<input
							type="range"
							min="0"
							max="200"
							value={parseInt(headerHeight || selectedPreset.headerHeight) || 0}
							oninput={(e) => (headerHeight = e.currentTarget.value + 'px')}
						/>
					</div>

					<label for="opt-text-color">Text color</label>
					<div class="color-field">
						<input
							id="opt-text-color"
							type="text"
							placeholder={selectedPreset.headerTextColor}
							bind:value={headerTextColor}
						/>
						<input
							type="color"
							value={toHex(headerTextColor || selectedPreset.headerTextColor)}
							oninput={(e) => (headerTextColor = e.currentTarget.value)}
						/>
					</div>
				</div>
			</details>
		{:else if urlInput.trim()}
			<small>
				No supported URL detected. Supported formats: Google Forms, Google Sheets, forms.gle,
				bit.ly, shorturl.at
			</small>
		{/if}
	</section>

	<!-- Footer -->
	<footer>
		<section>
			<h3>More</h3>
			<ul>
				<li><a href="/presets">Presets &amp; Demo</a></li>
			</ul>
		</section>
		<section>
			<h3>Powered by Veneer</h3>
			<ul>
				<li>
					<a href="https://github.com/Leftium/veneer" target="_blank" rel="noopener noreferrer"
						>Source code</a
					>
				</li>
				<li>
					<a href="https://leftium.com" target="_blank" rel="noopener noreferrer">Made by Leftium</a
					>
				</li>
			</ul>
		</section>
	</footer>
</main>

<style lang="scss">
	@use 'open-props-scss' as *;

	main {
		max-width: $size-content-3;
		margin-inline: auto;
		padding-inline: $size-5;
		padding-block: $size-5;
	}

	.preview-bar {
		padding: $size-1 $size-3 $size-2;
	}

	input.veneer-url {
		width: 100%;
		font-family: monospace;
		font-size: $font-size-0;
		color: var(--app-muted-color, #666);
		padding: $size-1 $size-2;
		margin: 0;
	}

	.preview-actions-prose {
		margin-top: $size-1;
		margin-bottom: 0;
		text-align: center;
		font-size: $font-size-0;
		color: var(--app-muted-color, #666);

		button,
		a {
			display: inline;
			padding: $size-1 $size-2;
			font-size: inherit;
			border: 1px solid var(--app-border-color, #ccc);
			border-radius: var(--app-border-radius, 4px);
			background: var(--app-surface-color, #f5f5f5);
			color: var(--app-color, inherit);
			cursor: pointer;
			text-decoration: none;
			font-weight: $font-weight-6;

			&:hover {
				background: var(--app-border-color, #ddd);
			}
		}

		button.copied {
			color: #3a7d44;
			border-color: #3a7d44;
			background: transparent;
			cursor: default;
		}
	}

	.detected {
		color: #3a7d44;
		font-size: $font-size-0;
		font-weight: $font-weight-4;
		margin-left: $size-2;
	}

	details {
		margin-top: $size-3;

		summary {
			cursor: pointer;
			user-select: none;
			font-weight: $font-weight-6;
			margin-bottom: $size-2;
		}
	}

	.advanced-grid {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: $size-2 $size-3;
		align-items: start;

		label {
			font-size: $font-size-1;
			color: var(--app-muted-color, #666);
			padding-top: $size-1;
			text-align: right;
		}

		select,
		input[type='text'],
		input[type='url'] {
			width: 100%;
		}
	}

	.field-with-hint {
		display: flex;
		flex-direction: column;
		gap: $size-1;
	}

	// Shared fixed width for the text input in color + slider rows
	$secondary-input-width: 7em;

	.color-field {
		display: flex;
		gap: $size-1;
		align-items: center;

		input[type='text'] {
			flex: 0 0 $secondary-input-width;
			width: $secondary-input-width;
			min-width: 0;
		}

		input[type='color'] {
			flex: 0 0 2.5em;
			width: 2.5em;
			height: 2.5em;
			padding: 3px;
			border: 1px solid var(--app-border-color);
			border-radius: var(--app-border-radius);
			cursor: pointer;
			background: none;
			-webkit-appearance: none;
			appearance: none;

			&::-webkit-color-swatch-wrapper {
				padding: 0;
			}

			&::-webkit-color-swatch {
				border: none;
				border-radius: 2px;
			}

			&::-moz-color-swatch {
				border: none;
				border-radius: 2px;
			}
		}
	}

	.slider-field {
		display: flex;
		gap: $size-1;
		align-items: center;

		input[type='text'] {
			flex: 0 0 $secondary-input-width;
			width: $secondary-input-width;
		}

		input[type='range'] {
			flex: 1 1 0;
			min-width: 0;
			padding: 0;
			margin: 0;
			-webkit-appearance: none;
			appearance: none;
			height: 6px;
			background: var(--app-border-color, #ccc);
			border-radius: 3px;
			outline: none;

			&::-webkit-slider-thumb {
				-webkit-appearance: none;
				appearance: none;
				width: 16px;
				height: 16px;
				border-radius: 50%;
				background: var(--app-accent-color, #0b4474);
				cursor: pointer;
			}

			&::-moz-range-thumb {
				width: 16px;
				height: 16px;
				border: none;
				border-radius: 50%;
				background: var(--app-accent-color, #0b4474);
				cursor: pointer;
			}
		}
	}

	.sticky-preview {
		position: sticky;
		top: 0;
		z-index: 10;
		margin-top: calc(-1 * $size-5);
		margin-inline: calc(-1 * $size-5);
		background: var(--app-background-color, white);
	}

	.header-preview {
		position: relative;
		border-radius: 0;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		padding: 0;
		overflow: hidden;
		background-position: center;
		transition: background-color 0.2s;

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

		h1 {
			margin-bottom: $size-2;
			text-align: center;
		}
	}

	.preview-note {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		font-size: $font-size-0;
		color: rgba(255, 255, 255, 0.7);
		background: rgba(0, 0, 0, 0.3);
		padding: $size-1 $size-2;
		border-radius: $radius-2;
		white-space: nowrap;
	}

	.preview-title.shimmer {
		width: 40%;
		min-width: 120px;
		height: 1.4em;
		margin-inline: auto;
		background: linear-gradient(
			90deg,
			rgba(255, 255, 255, 0.1) 25%,
			rgba(255, 255, 255, 0.3) 50%,
			rgba(255, 255, 255, 0.1) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: $radius-2;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	footer {
		margin-inline: calc(-1 * $size-5);
		padding-block: $size-3;
		padding-inline: $size-5;
		background-color: var(--app-card-section-bg);
		border-top: 1px solid var(--app-muted-border-color);
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		column-gap: $size-3;

		section {
			h3 {
				margin-bottom: $size-1;
				color: color-mix(in srgb, var(--app-color) 30%, transparent);
				font-size: $font-size-1;
			}

			ul {
				list-style: none;
				padding: 0;
				margin: 0;
			}

			li a {
				text-decoration: none;
				color: color-mix(in srgb, var(--app-color) 30%, transparent);

				&:hover {
					text-decoration: underline;
				}
			}
		}
	}

	// Match real header nav-buttons styling
	.header-preview nav-buttons {
		display: flex;
		justify-content: center;
		margin-bottom: $size-2;
		overflow: hidden;
		max-width: 100%;
		white-space: nowrap;

		span {
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
			border-radius: 0;
			background-color: rgba(255, 255, 255, 0%);

			&:first-child {
				border-radius: $radius-round 0 0 $radius-round;
			}

			&:last-child {
				border-radius: 0 $radius-round $radius-round 0;
			}

			&:only-child {
				border-radius: $radius-round;
			}
		}
	}

	// Approximate the glass effect from the real header
	.header-preview .glass {
		position: relative;
		isolation: isolate;
		box-shadow: 0px 6px 24px rgba(0, 0, 0, 0.2);
		backdrop-filter: blur(1px);
		-webkit-backdrop-filter: blur(1px);
		border: 1px solid rgba(255, 255, 255, 0.3);

		// Softer text shadow than the header title for a glass-integrated look
		text-shadow:
			0 0 10px rgba(0, 0, 0, 0.4),
			0 1px 5px rgba(0, 0, 0, 0.5);

		&::before {
			content: '';
			position: absolute;
			inset: 0;
			z-index: -1;
			border-radius: inherit;
			box-shadow: inset 0 0 20px -5px rgba(255, 255, 255, 0.6);
			background: rgba(255, 255, 255, 0.25);
		}

		&::after {
			content: '';
			position: absolute;
			inset: 0;
			z-index: -2;
			border-radius: inherit;
			backdrop-filter: blur(8px);
			-webkit-backdrop-filter: blur(8px);
			isolation: isolate;
		}
	}
</style>
