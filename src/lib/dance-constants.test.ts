import { describe, expect, it } from 'vitest'
import { dancerRole, findDanceRoleColumn } from './dance-constants'
import { detectSheetType } from './google-document-util/detect-sheet-type'
import { PRESETS } from './presets'

const bbq = PRESETS.bbq.dancerList

describe('preset-specific dancer list roles', () => {
	it('detects BBQ name and gender columns only with its preset', () => {
		const rows = [
			['Timestamp', '닉네임', '성별', '한마디'],
			['2026-10-17', 'A', '여자', 'hello'],
		]
		expect(detectSheetType(rows)).toBeNull()
		expect(detectSheetType(rows, bbq)).toBe('dance-event')
	})

	it('prefers the configured column while preserving role heuristics', () => {
		expect(findDanceRoleColumn(['닉네임', '역할', '성별'], bbq)).toBe(2)
		expect(findDanceRoleColumn(['닉네임', '역할'], bbq)).toBe(1)
		expect(findDanceRoleColumn(['닉네임', '성별'])).toBe(-1)
	})

	it('maps gender values only when configured', () => {
		expect(dancerRole('남자', bbq)).toBe('lead')
		expect(dancerRole(' 여자 ', bbq)).toBe('follow')
		expect(dancerRole('남자')).toBe('unknown')
		expect(dancerRole('여자')).toBe('unknown')
		expect(dancerRole('Leader', bbq)).toBe('lead')
		expect(dancerRole('Follower')).toBe('follow')
		expect(dancerRole('Leader, Follower')).toBe('both')
	})
})
