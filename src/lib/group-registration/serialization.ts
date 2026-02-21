/**
 * Group registration serialization — converts between structured member rows
 * and the compact text format stored in the Google Form paragraph field.
 *
 * See specs/group-registration.md § Serialization Format for the full grammar.
 */

// --- Types ---

export type Role = 'leader' | 'follower' | 'both' | null

export interface GroupMember {
	name: string
	role: Role
}

// --- Role prefix tables ---

/** Maps a single role letter to its meaning. */
const ROLE_LETTER: Record<string, 'leader' | 'follower'> = {
	l: 'leader',
	ㄹ: 'leader',
	f: 'follower',
	ㅍ: 'follower',
}

/** All recognised single-char role letters (case-insensitive matching done via lowercase). */
const ROLE_CHARS = new Set(Object.keys(ROLE_LETTER))

/**
 * Resolve a raw prefix string (everything before the colon, lowercased) to a Role.
 * Handles single letters, combo pairs, and the `b` alias.
 */
function resolvePrefix(raw: string): Role {
	const lc = raw.toLowerCase()

	// "b" is shorthand for "both"
	if (lc === 'b') return 'both'

	// Single role letter
	if (lc.length === 1 && ROLE_CHARS.has(lc)) {
		return ROLE_LETTER[lc]!
	}

	// Two-char combo (e.g. "lf", "fl", "ㄹf", "fㄹ")
	if (lc.length === 2) {
		const a = ROLE_LETTER[lc[0]]
		const b = ROLE_LETTER[lc[1]]
		if (a && b && a !== b) return 'both'
	}

	// Unrecognised — treat as no role (caller will include raw as part of name)
	return null
}

// --- Serialize ---

/** Canonical prefix strings for serializer output. */
const ROLE_PREFIX: Record<string, string> = {
	leader: 'L',
	follower: 'F',
	both: 'LF', // spec: prefer LF over B
}

/**
 * Serialize an array of additional group members (rows 2+) into the compact
 * newline-delimited text format for the paragraph field.
 *
 * Returns an empty string when the array is empty.
 */
export function serialize(members: GroupMember[]): string {
	if (members.length === 0) return ''

	const lines: string[] = []

	for (const { name, role } of members) {
		const prefix = role ? ROLE_PREFIX[role] : ''
		if (name) {
			lines.push(prefix ? `${prefix}:${name}` : name)
		} else if (prefix) {
			// unnamed member with a role → counted syntax "1L", "1F", "1LF"
			lines.push(`1${prefix}`)
		} else {
			// unnamed, no role → bare count
			lines.push('1')
		}
	}

	return lines.join('\n')
}

// --- Parse ---

/**
 * Regex for a counted-role token: one or more digits followed by one or two role letters.
 * Captures: [1] = count, [2] = role letters
 * Must match the ENTIRE token.
 */
const RE_COUNTED = /^(\d+)([LlFfBbㄹㅍ]{1,2})$/

/**
 * Regex for a bare count: digits only.
 */
const RE_BARE_COUNT = /^(\d+)$/

/**
 * Parse the compact text format back into an array of GroupMember objects.
 *
 * Accepts newline-delimited, space-delimited, or mixed input.
 * Tolerant of blank lines, extra whitespace, and mixed quoting.
 */
export function parse(text: string): GroupMember[] {
	if (!text || !text.trim()) return []

	const members: GroupMember[] = []

	// Split on newlines first; each line may contain multiple entries.
	const lines = text.split(/\r?\n/)

	for (const line of lines) {
		members.push(...parseLine(line))
	}

	return members
}

/**
 * Parse a single line into one or more GroupMember entries.
 *
 * Strategy: tokenize the line, then try parsing each token. If a token has a
 * role prefix but the subsequent "tokens" are plain words (no prefix, not
 * counted/bare-count), they are continuation words of the same name.
 * This lets "F:Jane Doe" on its own line work without quotes.
 */
function parseLine(line: string): GroupMember[] {
	const tokens = tokenizeLine(line)
	if (tokens.length === 0) return []

	const members: GroupMember[] = []
	let i = 0

	while (i < tokens.length) {
		const token = tokens[i]
		const parsed = parseToken(token)

		// If this token parsed as a single named entry WITH a role prefix,
		// greedily absorb any following plain-word tokens as part of the name.
		if (
			parsed.length === 1 &&
			parsed[0].role !== null &&
			parsed[0].name !== '' &&
			token.includes(':')
		) {
			let name = parsed[0].name
			let j = i + 1
			while (j < tokens.length && isPlainWord(tokens[j])) {
				name += ' ' + tokens[j]
				j++
			}
			members.push({ name, role: parsed[0].role })
			i = j
		} else {
			members.push(...parsed)
			i++
		}
	}

	return members
}

/**
 * Returns true if a token is a "plain word" — not a structured entry.
 * Plain words have no colon, don't match counted-role, and don't match bare-count.
 */
function isPlainWord(token: string): boolean {
	if (token.includes(':')) return false
	if (RE_COUNTED.test(token)) return false
	if (RE_BARE_COUNT.test(token)) return false
	return true
}

/**
 * Split a single line into tokens, respecting single/double quotes.
 * Unquoted tokens are split on whitespace.
 */
function tokenizeLine(line: string): string[] {
	const tokens: string[] = []
	let i = 0
	const len = line.length

	while (i < len) {
		// Skip whitespace
		while (i < len && /\s/.test(line[i])) i++
		if (i >= len) break

		const ch = line[i]
		if (ch === '"' || ch === "'") {
			// Quoted token — find matching close quote
			const quote = ch
			i++ // skip opening quote
			const start = i
			while (i < len && line[i] !== quote) i++
			tokens.push(line.slice(start, i))
			if (i < len) i++ // skip closing quote
		} else {
			// Unquoted token — read until whitespace
			const start = i
			while (i < len && !/\s/.test(line[i])) i++
			tokens.push(line.slice(start, i))
		}
	}

	return tokens
}

/**
 * Parse a single token into one or more GroupMember entries.
 * A token is one of:
 *   - "ROLE:Name"    → named entry with role
 *   - "Name"         → named entry without role
 *   - "3F"           → counted role (expands to N members)
 *   - "3"            → bare count (N unnamed, no role)
 */
function parseToken(token: string): GroupMember[] {
	if (!token) return []

	// Check for counted-role syntax first (e.g. "3F", "2LF", "3ㄹ")
	const countedMatch = token.match(RE_COUNTED)
	if (countedMatch) {
		const count = parseInt(countedMatch[1], 10)
		const role = resolvePrefix(countedMatch[2])
		return Array.from({ length: count }, () => ({ name: '', role }))
	}

	// Check for bare count (e.g. "3")
	const bareMatch = token.match(RE_BARE_COUNT)
	if (bareMatch) {
		const count = parseInt(bareMatch[1], 10)
		return Array.from({ length: count }, () => ({ name: '', role: null }))
	}

	// Check for role prefix (colon-delimited)
	const colonIndex = token.indexOf(':')
	if (colonIndex !== -1) {
		const rawPrefix = token.slice(0, colonIndex)
		const name = token.slice(colonIndex + 1)

		// Only treat as a role prefix if it resolves to a valid role
		const role = resolvePrefix(rawPrefix)
		if (role !== null) {
			return [{ name, role }]
		}
		// Unrecognised prefix — entire token is the name (edge case: name contains colon)
		return [{ name: token, role: null }]
	}

	// Plain name, no role
	return [{ name: token, role: null }]
}
