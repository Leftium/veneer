import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import isBetween from 'dayjs/plugin/isBetween'
import utc from 'dayjs/plugin/utc'
import type { ResultGoogleSheet } from '$lib/google-document-util/types'
import { isErr } from 'wellcrafted/result'
import { gg } from '@leftium/gg'

dayjs.extend(relativeTime)
dayjs.extend(isBetween)
dayjs.extend(utc)

const DEFAULT_COLUMN = {
	title: '',
	isNumeric: true,
	lengthMin: Number.MAX_SAFE_INTEGER,
	lengthMax: 0,
}

function makeColumn(columns: Partial<SheetDataPipe['columns'][number]>) {
	return { ...DEFAULT_COLUMN, ...columns }
}

function makeCell(cell: Partial<SheetDataPipe['rows'][number][number]>) {
	return {
		value: cell.value || '',
		ts: cell.ts || null,
		render: cell.render || cell.value || '',
	}
}

export function makeRaw(sheet: ResultGoogleSheet) {
	gg.time('⏱️ sheet-pipeline:makeRaw')
	if (isErr(sheet)) {
		gg.timeEnd('⏱️ sheet-pipeline:makeRaw')
		return { extra: { timeZone: 'utc' }, columns: [], rows: [] }
	}

	const rows = sheet.data.rows.map((row) =>
		row.map((cell) => {
			const value = (Array.isArray(cell) ? cell[0] : cell) as string
			const ts = Array.isArray(cell) && typeof cell[1] === 'number' ? (cell[1] as number) : null
			return { value, ts, render: value }
		}),
	)

	const maxColumns = Math.max(...rows.map((row) => row.length))

	const columns = Array.from({ length: maxColumns }, () => DEFAULT_COLUMN)

	const timeZone = sheet.data.timeZone

	gg.timeEnd('⏱️ sheet-pipeline:makeRaw')
	return { extra: { timeZone } as unknown, columns, rows }
}

type SheetDataPipe = ReturnType<typeof makeRaw>

export function addIndex({ extra, columns, rows }: SheetDataPipe) {
	columns = [makeColumn({ title: '#' }), ...columns]
	rows = rows.map((row, ri) => [makeCell({ value: `${ri + 1}` }), ...row])
	return { extra, columns, rows }
}

export function stripEmptyRows({ extra, columns, rows }: SheetDataPipe) {
	rows = rows.filter((row) => row.map((cell) => cell.value).join().length)
	return { extra, columns, rows }
}

export function adjustColumnLengths({ extra, columns, rows }: SheetDataPipe) {
	gg.time('⏱️ sheet-pipeline:adjustColumnLengths')
	for (const row of rows) {
		for (const [ci, cell] of row.entries()) {
			columns[ci].lengthMax = Math.max(columns[ci].lengthMax, cell.value.length)
			columns[ci].lengthMin = Math.min(columns[ci].lengthMin, cell.value.length)
		}
	}
	gg.timeEnd('⏱️ sheet-pipeline:adjustColumnLengths')
	return { extra, columns, rows }
}

export function extractColumnHeaders({ extra, columns, rows }: SheetDataPipe) {
	if (rows.length) {
		let titleRowIndex = 0
		for (const [ri, row] of rows.entries()) {
			if (row.length > rows[titleRowIndex].length) {
				titleRowIndex = ri
			}
		}

		columns = rows[titleRowIndex].map((cell, ci) =>
			makeColumn({ title: cell.value || rows[0][ci].value }),
		)

		// Remove (partial) copies of header rows
		const columnTitles = columns.map((column) => column.title)
		rows = rows.filter((row) => row.filter((cell) => columnTitles.includes(cell.value)).length < 3)
	}

	return { extra, columns, rows }
}

const REGEX_NUMERIC = /^[0-9-.,/: ]*$/
export function adjustColumnTypes({ extra, columns, rows }: SheetDataPipe) {
	gg.time('⏱️ sheet-pipeline:adjustColumnTypes')
	for (const row of rows) {
		for (const [ci, cell] of row.entries()) {
			if (!REGEX_NUMERIC.test(cell.value)) {
				columns[ci].isNumeric = false
			}
		}
	}
	gg.timeEnd('⏱️ sheet-pipeline:adjustColumnTypes')
	return { extra, columns, rows }
}

export function padNumericRenders({ extra, columns, rows }: SheetDataPipe) {
	gg.time('⏱️ sheet-pipeline:padNumericRenders')
	for (const row of rows) {
		for (const [ci, cell] of row.entries()) {
			if (cell.value && columns[ci].isNumeric && !cell.ts) {
				cell.render = cell.value.padStart(columns[ci].lengthMax, '0')
			}
		}
	}
	gg.timeEnd('⏱️ sheet-pipeline:padNumericRenders')
	return { extra, columns, rows }
}

export function hidePhoneNumbers({ extra, columns, rows }: SheetDataPipe) {
	gg.time('⏱️ sheet-pipeline:hidePhoneNumbers')
	for (const row of rows) {
		for (const [ci, cell] of row.entries()) {
			if (/(contact)|(연락)/i.test(columns[ci].title)) {
				cell.value = cell.value.replaceAll(/[0-9]/g, '*')
				cell.render = cell.render.replaceAll(/[0-9]/g, '*')
			}
		}
	}
	gg.timeEnd('⏱️ sheet-pipeline:hidePhoneNumbers')
	return { extra, columns, rows }
}

export function stripEmptyColumns({ extra, columns, rows }: SheetDataPipe) {
	rows = rows.map((row) => row.filter((cell, ci) => columns[ci].lengthMax || columns[ci].title))
	columns = columns.filter((col) => col.lengthMax || col.title)
	return { extra, columns, rows }
}

