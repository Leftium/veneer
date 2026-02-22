<script>
	import { makeTagFunctionMd, linkifyRelative } from '$lib/tag-functions/markdown.js'
	import { undent } from '$lib/tag-functions/undent.js'
	import { linkListifyDefinitionList } from '$lib/markdown/dl-to-link-list.js'
	import markdownitDeflist from 'markdown-it-deflist'
	import MarkdownItGitHubAlerts from 'markdown-it-github-alerts'
	import centerText from 'markdown-it-center-text'

	/**
	 * @type {{ md: string, transform?: (md: string) => string }}
	 */
	let { md: mdContent, transform } = $props()

	const render = makeTagFunctionMd({ html: true, linkify: true, typographer: true, breaks: true }, [
		[markdownitDeflist],
		[MarkdownItGitHubAlerts],
		[linkifyRelative],
		[centerText],
	])

	let processed = $derived.by(() => {
		let result = linkListifyDefinitionList(undent`${mdContent}`)
		if (transform) result = transform(result)
		return result
	})

	let rendered = $derived(render`${processed}`)
</script>

<!-- eslint-disable svelte/no-at-html-tags -->
<d-section>{@html rendered}</d-section>
