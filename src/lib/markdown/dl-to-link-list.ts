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
 * If any term has multiple definitions or the definition text isn’t a URL,
 * the original block is kept and a console.warn is emitted.
 */
export function linkListifyDefinitionList(markdown: string): string {
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

			// only handle single-URL defs
			if (defs.length === 1) {
				const m = defs[0].match(/^~\s*(https?:\/\/\S+)\s*$/)
				if (m) {
					out.push(`- [${term}](${m[1]})`)
					i = j
					continue
				}
			}

			// fallback: emit original block
			console.warn(
				`Skipped def-list at line ${i + 1}: ` +
					`found ${defs.length} “~” lines or non-URL definition.`,
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
