/**
 * Bilingual content parsing utilities for Korean/English Google Forms.
 *
 * **Feature A — Labels/options**: Convention `한국어 (English)` or `English (한국어)`
 * for labels and options. Splits when both parts are different scripts.
 *
 * **Feature B — Content sections**: Explicit markers in form description text:
 *   `~~ begin Korean ~~` / `~~ end Korean ~~`
 *   `~~ begin English ~~` / `~~ end English ~~`
 * Content between markers is tagged with that language; content outside markers
 * is shared (always visible). Non-locale sections are collapsed in `<details>`.
 *
 * These pure functions detect and split bilingual text so components can
 * display the locale-appropriate text and offer the other language via
 * toggles or collapsible sections.
 */

export interface BilingualText {
	ko: string
	en: string
	original: string
}

/** @deprecated Use ContentSegment[] from segmentBilingualContent() instead */
export interface BilingualContent {
	ko: string
	en: string
	delimiter: string
	original: string
	firstScript: 'ko' | 'en'
}

// ---------------------------------------------------------------------------
// Script classification
// ---------------------------------------------------------------------------

/** Hangul Syllables + Jamo + Compatibility Jamo */
const RE_KOREAN = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g

/** Basic Latin letters (ASCII) */
const RE_LATIN = /[A-Za-z]/g

/**
 * Classify a string as predominantly Korean, English, or mixed/unknown.
 *
 * Counts Korean characters vs Latin characters. A string is classified as
 * one script if that script accounts for >60% of the total script characters.
 * If neither dominates, returns 'mixed'.
 */
export function classifyScript(text: string): 'ko' | 'en' | 'mixed' {
	const koCount = (text.match(RE_KOREAN) || []).length
	const enCount = (text.match(RE_LATIN) || []).length
	const total = koCount + enCount

	if (total === 0) return 'mixed'
	if (koCount / total > 0.6) return 'ko'
	if (enCount / total > 0.6) return 'en'
	return 'mixed'
}

// ---------------------------------------------------------------------------
// Label / option splitting — Feature A
// ---------------------------------------------------------------------------

/**
 * Find the last balanced parenthetical group at the end of a string.
 *
 * Walks backwards from the end (skipping trailing whitespace) to find a
 * closing `)`, then scans left counting nested parens until the matching
 * `(` is found. Returns `[primary, secondary]` or `null` if no trailing
 * balanced group exists.
 *
 * Examples:
 *   "닉네임 (Nickname)" → ["닉네임", "Nickname"]
 *   "입금자명 (닉네임으로 꼭 입금) (Sender's Name (ex. Jenny))"
 *     → ["입금자명 (닉네임으로 꼭 입금)", "Sender's Name (ex. Jenny)"]
 */
function splitTrailingParenGroup(text: string): [string, string] | null {
	const trimmed = text.trimEnd()
	if (!trimmed.endsWith(')')) return null

	let depth = 0
	let i = trimmed.length - 1
	for (; i >= 0; i--) {
		if (trimmed[i] === ')') depth++
		else if (trimmed[i] === '(') depth--
		if (depth === 0) break
	}

	// No balanced group found, or group starts at position 0 (nothing before it)
	if (depth !== 0 || i <= 0) return null

	const primary = trimmed.slice(0, i).trimEnd()
	const secondary = trimmed.slice(i + 1, trimmed.length - 1) // strip outer ( )

	if (!primary || !secondary) return null
	return [primary, secondary]
}

/**
 * Attempt to split a label or option string into Korean and English parts.
 *
 * Returns a `BilingualText` if the string ends with a balanced `(Secondary)`
 * group and the two parts are different scripts (one Korean, one English).
 * Returns `null` if the pattern doesn't match or both parts are the same
 * script (i.e. it's just a regular parenthetical like `리드 (선택)`).
 *
 * Handles nested parentheses:
 *   `입금자명 (닉네임으로 꼭 입금, 예, 제니) (Sender's Name (Put your nick name, ex. Jenny))`
 *   → ko: `입금자명 (닉네임으로 꼭 입금, 예, 제니)`, en: `Sender's Name (Put your nick name, ex. Jenny)`
 */
export function splitBilingualLabel(text: string): BilingualText | null {
	if (!text) return null

	const parts = splitTrailingParenGroup(text)
	if (!parts) return null

	const [primary, secondary] = parts

	const primaryScript = classifyScript(primary)
	const secondaryScript = classifyScript(secondary)

	// Both must be classifiable and different scripts
	if (primaryScript === 'mixed' || secondaryScript === 'mixed') return null
	if (primaryScript === secondaryScript) return null

	return {
		ko: primaryScript === 'ko' ? primary : secondary,
		en: primaryScript === 'en' ? primary : secondary,
		original: text,
	}
}

