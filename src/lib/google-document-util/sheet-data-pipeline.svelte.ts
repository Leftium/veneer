import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import isBetween from 'dayjs/plugin/isBetween'
import utc from 'dayjs/plugin/utc'
import type { ResultGoogleSheet } from '$lib/google-document-util/types'
import { isErr } from 'wellcrafted/result'

dayjs.extend(relativeTime)
dayjs.extend(isBetween)
dayjs.extend(utc)

function indexToExcelColumn(index: number): string {
	if (index < 0) throw new Error('Index must be non-negative')

	let column = ''
	let n = index + 1 // Excel columns are 1-based

	while (n > 0) {
		const remainder = (n - 1) % 26
		column = String.fromCharCode(65 + remainder) + column
		n = Math.floor((n - 1) / 26)
	}

	return column
}

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
	console.time('⏱️ sheet-pipeline:makeRaw')
	if (isErr(sheet)) {
		console.timeEnd('⏱️ sheet-pipeline:makeRaw')
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

	console.timeEnd('⏱️ sheet-pipeline:makeRaw')
	return { extra: { timeZone } as unknown, columns, rows }
}

type SheetDataPipe = ReturnType<typeof makeRaw>

export function addIndex({ extra, columns, rows }: SheetDataPipe) {
	columns = [makeColumn({ title: '#' }), ...columns]
	rows = rows.map((row, ri) => [makeCell({ value: `${ri + 1}` }), ...row])
	return { extra, columns, rows }
}

export function appendColumnLabel({ extra, columns, rows }: SheetDataPipe) {
	columns = columns.map((column, ci) => ({
		...column,
		title: `${column.title ? column.title + ':' : ''}${indexToExcelColumn(ci)}`,
	}))
	return { extra, columns, rows }
}

export function stripEmptyRows({ extra, columns, rows }: SheetDataPipe) {
	rows = rows.filter((row) => row.map((cell) => cell.value).join().length)
	return { extra, columns, rows }
}

export function adjustColumnLengths({ extra, columns, rows }: SheetDataPipe) {
	console.time('⏱️ sheet-pipeline:adjustColumnLengths')
	for (const row of rows) {
		for (const [ci, cell] of row.entries()) {
			columns[ci].lengthMax = Math.max(columns[ci].lengthMax, cell.value.length)
			columns[ci].lengthMin = Math.min(columns[ci].lengthMin, cell.value.length)
		}
	}
	console.timeEnd('⏱️ sheet-pipeline:adjustColumnLengths')
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
	console.time('⏱️ sheet-pipeline:adjustColumnTypes')
	for (const row of rows) {
		for (const [ci, cell] of row.entries()) {
			if (!REGEX_NUMERIC.test(cell.value)) {
				columns[ci].isNumeric = false
			}
		}
	}
	console.timeEnd('⏱️ sheet-pipeline:adjustColumnTypes')
	return { extra, columns, rows }
}

export function padNumericRenders({ extra, columns, rows }: SheetDataPipe) {
	console.time('⏱️ sheet-pipeline:padNumericRenders')
	for (const row of rows) {
		for (const [ci, cell] of row.entries()) {
			if (cell.value && columns[ci].isNumeric && !cell.ts) {
				cell.render = cell.value.padStart(columns[ci].lengthMax, '0')
			}
		}
	}
	console.timeEnd('⏱️ sheet-pipeline:padNumericRenders')
	return { extra, columns, rows }
}

export function ghostLeadingZeros({ extra, columns, rows }: SheetDataPipe) {
	console.time('⏱️ sheet-pipeline:ghostLeadingZeros')
	for (const row of rows) {
		for (const [ci, cell] of row.entries()) {
			if (columns[ci].isNumeric && !cell.ts) {
				cell.render = cell.render.replace(/^0*/, '<gz>$&</gz>')
			}
		}
	}
	console.timeEnd('⏱️ sheet-pipeline:ghostLeadingZeros')
	return { extra, columns, rows }
}

export function hidePhoneNumbers({ extra, columns, rows }: SheetDataPipe) {
	console.time('⏱️ sheet-pipeline:hidePhoneNumbers')
	for (const row of rows) {
		for (const [ci, cell] of row.entries()) {
			if (/(contact)|(연락)/i.test(columns[ci].title)) {
				cell.value = cell.value.replaceAll(/[0-9]/g, '*')
				cell.render = cell.render.replaceAll(/[0-9]/g, '*')
			}
		}
	}
	console.timeEnd('⏱️ sheet-pipeline:hidePhoneNumbers')
	return { extra, columns, rows }
}

export function stripEmptyColumns({ extra, columns, rows }: SheetDataPipe) {
	rows = rows.map((row) => row.filter((cell, ci) => columns[ci].lengthMax || columns[ci].title))
	columns = columns.filter((col) => col.lengthMax || col.title)
	return { extra, columns, rows }
}

export function renderRelativeTimes({ extra, columns, rows }: SheetDataPipe) {
	console.time('⏱️ sheet-pipeline:renderRelativeTimes')
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
	console.timeEnd('⏱️ sheet-pipeline:renderRelativeTimes')
	return { extra, columns, rows }
}

import {
	REGEX_DANCE_ROLE,
	REGEX_DANCE_NAME,
	REGEX_DANCE_WISH,
	REGEX_DANCE_PAID,
	REGEX_DANCE_LEADER,
	REGEX_DANCE_FOLLOW,
} from '$lib/dance-constants'

export function collectExtraDance({ extra, columns, rows }: SheetDataPipe) {
	console.time('⏱️ sheet-pipeline:collectExtraDance')
	const ci = {
		role: columns.findIndex((c) => REGEX_DANCE_ROLE.test(c.title)),
		name: columns.findIndex((c) => REGEX_DANCE_NAME.test(c.title)),
		paid: columns.findIndex((c) => REGEX_DANCE_PAID.test(c.title)),
		wish: columns.findIndex((c) => REGEX_DANCE_WISH.test(c.title)),
	}

	if (ci.name === -1 || ci.role === -1) {
		console.timeEnd('⏱️ sheet-pipeline:collectExtraDance')
		return { extra, columns, rows }
	}

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

	rows = rows.reverse()

	console.timeEnd('⏱️ sheet-pipeline:collectExtraDance')
	return { extra, columns, rows }
}
