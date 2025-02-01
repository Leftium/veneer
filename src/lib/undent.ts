// Based on: https://github.com/bscotch/jslib/blob/develop/packages/utility/src/lib/strings.ts

function withoutInitialLinebreaks(string: string) {
	return string.replace(/^[\r\n]+/, '')
}

function withoutTrailingWhitespace(string: string) {
	return string.replace(/\s+$/, '')
}

function cleanTemplate(strings: TemplateStringsArray, ...interps: unknown[]) {
	// Trim these things up
	const cleanStrings = [...strings]
	cleanStrings[0] = withoutInitialLinebreaks(cleanStrings[0])
	const lastStringIdx = cleanStrings.length - 1
	cleanStrings[lastStringIdx] = withoutTrailingWhitespace(cleanStrings[lastStringIdx])

	// For each interp, if it has newlines when stringified each
	// line after the first needs to inherit the indentation
	// level of its starting point.
	let string = ''
	for (let i = 0; i < cleanStrings.length; i++) {
		string += cleanStrings[i]
		if (i == lastStringIdx) {
			break
		}
		let interp = `${interps[i]}`
		const linebreakRegex = /(\r?\n)/
		const interpLines = interp.split(linebreakRegex).filter((x) => x)
		if (interpLines.length && i < lastStringIdx) {
			// How indented are we?
			const indentMatch = string.match(/\n?([^\n]+?)$/)
			if (indentMatch) {
				// amount of indent to add to each entry that is a break
				// (skip the last one, since if it's a newline we don't
				//  want that to cause an indent on the next line also)
				for (let i = 0; i < interpLines.length; i++) {
					if (interpLines[i].match(linebreakRegex)) {
						interpLines[i] += ' '.repeat(indentMatch[1].length)
					}
				}
			}
		}
		interp = interpLines.join('')
		string += interp
	}
	return string
}

export function sortStringsByLength(strings: string[]) {
	return strings.sort((string1, string2) => string1.length - string2.length)
}

export function getShortestString(strings: string[]) {
	return sortStringsByLength(strings)[0]
}

export function undent(strings: TemplateStringsArray, ...interps: unknown[]) {
	const string = cleanTemplate(strings, ...interps)
	// Remove initial and final newlines
	// Find all indentations *on lines that are not just whitespace!*
	const indentRegex = /^(?<indent>[ \t]*)(?<nonSpace>[^\s])?/
	const dents: string[] | null = string
		.match(new RegExp(indentRegex, 'gm'))
		?.map((dentedLine): string | void => {
			const { indent, nonSpace } = dentedLine.match(indentRegex)!.groups as {
				indent?: string
				nonSpace?: string
			}
			const isNotJustWhitespace = nonSpace?.length
			if (isNotJustWhitespace) {
				return indent || ''
			}
			return
		})
		.filter((indentLevel) => typeof indentLevel == 'string') as string[]
	if (!dents || dents.length == 0) {
		return string
	}
	const minDent = getShortestString(dents)
	if (!minDent) {
		// Then min indentation is 0, no change needed
		return string
	}
	const dedented = string.replace(new RegExp(`^${minDent}`, 'gm'), '')
	return dedented
}