// ---------------------------------------------------------------------------
// Content section segmentation — Feature B
// ---------------------------------------------------------------------------

/**
 * A content segment: either shared (always visible), Korean-only, or English-only.
 */
export interface ContentSegment {
	/** 'ko' = Korean only, 'en' = English only, 'shared' = always visible */
	lang: 'ko' | 'en' | 'shared'
	/** The text content of this segment (marker lines excluded) */
	text: string
}

/**
 * Marker patterns for bilingual content sections.
 *
 * Format: `~~ begin Korean ~~` / `~~ end Korean ~~` (case-insensitive).
 * In plain Google Forms these look like decorative section dividers.
 *
 * - `begin korean` / `end korean` → Korean-only section
 * - `begin english` / `end english` → English-only section
 */
const RE_BEGIN_MARKER = /^\s*~~\s*begin\s+(korean|english)\s*~~\s*$/i
const RE_END_MARKER = /^\s*~~\s*end\s+(korean|english)\s*~~\s*$/i

/**
 * Segment multi-line content into shared, Korean-only, and English-only chunks.
 *
 * Scans for `~~ begin Korean ~~` / `~~ end Korean ~~` (and English) marker
 * lines. Content between matching begin/end pairs is tagged with that language.
 * Content outside any markers is tagged 'shared' (always visible).
 *
 * Returns `null` if no markers are found (content is monolingual).
 */
export function segmentBilingualContent(text: string): ContentSegment[] | null {
	if (!text) return null

	const lines = text.split('\n')
	const segments: ContentSegment[] = []
	let currentLang: 'ko' | 'en' | 'shared' = 'shared'
	let buffer: string[] = []

	function flush() {
		const joined = buffer.join('\n').trim()
		if (joined) {
			segments.push({ lang: currentLang, text: joined })
		}
		buffer = []
	}

	let foundMarker = false

	for (const line of lines) {
		const beginMatch = line.match(RE_BEGIN_MARKER)
		if (beginMatch) {
			foundMarker = true
			flush()
			currentLang = beginMatch[1].toLowerCase() === 'korean' ? 'ko' : 'en'
			continue
		}

		const endMatch = line.match(RE_END_MARKER)
		if (endMatch) {
			foundMarker = true
			flush()
			currentLang = 'shared'
			continue
		}

		buffer.push(line)
	}

	// Flush remaining content
	flush()

	if (!foundMarker) return null
	return segments
}

// ---------------------------------------------------------------------------
// Batch transform for Question arrays
// ---------------------------------------------------------------------------

import type { Question } from '$lib'

export interface BilingualQuestion extends Question {
	/** Bilingual split of the title, if detected */
	bilingualTitle?: BilingualText
	/** Bilingual split of the description, if detected */
	bilingualDescription?: BilingualText
	/** Bilingual splits of options, parallel to options[]. null entries = not bilingual */
	bilingualOptions?: (BilingualText | null)[]
}

/**
 * Process a Question, attempting to split bilingual labels/options.
 * Returns a new object with bilingual fields added (original fields unchanged).
 */
export function addBilingualData(question: Question): BilingualQuestion {
	const result: BilingualQuestion = { ...question }

	// Title
	result.bilingualTitle = splitBilingualLabel(question.title) ?? undefined

	// Description
	if (question.description) {
		result.bilingualDescription = splitBilingualLabel(question.description) ?? undefined
	}

	// Options
	if (question.options && question.options.length > 0) {
		const splits = question.options.map((opt) => splitBilingualLabel(opt))
		// Only attach if at least one option was bilingual
		if (splits.some((s) => s !== null)) {
			result.bilingualOptions = splits
		}
	}

	return result
}

/**
 * Get the locale-appropriate text from a BilingualText, falling back to original.
 */
export function localeText(
	bilingual: BilingualText | undefined | null,
	locale: string,
	fallback: string,
): string {
	if (!bilingual) return fallback
	return locale === 'ko' ? bilingual.ko : bilingual.en
}

/**
 * Get the "other" locale text for use as a tooltip.
 */
export function localeTooltip(
	bilingual: BilingualText | undefined | null,
	locale: string,
): string | undefined {
	if (!bilingual) return undefined
	return locale === 'ko' ? bilingual.en : bilingual.ko
}
