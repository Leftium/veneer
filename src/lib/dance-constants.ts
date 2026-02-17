// Shared dance-event regexes — used by both the sheet data pipeline and group registration widget.
// See specs/group-registration.md § Detection Regexes for context.

// Column/field title matchers
export const REGEX_DANCE_NAME = /name|닉네임/i
export const REGEX_DANCE_ROLE = /role|역할|리드|리더/i
export const REGEX_DANCE_WISH = /말씀|한마디/i
export const REGEX_DANCE_PAID = /입금여|입금확/i
export const REGEX_DANCE_GROUP = /group|그룹/i

// Option value matchers (for role detection in cells or form option labels)
export const REGEX_DANCE_LEADER = /lead|리더|리드/i
export const REGEX_DANCE_FOLLOW = /follow|팔뤄|팔로우|팔로워/i
