import { describe, expect, it } from 'vitest'
import { Ok } from 'wellcrafted/result'
import { PRESETS } from '#lib/presets.js'
import { getDancersFromSheetData } from '#lib/util.js'
import {
	addIndex,
	collectExtraDance,
	extractColumnHeaders,
	makeRaw,
	mergeDuplicateRows,
} from './sheet-data-pipeline.svelte.js'

function processRows(rows: string[][], config = PRESETS.bbq.dancerList) {
	const raw = makeRaw(
		Ok({
			type: 'sheet',
			documentId: 'test',
			veneerId: null,
			title: 'Test',
			sheetTitle: 'Responses',
			timeZone: 'UTC',
			rows,
			hiddenColumns: [],
			hiddenRows: [],
		}),
	)
	return collectExtraDance(config)(
		addIndex(mergeDuplicateRows(PRESETS.bbq.mergeKeys)(extractColumnHeaders(raw))),
	)
}

function dancersFrom(result: ReturnType<typeof processRows>) {
	return getDancersFromSheetData(
		result.rows,
		result.extra as Parameters<typeof getDancersFromSheetData>[1],
	).dancers
}

describe('preset dancer list pipeline', () => {
	it('keeps BBQ counts and rendered roles consistent after merging registrations', () => {
		const result = processRows([
			['Timestamp', '닉네임', '성별', '한마디'],
			['2026-10-17', 'A', '남자', 'old'],
			['2026-10-17', 'B', '남자', 'hello'],
			['2026-10-17', 'A', '여자', 'updated'],
			['2026-10-17', 'C', '', 'unknown'],
		])
		expect(result.extra).toMatchObject({
			type: 'dance-event',
			count: { total: 3, leaders: 1, follows: 1 },
		})
		expect(dancersFrom(result).map(({ name, role, wish }) => ({ name, role, wish }))).toEqual([
			{ name: 'C', role: 'unknown', wish: 'unknown' },
			{ name: 'B', role: 'lead', wish: 'hello' },
			{ name: 'A', role: 'follow', wish: 'updated' },
		])
	})

	it('falls back to ordinary role columns and handles expanded group members', () => {
		const result = processRows([
			['Timestamp', '닉네임', '역할', '그룹'],
			['2026-10-17', 'A', 'Leader', 'F:Guest\nLF:Both'],
		])
		expect(result.extra).toMatchObject({
			count: { total: 3, leaders: 2, follows: 2 },
		})
		expect(dancersFrom(result).map(({ name, role }) => ({ name, role }))).toEqual([
			{ name: 'A', role: 'lead' },
			{ name: 'Guest', role: 'follow' },
			{ name: 'Both', role: 'both' },
		])
	})

	it('classifies source values consistently even when cell rendering changes', () => {
		const result = processRows([
			['Timestamp', '닉네임', '성별'],
			['2026-10-17', 'A', '남자'],
		])
		result.rows[0][3].render = 'display label'
		expect(result.extra).toMatchObject({ count: { leaders: 1, follows: 0 } })
		expect(dancersFrom(result)[0].role).toBe('lead')
	})
})
