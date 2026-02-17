/**
 * Pattern detection for group registration fields.
 *
 * Scans an array of form fields for three consecutive fields matching:
 *   1. TEXT or PARAGRAPH_TEXT whose title matches REGEX_DANCE_NAME (required)
 *   2. CHECKBOXES or MULTIPLE_CHOICE whose options match REGEX_DANCE_LEADER/FOLLOW (required)
 *   3. PARAGRAPH_TEXT whose title matches REGEX_DANCE_GROUP (not required)
 *
 * See specs/group-registration.md § Pattern Detection.
 */

import type { Question } from '$lib'
import {
	REGEX_DANCE_NAME,
	REGEX_DANCE_LEADER,
	REGEX_DANCE_FOLLOW,
	REGEX_DANCE_GROUP,
} from '$lib/dance-constants'

export interface GroupRegistrationMatch {
	/** Index of the first matched field (name field) in the fields array. */
	startIndex: number
	/** The name field (TEXT or PARAGRAPH_TEXT). */
	nameField: Question
	/** The role field (CHECKBOXES or MULTIPLE_CHOICE). */
	roleField: Question
	/** The group paragraph field (PARAGRAPH_TEXT). */
	groupField: Question
}

/**
 * Scan fields for the group registration triple pattern.
 * Returns all matches found (typically zero or one).
 */
export function detectGroupRegistration(fields: Question[]): GroupRegistrationMatch[] {
	const matches: GroupRegistrationMatch[] = []

	for (let i = 0; i <= fields.length - 3; i++) {
		const f1 = fields[i]
		const f2 = fields[i + 1]
		const f3 = fields[i + 2]

		// Field 1: TEXT or PARAGRAPH_TEXT with title matching REGEX_DANCE_NAME, required
		if (!['TEXT', 'PARAGRAPH_TEXT'].includes(f1.type)) continue
		if (!REGEX_DANCE_NAME.test(f1.title)) continue
		if (!f1.required) continue

		// Field 2: CHECKBOXES or MULTIPLE_CHOICE with option values matching leader/follow, required
		if (!['CHECKBOXES', 'MULTIPLE_CHOICE'].includes(f2.type)) continue
		if (!f2.required) continue
		const hasLeader = f2.options.some((o) => REGEX_DANCE_LEADER.test(o))
		const hasFollow = f2.options.some((o) => REGEX_DANCE_FOLLOW.test(o))
		if (!hasLeader || !hasFollow) continue

		// Field 3: PARAGRAPH_TEXT with title containing "group", not required
		if (f3.type !== 'PARAGRAPH_TEXT') continue
		if (!REGEX_DANCE_GROUP.test(f3.title)) continue

		matches.push({
			startIndex: i,
			nameField: f1,
			roleField: f2,
			groupField: f3,
		})

		// Skip past this triple to avoid overlapping matches
		i += 2
	}

	return matches
}
