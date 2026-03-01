<script lang="ts">
	import { dev } from '$app/environment'
	import { resolve } from '$app/paths'
	import { DOMAIN_PRESETS, PRESETS } from '$lib/presets'
	import FooterSection from '$lib/components/FooterSection.svelte'

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
						<small>tabs: {presetData.tabs?.join(', ') ?? '(heuristics)'}</small>
					{/if}
					&mdash;
					{#if dev}
						<a href={resolve(`/?hostname=${entry.domain}`)} target="_blank">[preview]</a>
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
		<div><a href={resolve('/g.chwbD7sLmAoLe65Z8')} target="_blank">Demo form</a> (no preset)</div>
	</section>

	<!-- Dev Helpers -->
	{#if dev}
		<section>
			<h2>Dev Helpers</h2>
			<p>Quick <code>?hostname=</code> links for all configured domains:</p>
			<ul>
				{#each allDomains as [domain, presetName] (domain)}
					<li>
						<a href={resolve(`/?hostname=${domain}`)} target="_blank">
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
		<FooterSection
			md={`
			# Related Links
			<div>

			Veneer Builder
			~ /

			</div>
		`}
		/>
		<FooterSection
			md={`
			# About Veneer
			<div>

			Leftium/veneer
			~ https://github.com/Leftium/veneer
			~ icon:octicon:mark-github-16

			Leftium.com
			~ https://leftium.com
			~ icon:bi:globe

			</div>
		`}
		/>
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

	footer {
		margin-inline: calc(-1 * $size-5);
		padding-block: $size-3;
		padding-inline: $size-5;
		background-color: var(--app-card-section-bg);
		border-top: 1px solid var(--app-muted-border-color);
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		grid-template-rows: repeat(20, auto);
		column-gap: $size-3;

		:global {
			d-section {
				grid-row: span 2;
				display: grid;
				grid-template-rows: subgrid;
			}

			h1 {
				grid-row: 1;
				align-self: end;
				margin-bottom: $size-1;
				color: color-mix(in srgb, var(--app-color) 30%, transparent);
				font-size: $font-size-1;
			}

			div {
				grid-row: 2;

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
	}
</style>
