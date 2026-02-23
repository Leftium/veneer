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
			<span
				class="locale inactive"
				tabindex="0"
				onclick={() => setLocale(locale)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') setLocale(locale)
				}}
			>
				{displayNames[locale]}
			</span>
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
