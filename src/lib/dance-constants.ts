import type { Preset } from './presets.js'

// Shared dance-event regexes
export const REGEX_DANCE_NAME = /name|닉네임/i
export const REGEX_DANCE_ROLE = /role|역할|리드|리더/i
export const REGEX_DANCE_WISH = /message|wish|말씀|한마디|^감사합니다$/i
export const REGEX_DANCE_PAID = /paid|payment|입금여|입금확|입금완/i
export const REGEX_DANCE_GROUP = /group|그룹|단체/i
export const REGEX_DANCE_LEADER = /lead|리더|리드/i
export const REGEX_DANCE_FOLLOW = /follow|팔뤄|팔로우|팔로워/i

/** Shared server/client role-column selection; configured columns win over heuristics. */
export function findDanceRoleColumn(titles: string[], config?: Preset['dancerList']): number {
	if (config) {
		const configured = titles.findIndex((title) => title.trim() === config.roleColumn)
		if (configured !== -1) return configured
	}
	return titles.findIndex((title) => REGEX_DANCE_ROLE.test(title))
}

/** Map configured value labels first, falling back to ordinary dance-role labels. */
export function dancerRole(
	value: string,
	config?: Preset['dancerList'],
): 'lead' | 'follow' | 'both' | 'unknown' {
	const normalized = value.trim()
	const configuredLead = config?.roles.lead.some((v) => v === normalized) ?? false
	const configuredFollow = config?.roles.follow.some((v) => v === normalized) ?? false
	if (configuredLead && configuredFollow) return 'both'
	if (configuredLead) return 'lead'
	if (configuredFollow) return 'follow'
	const lead = REGEX_DANCE_LEADER.test(normalized)
	const follow = REGEX_DANCE_FOLLOW.test(normalized)
	if (lead && follow) return 'both'
	if (lead) return 'lead'
	if (follow) return 'follow'
	return 'unknown'
}
