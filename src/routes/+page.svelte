<script lang="ts">
	import { dev } from '$app/environment'
	import * as linkify from 'linkifyjs'
	import { DOCUMENT_URL_REGEX } from '$lib/google-document-util/url-id'
	import { DOMAIN_PRESETS, PRESETS } from '$lib/presets'

	let urlInput = $state('')
	let sheetInput = $state('')

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
		if (sheetResult) {
			return `/${formPart}/${sheetResult.prefix}.${sheetResult.id}`
		}
		return `/${formPart}`
	})

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
</style>
