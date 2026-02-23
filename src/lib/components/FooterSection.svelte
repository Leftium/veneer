<script>
	import { makeTagFunctionMd, linkifyRelative } from '$lib/tag-functions/markdown.js'
	import { undent } from '$lib/tag-functions/undent.js'
	import { linkListifyDefinitionList } from '$lib/markdown/dl-to-link-list.js'
	import { getLocale } from '$lib/paraglide/runtime.js'
	import { splitBilingualLabel, localeText } from '$lib/locale-content'
	import markdownitDeflist from 'markdown-it-deflist'
	import MarkdownItGitHubAlerts from 'markdown-it-github-alerts'
	import centerText from 'markdown-it-center-text'

	/**
	 * @type {{ md: string, transform?: (md: string) => string }}
	 */
	let { md: mdContent, transform } = $props()

	const locale = $derived(getLocale())

	const render = makeTagFunctionMd({ html: true, linkify: true, typographer: true, breaks: true }, [
		[markdownitDeflist],
		[MarkdownItGitHubAlerts],
		[linkifyRelative],
		[centerText],
	])

	/**
	 * Process markdown header lines for bilingual content.
	 * Converts `# Korean Text (English Text)` into locale-appropriate HTML headers with tooltips.
	 */
	/** @param {string} md @param {string} currentLocale */
	function localizeBilingualHeaders(md, currentLocale) {
		return md.replace(
			/^(#{1,6})\s+(.+)$/gm,
			(
				/** @type {string} */ match,
				/** @type {string} */ hashes,
				/** @type {string} */ headerText,
			) => {
				const bilingual = splitBilingualLabel(headerText)
				if (!bilingual) return match

				const level = hashes.length
				const displayText = localeText(bilingual, currentLocale, headerText)
				const tooltipText = (currentLocale === 'ko' ? bilingual.en : bilingual.ko).replace(
					/"/g,
					'&quot;',
				)
				return `<h${level} title="${tooltipText}">${displayText}</h${level}>`
			},
		)
	}

	let processed = $derived.by(() => {
		let result = linkListifyDefinitionList(undent`${mdContent}`, locale)
		result = localizeBilingualHeaders(result, locale)
		if (transform) result = transform(result)
		return result
	})

	let rendered = $derived(render`${processed}`)
</script>

<!-- eslint-disable svelte/no-at-html-tags -->
<d-section>{@html rendered}</d-section>
