<script lang="ts">
	import type { BilingualQuestion } from '$lib/locale-content'
	import { localeText } from '$lib/locale-content'
	import { getLocale } from '$lib/paraglide/runtime.js'
	import { SvelteSet } from 'svelte/reactivity'
	import MarkdownIt from 'markdown-it'
	import easyTables from 'markdown-it-easy-tables'
	import sup from 'markdown-it-sup'
	import sub from 'markdown-it-sub'
	import deflist from 'markdown-it-deflist'

	import multimdTable from 'markdown-it-multimd-table'
	import centerText from 'markdown-it-center-text'

	const md = new MarkdownIt({ html: true, linkify: true, typographer: true, breaks: true })
	md.use(sup) //.use(emoji)
		.use(sub)
		.use(deflist)
		.use(multimdTable, {
			multiline: true,
			headerless: true,
		})
		.use(easyTables)
		.use(centerText)

	import { onMount } from 'svelte'
	import store from 'store'

	interface Props {
		// Props:
		field: BilingualQuestion
	}

	let { field }: Props = $props()

	const locale = $derived(getLocale())

	import type { BilingualText } from '$lib/locale-content'

	// Per-item bilingual toggles: title and each option have independent toggles
	let titleToggled = $state(false)
	let optionToggles = new SvelteSet<number>()

	/** Get the "other" language text from a BilingualText */
	function otherLang(bilingual: BilingualText): string {
		return locale === 'ko' ? bilingual.en : bilingual.ko
	}

	// Bindings:
	let value = $state('')
	let group: string[] = $state([])
	let mounted = $state(false)

	// String value to store in localStorage:
	let storeValue = $derived(field.type === 'CHECKBOXES' ? group?.join(', ') : value)

	function parseMarkdown(
		markdown?: string | null,
		options?: { collapseNewlines: any } | undefined,
	) {
		markdown = markdown || ''

		const collapsNewlines = options?.collapseNewlines ?? false

		if (collapsNewlines) {
			markdown = markdown.replaceAll('\n\n', '\n').replaceAll('\n', '<br>')
		}

		let result = md.render(markdown)

		if (collapsNewlines) {
			result = result.replace(/(<p>)|(<\/p>)/g, '')
		}

		result = result.replace(/^(<p>)|(<\/p>\s*$)/g, '')

		return result
	}

	function normalizeTitle(title: string) {
		return title?.trim()?.toLowerCase().replace(/\s+/g, '_')
	}

	// Server-side image proxy (disabled -- app should work without SSR/server)
	// function proxyImgUrl(url?: string) {
	// 	if (!url) return ''
	// 	return `/api/image-proxy?url=${encodeURIComponent(url)}`
	// }

	function imgSrc(url?: string) {
		if (!url) return ''
		return url.replace(/=w\d+(\?|$)/i, '$1')
	}

	function handleChange(this: HTMLInputElement) {
		const storedValues = store.get('storedValues') || { byId: {}, byTitle: {} }

		storedValues.byId[field.id] = storeValue
		storedValues.byTitle[normalizeTitle(field.title)] = storeValue

		store.set('storedValues', storedValues)
	}

	onMount(() => {
		const storedValues = store.get('storedValues') || { byId: {}, byTitle: {} }

		if (field.type === 'CHECKBOXES') {
			group = (
				storedValues.byId[field.id]?.split(', ') ||
				storedValues.byTitle[normalizeTitle(field.title)]?.split(', ') ||
				[]
			).filter(Boolean)
		} else {
			value = storedValues.byId[field.id] || storedValues.byTitle[normalizeTitle(field.title)]
		}

		mounted = true
	})
</script>