export function renderRelativeTimes({ extra, columns, rows }: SheetDataPipe) {
	gg.time('⏱️ sheet-pipeline:renderRelativeTimes')
	const utcjs = dayjs.utc

	for (const row of rows) {
		for (const cell of row) {
			if (cell.ts) {
				// Relative date if within 25 days:
				if (utcjs(cell.ts).isBetween(utcjs().subtract(25, 'd'), utcjs().add(25, 'd'))) {
					cell.render = dayjs().utc().to(cell.ts)
				} else {
					// @ts-expect-error: TODO
					cell.render = dayjs.tz(cell.ts, extra.timeZone).format('YYYY-MM-DD')
				}
			}
		}
	}
	gg.timeEnd('⏱️ sheet-pipeline:renderRelativeTimes')
	return { extra, columns, rows }
}

import {
	REGEX_DANCE_ROLE,
	REGEX_DANCE_NAME,
	REGEX_DANCE_WISH,
	REGEX_DANCE_PAID,
	REGEX_DANCE_GROUP,
	REGEX_DANCE_LEADER,
	REGEX_DANCE_FOLLOW,
} from '$lib/dance-constants'

import { parse as parseGroupMembers } from '$lib/group-registration/serialization'

export function collectExtraDance({ extra, columns, rows }: SheetDataPipe) {
	gg.time('⏱️ sheet-pipeline:collectExtraDance')
	const ci = {
		role: columns.findIndex((c) => REGEX_DANCE_ROLE.test(c.title)),
		name: columns.findIndex((c) => REGEX_DANCE_NAME.test(c.title)),
		paid: columns.findIndex((c) => REGEX_DANCE_PAID.test(c.title)),
		wish: columns.findIndex((c) => REGEX_DANCE_WISH.test(c.title)),
		group: columns.findIndex((c) => REGEX_DANCE_GROUP.test(c.title)),
	}

	if (ci.name === -1 || ci.role === -1) {
		gg.timeEnd('⏱️ sheet-pipeline:collectExtraDance')
		return { extra, columns, rows }
	}

	// Reverse rows so newest registrations appear first
	rows = rows.reverse()

	// Expand group members into additional rows
	rows = expandGroupMembers(rows, ci)

	const count = {
		total: rows.length,
		follows: rows.filter((row) => REGEX_DANCE_FOLLOW.test(row[ci.role]?.value)).length,
		leaders: rows.filter((row) => REGEX_DANCE_LEADER.test(row[ci.role]?.value)).length,
	}

	extra = {
		type: 'dance-event',
		count,
		ci,
	}

	gg.timeEnd('⏱️ sheet-pipeline:collectExtraDance')
	return { extra, columns, rows }
}

/**
 * Role value mapping for injecting parsed roles into synthetic row cells.
 */
const ROLE_DISPLAY: Record<string, string> = {
	leader: 'Leader',
	follower: 'Follower',
	both: 'Leader, Follower',
}

/**
 * Expand rows that contain group registration data into additional rows
 * for each group member. Each expanded row is a shallow copy of the parent
 * row with overwritten name and role cells, plus metadata for UI grouping.
 *
 * Rows are tagged with `_groupIndex` (0-based group counter, -1 for solo)
 * and `_isGroupMember` (true for expanded child rows).
 */
function expandGroupMembers(
	rows: SheetDataPipe['rows'],
	ci: { name: number; role: number; group: number },
): SheetDataPipe['rows'] {
	if (ci.group === -1) return rows

	const expanded: SheetDataPipe['rows'] = []
	let entryCounter = 0

	for (const row of rows) {
		const groupText = row[ci.group]?.value || ''
		const members = groupText ? parseGroupMembers(groupText) : []

		if (members.length === 0) {
			// Solo registration — no group data
			const taggedRow = [...row] as any
			taggedRow._groupIndex = entryCounter++
			taggedRow._isGroupMember = false
			expanded.push(taggedRow)
			continue
		}

		// This row is a group primary
		const gIdx = entryCounter++
		const primaryName = row[ci.name]?.value || ''

		// Tag the primary row
		const taggedPrimary = [...row] as any
		taggedPrimary._groupIndex = gIdx
		taggedPrimary._isGroupMember = false
		expanded.push(taggedPrimary)

		// Re-index: primary keeps its original index number,
		// children will get new index numbers assigned later.
		let childNum = 0
		for (const member of members) {
			childNum++
			const childRow = row.map((cell) => ({ ...cell })) as any

			// Derive name for unnamed members from primary
			const displayName = member.name || `${primaryName} +${childNum}`

			// Overwrite name cell
			childRow[ci.name] = {
				value: displayName,
				ts: null,
				render: displayName,
			}

			// Always overwrite role cell: explicit role → display text, null → empty (→ 'unknown')
			const roleDisplay = member.role ? ROLE_DISPLAY[member.role] || '' : ''
			childRow[ci.role] = {
				value: roleDisplay,
				ts: null,
				render: roleDisplay,
			}

			// Clear the group cell on children (they don't have their own group data)
			childRow[ci.group] = { value: '', ts: null, render: '' }

			// Tag as group member
			childRow._groupIndex = gIdx
			childRow._isGroupMember = true

			expanded.push(childRow)
		}
	}

	// Re-assign index numbers (column 0 = '#'), zero-padded for alignment
	const maxLen = String(expanded.length).length
	for (let i = 0; i < expanded.length; i++) {
		const indexStr = `${i + 1}`
		expanded[i][0] = { value: indexStr, ts: null, render: indexStr.padStart(maxLen, '0') }
	}

	return expanded
}
