<script>
	import { getLocale, setLocale } from '$lib/paraglide/runtime.js'

	const displayNames = { en: 'en', ko: '한' }
	const locales = /** @type {const} */ (['en', 'ko'])

	const currentLocale = $derived(getLocale())
</script>

<span class="language-switcher">
	{#each locales as locale, i (locale)}
		{#if i > 0}
			<span class="separator">|</span>
		{/if}
		{#if locale === currentLocale}
			<span class="locale active">{displayNames[locale]}</span>
		{:else}
			<button class="locale inactive" onclick={() => setLocale(locale)}>
				{displayNames[locale]}
			</button>
		{/if}
	{/each}
</span>

<style>
	.language-switcher {
		font-size: 0.85rem;
	}

	.locale.active {
		font-weight: bold;
		opacity: 1;
	}

	.locale.inactive {
		all: unset;
		font: inherit;
		font-weight: normal;
		opacity: 0.7;
		cursor: pointer;
	}

	.locale.inactive:hover {
		opacity: 1;
	}

	.separator {
		opacity: 0.7;
	}
</style>
