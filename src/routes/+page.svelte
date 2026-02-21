<script lang="ts">
	import { dev } from '$app/environment'
	import * as linkify from 'linkifyjs'
	import { DOCUMENT_URL_REGEX } from '$lib/google-document-util/url-id'
	import { DOMAIN_PRESETS, PRESETS } from '$lib/presets'

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
		const imgVal = headerImageMode === 'custom' ? headerImageCustom : headerImageMode // 'form', 'none', or ''
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

	// Preview header values: use filled-in state value, fall back to selected preset
	let previewBgImage = $derived.by(() => {
		if (headerImageMode === 'none') return 'none'
		if (headerImageMode === 'custom')
			return headerImageCustom ? `url(${headerImageCustom})` : 'none'
		if (headerImageMode === 'form') return 'none' // can't know without fetching
		return selectedPreset.headerImage ? `url(${selectedPreset.headerImage})` : 'none'
	})
	let previewBgColor = $derived(headerColor || selectedPreset.headerColor)
	let previewHeight = $derived(headerHeight || selectedPreset.headerHeight)
	let previewBgSize = $derived(headerImageFit || selectedPreset.headerImageFit)

	// Preset directory data
	const presetDirectory = [
		{ name: 'btango', domain: 'btango.com', preset: 'btango' },
		{ name: 'btango-class', domain: 'tangoclass.btango.com', preset: 'btango-class' },
		{ name: 'btango-dj', domain: 'tangodj.btango.com', preset: 'btango-dj' },
		{ name: 'vivimil', domain: 'vivimil.com', preset: 'vivimil' },
	]

	// All domains from DOMAIN_PRESETS for dev helpers
	let allDomains = $derived(Object.entries(DOMAIN_PRESETS))
</script>

<main class="content-bg">
	<!-- Header -->
	<header>
		<hgroup>
			<h1>Veneer</h1>
			<p>A customizable front-end for Google Forms &amp; Sheets</p>
		</hgroup>
	</header>

	<!-- URL Builder -->
	<section>
		<h2>URL Builder</h2>
		<label>
			Paste a Google Form or Sheet URL
			<input
				type="url"
				placeholder="https://docs.google.com/forms/d/e/... or https://forms.gle/..."
				bind:value={urlInput}
				onfocus={(e) => e.currentTarget.select()}
			/>
		</label>

		{#if formResult}
			<p><mark>{typeLabel(formResult.prefix)}</mark></p>

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

			{#if veneerPath}
				<p>
					Generated link: <a href={veneerPath} target="_blank">{veneerPath}</a>
				</p>
			{/if}

			<div
				class="header-preview"
				style:background-image={previewBgImage}
				style:background-color={previewBgColor}
				style:height={previewHeight}
				style:background-size={previewBgSize}
				style:background-position="center"
			>
				{#if headerImageMode === 'form'}
					<span class="preview-note">form image shown on page</span>
				{/if}
			</div>

			<details open>
				<summary>Advanced options</summary>

				<div class="advanced-grid">
					<label for="opt-preset">Preset</label>
					<select id="opt-preset" bind:value={preset}>
						<option value="">(domain default)</option>
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
							<option value="">(preset default)</option>
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
						<option value="">({selectedPreset.headerImageFit})</option>
						<option value="cover">cover — crop to fill</option>
						<option value="contain">contain — fit, no crop</option>
						<option value="100%">fill width</option>
						<option value="100% 100%">stretch</option>
					</select>

					<label for="opt-header-color">Header color</label>
					<input
						id="opt-header-color"
						type="text"
						placeholder={selectedPreset.headerColor}
						bind:value={headerColor}
					/>

					<label for="opt-header-height">Header height</label>
					<input
						id="opt-header-height"
						type="text"
						placeholder={selectedPreset.headerHeight}
						bind:value={headerHeight}
					/>

					<label for="opt-text-color">Text color</label>
					<input
						id="opt-text-color"
						type="text"
						placeholder={selectedPreset.headerTextColor}
						bind:value={headerTextColor}
					/>
				</div>
			</details>
		{:else if urlInput.trim()}
			<small>
				No supported URL detected. Supported formats: Google Forms, Google Sheets, forms.gle,
				bit.ly, shorturl.at
			</small>
		{/if}
	</section>

	<!-- Preset Directory -->
	<section>
		<h2>Preset Directory</h2>
		<div role="list">
			{#each presetDirectory as entry (entry.name)}
				{@const presetData = PRESETS[entry.preset]}
				<div>
					<strong>{entry.name}</strong>
					<code>{entry.domain}</code>
					{#if presetData}
						<small>tabs: {presetData.tabs.join(', ')}</small>
					{/if}
					&mdash;
					{#if dev}
						<a href="/?hostname={entry.domain}" target="_blank">[preview]</a>
					{:else}
						<a href="https://{entry.domain}/" target="_blank" rel="noopener noreferrer"
							>{entry.domain}</a
						>
					{/if}
				</div>
			{/each}
		</div>
	</section>

	<!-- Demo -->
	<section>
		<h2>Demo</h2>
		<div><a href="/g.chwbD7sLmAoLe65Z8" target="_blank">Demo form</a> (no preset)</div>
	</section>

	<!-- Dev Helpers -->
	{#if dev}
		<section>
			<h2>Dev Helpers</h2>
			<p>Quick <code>?hostname=</code> links for all configured domains:</p>
			<ul>
				{#each allDomains as [domain, presetName] (domain)}
					<li>
						<a href="/?hostname={domain}" target="_blank">
							{domain}
						</a>
						{#if presetName}
							<small>({presetName})</small>
						{:else if presetName === null}
							<small>(launcher)</small>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- Footer -->
	<footer>
		<small>
			Powered by <strong>Veneer</strong> &mdash;
			<a href="https://github.com/Leftium/veneer" target="_blank" rel="noopener noreferrer">
				GitHub
			</a>
		</small>
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

	.header-preview {
		border-radius: 0;
		margin-block: $size-3;
		margin-inline: calc(-1 * $size-5);
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: $size-5;
		overflow: hidden;
		transition:
			background-color 0.2s,
			height 0.2s;
	}

	.preview-note {
		font-size: $font-size-0;
		color: rgba(255, 255, 255, 0.7);
		background: rgba(0, 0, 0, 0.3);
		padding: $size-1 $size-2;
		border-radius: $radius-2;
	}
</style>