<d-section class:has-input={!!field.inputIndex}>
	{#if field.type === 'TITLE_AND_DESCRIPTION'}
		<center>
			<h3>
				{@html parseMarkdown(localeText(field.bilingualTitle, locale, field.title))}
				{#if field.bilingualTitle}<button
						type="button"
						class="lang-toggle"
						class:toggled={titleToggled}
						onclick={() => (titleToggled = !titleToggled)}>🌐</button
					><span class="lang-alt">{otherLang(field.bilingualTitle)}</span>{/if}
			</h3>
		</center>
		{@html parseMarkdown(localeText(field.bilingualDescription, locale, field.description ?? ''))}
	{:else if field.type === 'IMAGE'}
		{#key field.title}
			{#if field.title && field.title !== 'hero'}
				<center>
					<h1>
						{@html parseMarkdown(localeText(field.bilingualTitle, locale, field.title))}
						{#if field.bilingualTitle}<button
								type="button"
								class="lang-toggle"
								class:toggled={titleToggled}
								onclick={() => (titleToggled = !titleToggled)}>🌐</button
							><span class="lang-alt">{otherLang(field.bilingualTitle)}</span>{/if}
					</h1>
				</center>
			{/if}
			<center>
				<img src={imgSrc(field.imgUrl)} alt="" />
			</center>
		{/key}
	{:else if field.type === 'VIDEO'}
		<center>
			<div class="wrap-youtube">
				<iframe
					title="YouTube Video"
					class="youtube"
					src="https://www.youtube.com/embed/{field.youtubeId}/?rel=0&controls=1&modestbranding=1"
					allowfullscreen
				></iframe>
			</div>
		</center>
	{:else if ['PARAGRAPH_TEXT', 'TEXT'].includes(field.type)}
		<label for="entry.{field.id}">
			{#if field.required}
				<span class="required-mark">*</span>
			{/if}
			{@html parseMarkdown(localeText(field.bilingualTitle, locale, field.title))}
			{#if field.bilingualTitle}<button
					type="button"
					class="lang-toggle"
					class:toggled={titleToggled}
					onclick={(e) => {
						e.stopPropagation()
						titleToggled = !titleToggled
					}}>🌐</button
				><span class="lang-alt">{otherLang(field.bilingualTitle)}</span>{/if}
			<div>
				<small>
					{@html parseMarkdown(
						localeText(field.bilingualDescription, locale, field.description ?? ''),
					)}
				</small>
			</div>
		</label>
		{#if field.imgUrl}
			<center class="question-image">
				<img src={imgSrc(field.imgUrl)} alt="" />
			</center>
		{/if}

		{#if field.type === 'PARAGRAPH_TEXT'}
			<textarea
				id="entry.{field.id}"
				name="entry.{field.id}"
				required={field.required}
				bind:value
				oninput={handleChange}
			></textarea>
		{:else if field.type === 'TEXT'}
			<input
				id="entry.{field.id}"
				name="entry.{field.id}"
				required={field.required}
				bind:value
				oninput={handleChange}
			/>
		{/if}
	{:else if field.type === 'DROPDOWN'}
		<label for="entry.{field.id}">
			{#if field.required}
				<span class="required-mark">*</span>
			{/if}
			{@html parseMarkdown(localeText(field.bilingualTitle, locale, field.title))}
			{#if field.bilingualTitle}<button
					type="button"
					class="lang-toggle"
					class:toggled={titleToggled}
					onclick={(e) => {
						e.stopPropagation()
						titleToggled = !titleToggled
					}}>🌐</button
				><span class="lang-alt">{otherLang(field.bilingualTitle)}</span>{/if}
			<div>
				<small>
					{@html parseMarkdown(
						localeText(field.bilingualDescription, locale, field.description ?? ''),
					)}
				</small>
			</div>
		</label>
		{#if field.imgUrl}
			<center class="question-image">
				<img src={imgSrc(field.imgUrl)} alt="" />
			</center>
		{/if}

		<select
			id="entry.{field.id}"
			name="entry.{field.id}"
			required={field.required}
			bind:value
			onchange={handleChange}
		>
			<option value="">Choose</option>
			{#each field.options as option, i (option)}
				<option value={option}>{localeText(field.bilingualOptions?.[i], locale, option)}</option>
			{/each}
		</select>
	{:else if ['MULTIPLE_CHOICE', 'CHECKBOXES'].includes(field.type)}
		<label for="">
			{#if field.required}
				<span class="required-mark">*</span>
			{/if}
			{@html parseMarkdown(localeText(field.bilingualTitle, locale, field.title))}
			{#if field.bilingualTitle}<button
					type="button"
					class="lang-toggle"
					class:toggled={titleToggled}
					onclick={(e) => {
						e.stopPropagation()
						titleToggled = !titleToggled
					}}>🌐</button
				><span class="lang-alt">{otherLang(field.bilingualTitle)}</span>{/if}
			<div>
				<small>
					{@html parseMarkdown(
						localeText(field.bilingualDescription, locale, field.description ?? ''),
					)}
				</small>
			</div>
		</label>
		{#if field.imgUrl}
			<center class="question-image">
				<img src={imgSrc(field.imgUrl)} alt="" />
			</center>
		{/if}

		{#each field.options as option, i (option)}
			<label>
				{#if field.type === 'CHECKBOXES' || field.options.length === 1}
					<input
						type="checkbox"
						id="entry.{field.id}"
						name="entry.{field.id}"
						value={option}
						bind:group
						onchange={handleChange}
					/>
				{:else}
					<input
						type="radio"
						id="entry.{field.id}"
						name="entry.{field.id}"
						value={option}
						bind:group={value}
						onchange={handleChange}
					/>
				{/if}{localeText(
					field.bilingualOptions?.[i],
					locale,
					option,
				)}{#if field.bilingualOptions?.[i]}<button
						type="button"
						class="lang-toggle"
						class:toggled={optionToggles.has(i)}
						onclick={(e) => {
							e.stopPropagation()
							if (optionToggles.has(i)) optionToggles.delete(i)
							else optionToggles.add(i)
						}}>🌐</button
					><span class="lang-alt">{otherLang(field.bilingualOptions[i]!)}</span>{/if}
			</label>
		{/each}
		{#if field.type === 'CHECKBOXES' && field.required}
			<input
				type="checkbox"
				style="opacity:0; position:absolute; margin-top:-1.5em; pointer-events:none"
				tabindex="-1"
				required={mounted && group.length === 0}
				disabled={!mounted || group.length > 0}
			/>
		{/if}
	{:else}
		<div class="hidden">
			TODO: {field.type}
			<pre>{JSON.stringify(field, null, 4)}</pre>
		</div>
	{/if}
	<pre hidden>{JSON.stringify({ value, group, storeValue }, null, 4)}</pre>
</d-section>

<style lang="scss">
	@use 'open-props-scss' as *;

	:global(.wrap-youtube) {
		position: relative;
		width: 100%;
		height: 0;
		padding-bottom: 56.25%;
	}
	:global(.youtube) {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
	}

	d-section {
		margin-top: 2em;
		margin-bottom: 2em;
	}

	d-section:first-of-type,
	.has-input {
		margin-bottom: 0;
		margin-top: 0;
	}

	small {
		opacity: 0.5;
		font-size: 80%;
	}

	label[for] {
		font-weight: bold;
		margin-top: 1.5em;
	}

	.question-image {
		margin-bottom: calc(var(--app-spacing) * 0.375);
	}

	.required-mark {
		color: $red-7;
	}

	.hidden {
		display: none;
	}

	:global(a[role='button']) {
		width: 100%;
	}

	.lang-toggle {
		all: unset;
		display: inline;
		cursor: pointer;
		font-size: 0.7em;
		vertical-align: middle;
		opacity: 0.5;
		margin-left: 0.3em;
		transition: opacity 0.15s;
		user-select: none;
		filter: grayscale(1);

		&:hover,
		&:focus-visible {
			opacity: 1;
		}
	}

	.lang-alt {
		display: none;
		font-style: italic;
		font-weight: normal;
		font-size: 0.85em;
		margin-left: 0;
	}

	/* Hover: faint preview */
	.lang-toggle:hover + .lang-alt {
		display: inline;
		opacity: 0.35;
	}

	/* Pinned: full display, wins over hover */
	.lang-toggle.toggled + .lang-alt {
		display: inline;
		opacity: 0.6;
	}
</style>
