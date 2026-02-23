/**
 * Scans the input markdown for definition‐list blocks:
 *
 *   Term
 *   ~ https://example.com
 *
 * and replaces each with:
 *
 *   - [Term](https://example.com)
 *
 * Optionally, a second `~` line can specify an Iconify icon:
 *
 *   Term
 *   ~ https://example.com
 *   ~ icon:set:name
 *
 * which produces:
 *
 *   - [<iconify-icon icon="set:name" width="16" height="16" ...></iconify-icon> Term](https://example.com)
 *
 * If any term has unrecognized definitions or the definition text isn't a URL,
 * the original block is kept and a console.warn is emitted.
 *
 * When a `locale` is provided, bilingual labels like `카톡 송금 (KakaoPay)` are
 * split: the locale-appropriate text is shown as the link label, and the other
 * language is shown as a native tooltip (title attribute).
 */

import { splitBilingualLabel, localeText } from '$lib/locale-content'

const ICON_STYLE = 'vertical-align: -0.125em; margin-left: -20px; margin-right: 4px;'

// Matches absolute URLs (https://...) and relative paths (/...) including bare /
const URL_RE = /^~\s*((?:https?:\/\/)\S+|\/\S*)\s*$/

function makeIconTag(iconName: string): string {
	return `<iconify-icon icon="${iconName}" width="16" height="16" style="${ICON_STYLE}"></iconify-icon>`
}

/** Get the locale-appropriate label and a tooltip for the other language. */
function localizeTerm(term: string, locale?: string): { label: string; tooltip: string | null } {
	if (!locale) return { label: term, tooltip: null }
	const bilingual = splitBilingualLabel(term)
	if (!bilingual) return { label: term, tooltip: null }
	const label = localeText(bilingual, locale, term)
	const other = locale === 'ko' ? bilingual.en : bilingual.ko
	// Escape double quotes for markdown link title syntax: [text](url "title")
	return { label, tooltip: other.replace(/"/g, '&quot;') }
}

export function linkListifyDefinitionList(markdown: string, locale?: string): string {
	const lines = markdown.split(/\r?\n/)
	const out: string[] = []
	let i = 0

	while (i < lines.length) {
		const term = lines[i]
		const nextIdx = i + 1

		if (nextIdx < lines.length && lines[nextIdx].startsWith('~')) {
			// collect all consecutive `~ …` lines
			const defs: string[] = []
			let j = nextIdx
			while (j < lines.length && lines[j].startsWith('~')) {
				defs.push(lines[j])
				j++
			}

			// single `~` line: URL only (no icon)
			if (defs.length === 1) {
				const m = defs[0].match(URL_RE)
				if (m) {
					const { label, tooltip } = localizeTerm(term, locale)
					const titlePart = tooltip ? ` "${tooltip}"` : ''
					out.push(`- [${label}](${m[1]}${titlePart})`)
					i = j
					continue
				}
			}

			// two `~` lines: URL + icon
			if (defs.length === 2) {
				const urlMatch = defs[0].match(URL_RE)
				const iconMatch = defs[1].match(/^~\s*icon:(\S+)\s*$/)
				if (urlMatch && iconMatch) {
					const icon = makeIconTag(iconMatch[1])
					const { label, tooltip } = localizeTerm(term, locale)
					const titlePart = tooltip ? ` "${tooltip}"` : ''
					out.push(`- [${icon}${label}](${urlMatch[1]}${titlePart})`)
					i = j
					continue
				}
			}

			// fallback: emit original block
			console.warn(
				`Skipped def-list at line ${i + 1}: ` +
					`found ${defs.length} "~" lines or non-URL definition.`,
			)
			out.push(term, ...defs)
			i = j
			continue
		}

		// not a def-list starter
		out.push(term)
		i++
	}

	// now remove blank lines *only* when they're directly between two list items
	const finalLines: string[] = []
	const joined = out.join('\n').split('\n')
	for (let k = 0; k < joined.length; k++) {
		const line = joined[k]
		const prev = finalLines[finalLines.length - 1] || ''
		const next = joined[k + 1] || ''

		if (line.trim() === '' && prev.startsWith('- ') && next.startsWith('- ')) {
			continue // drop this blank line
		}

		finalLines.push(line)
	}

	return finalLines.join('\n')
}
