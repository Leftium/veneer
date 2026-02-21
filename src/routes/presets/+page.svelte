<script lang="ts">
	import { dev } from '$app/environment'
	import { DOMAIN_PRESETS, PRESETS } from '$lib/presets'

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
		<section>
			<h3>More</h3>
			<ul>
				<li><a href="/">Veneer Builder</a></li>
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
</style>
