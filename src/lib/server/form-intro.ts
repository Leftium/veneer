import type { GoogleFormDocument } from '#lib/google-document-util/types.js'
import { googleImageUrl } from '#lib/google-document-util/google-image-url.js'

/** One source selection for the page's Markdown and the external API's plain text. */
export function extractFormIntro(form: Pick<GoogleFormDocument, 'fields'>) {
	let skippedFirstTitle = false
	let description: string | null = null
	const text: string[] = []
	const markdown: string[] = []
	const end = form.fields.findIndex(
		(f) => !['TITLE_AND_DESCRIPTION', 'IMAGE', 'VIDEO', 'PAGE_BREAK'].includes(f.type),
	)
	const intro = form.fields.slice(0, end === -1 ? undefined : end)
	for (const field of intro) {
		let block = ''
		const parts: string[] = []
		if (field.type === 'TITLE_AND_DESCRIPTION') {
			if (!skippedFirstTitle) {
				skippedFirstTitle = true
				description = field.description
			} else if (field.title) {
				block += `# ${field.title}\n`
				parts.push(field.title)
			}
			if (field.description) {
				block += `${field.description}\n`
				parts.push(field.description)
			}
		} else if (field.type === 'IMAGE') {
			if (field.title) block += `# ${field.title}\n`
			block += `![](${googleImageUrl(field.imgUrl?.replace(/=w\d+$/i, ''))})\n`
		}
		markdown.push(block)
		if (parts.length) text.push(parts.join('\n'))
	}
	const sections = markdown
		.join('\n')
		.split(/^={3,}[^\S\r\n]*(?<header>[^=\s].*?)[^\S\r\n]*={3,}[^\S\r\n]*$/m)
	const info = sections.shift() || 'EMPTY'
	const footers = sections.reduce((result, footer, i) => {
		if (i % 2 === 0) {
			const header = footer ? `# ${footer}` : ''
			result.push(`${header}\n<div>${sections[i + 1] || ''}</div>`)
		}
		return result
	}, [] as string[])
	return { info, footers, description, infoText: text.join('\n\n') }
}
