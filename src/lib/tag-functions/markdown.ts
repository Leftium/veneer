/* eslint-disable @typescript-eslint/no-explicit-any */
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

const REL_LINK_RE = /(?<=^|\s)(\/[^\s"'<>]+)(?=\s|$)/g

export function linkifyRelative(md: {
	core: { ruler: { after: (arg0: string, arg1: string, arg2: (state: any) => void) => void } }
}) {
	md.core.ruler.after(
		'inline',
		'relative_linkify',
		(state: { tokens: any; Token: new (arg0: string, arg1: string, arg2: number) => any }) => {
			for (const token of state.tokens) {
				if (token.type !== 'inline' || !token.children) continue

				const newTokens = []
				for (const child of token.children) {
					if (child.type === 'text') {
						let lastIndex = 0
						let match

						while ((match = REL_LINK_RE.exec(child.content))) {
							const [path] = match
							const start = match.index
							const end = start + path.length

							// Text before the match
							if (start > lastIndex) {
								const txt = child.content.slice(lastIndex, start)
								const t = new state.Token('text', '', 0)
								t.content = txt
								newTokens.push(t)
							}

							// The link token
							const open = new state.Token('link_open', 'a', 1)
							open.attrs = [['href', path]]
							const txt = new state.Token('text', '', 0)
							txt.content = path
							const close = new state.Token('link_close', 'a', -1)

							newTokens.push(open, txt, close)
							lastIndex = end
						}

						// Remaining text after last match
						if (lastIndex < child.content.length) {
							const t = new state.Token('text', '', 0)
							t.content = child.content.slice(lastIndex)
							newTokens.push(t)
						}
					} else {
						newTokens.push(child)
					}
				}

				token.children = newTokens
			}
		},
	)
}
