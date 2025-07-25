import MarkdownIt from 'markdown-it'
import type { Options, PluginSimple, PluginWithOptions } from 'markdown-it'
import { undent } from './undent'

export function makeTagFunctionMd(
	options: Options,
	plugins: Array<[PluginSimple | PluginWithOptions<unknown>, unknown?]> = [],
) {
	const parser = new MarkdownIt(options)
	plugins.forEach(([plugin, opts]) => parser.use(plugin, opts))

	return function md(
		strings: TemplateStringsArray,
		...values: Array<string | number | boolean | null | undefined>
	) {
		const undented = undent(strings, ...values)
		return parser.render(undented)
	}
}

export function linkifyRelative(md: MarkdownIt) {
	md.core.ruler.after('inline', 'relative_linkify', (state) => {
		for (const token of state.tokens) {
			if (token.type !== 'inline' || !token.children) continue

			const newTokens = []

			for (const child of token.children) {
				if (child.type === 'text') {
					const parts = child.content.split(/(?=\s|^)(\/[^\s"'<>]+)(?=\s|$)/g)

					for (const part of parts) {
						if (/^\/[^\s"'<>]+$/.test(part)) {
							const openToken = new state.Token('link_open', 'a', 1)
							openToken.attrs = [['href', part]]

							const textToken = new state.Token('text', '', 0)
							textToken.content = part

							const closeToken = new state.Token('link_close', 'a', -1)

							newTokens.push(openToken, textToken, closeToken)
						} else {
							const textToken = new state.Token('text', '', 0)
							textToken.content = part
							newTokens.push(textToken)
						}
					}
				} else {
					newTokens.push(child)
				}
			}

			token.children = newTokens
		}
	})
}
