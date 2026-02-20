/**
 * Pattern detection for group registration fields.
 *
 * Scans an array of form fields for two or three consecutive fields matching:
 *   1. TEXT or PARAGRAPH_TEXT whose title matches REGEX_DANCE_NAME (required)
 *   2. (optional) CHECKBOXES or MULTIPLE_CHOICE whose options match REGEX_DANCE_LEADER/FOLLOW
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
	/** The role field (CHECKBOXES or MULTIPLE_CHOICE), if present. */
	roleField?: Question
	/** The group paragraph field (PARAGRAPH_TEXT). */
	groupField: Question
}

/**
 * Scan fields for the group registration pattern (2- or 3-field).
 * Returns all matches found (typically zero or one).
 */
export function detectGroupRegistration(fields: Question[]): GroupRegistrationMatch[] {
	const matches: GroupRegistrationMatch[] = []

	for (let i = 0; i < fields.length; i++) {
		const f1 = fields[i]

		// Field 1: TEXT or PARAGRAPH_TEXT with title matching REGEX_DANCE_NAME, required
		if (!['TEXT', 'PARAGRAPH_TEXT'].includes(f1.type)) continue
		if (!REGEX_DANCE_NAME.test(f1.title)) continue
		if (!f1.required) continue

		// Try 3-field pattern: name + role + group
		if (i + 2 < fields.length) {
			const f2 = fields[i + 1]
			const f3 = fields[i + 2]

			const isRoleField =
				['CHECKBOXES', 'MULTIPLE_CHOICE'].includes(f2.type) &&
				f2.options.some((o) => REGEX_DANCE_LEADER.test(o)) &&
				f2.options.some((o) => REGEX_DANCE_FOLLOW.test(o))

			if (isRoleField && f3.type === 'PARAGRAPH_TEXT' && REGEX_DANCE_GROUP.test(f3.title)) {
				matches.push({
					startIndex: i,
					nameField: f1,
					roleField: f2,
					groupField: f3,
				})
				i += 2
				continue
			}
		}

		// Try 2-field pattern: name + group (no role)
		if (i + 1 < fields.length) {
			const f2 = fields[i + 1]

			if (f2.type === 'PARAGRAPH_TEXT' && REGEX_DANCE_GROUP.test(f2.title)) {
				matches.push({
					startIndex: i,
					nameField: f1,
					groupField: f2,
				})
				i += 1
				continue
			}
		}
	}

	return matches
}
