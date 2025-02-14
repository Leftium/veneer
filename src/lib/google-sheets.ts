import { excelDateToUnix } from './util'

type GoogleSheetsApiResult = {
	properties: { title: string; timeZone: string }
	sheets: {
		properties: { title: string }
		data: {
			rowData: {
				values: {
					formattedValue: string
					effectiveValue: {
						numberValue?: number
					}
					userEnteredFormat?: {
						numberFormat: {
							type: string
						}
					}
				}[]
			}[]
			rowMetadata: { hiddenByUser?: boolean }[]
			columnMetadata: { hiddenByUser?: boolean }[]
		}[]
	}[]
}

export type GoogleSheetData = {
	title: string
	timeZone: string
	sheetTitle: string
	rows: (string | (string | number)[])[][]
	hiddenColumns: number[]
	hiddenRows: number[]
}

export function adjustGoogleSheetData(json: GoogleSheetsApiResult) {
	const data = json?.sheets?.[0]?.data[0]
	if (!data) {
		return json
	}

	const title = json.properties.title
	const timeZone = json.properties.timeZone
	const sheetTitle = json.sheets[0].properties.title

	const hiddenColumns = data.columnMetadata.flatMap((cm, i) => (cm.hiddenByUser ? i : []))
	const hiddenRows = data.rowMetadata.flatMap((rm, i) => (rm.hiddenByUser ? i : []))

	const rows = data.rowData.map((rowDatum) => {
		return rowDatum.values.map((value) => {
			const excelSerialDate = value?.userEnteredFormat?.numberFormat?.type.includes('DATE')
				? value?.effectiveValue?.numberValue
				: null
			return excelSerialDate
				? [value.formattedValue, excelDateToUnix(excelSerialDate, timeZone)] // Pass integer Unix epoch to avoid timezone shenanigans.
				: value.formattedValue || ''
		})
	})

	return { title, timeZone, sheetTitle, rows, hiddenColumns, hiddenRows }
}

export function stripHidden(json: GoogleSheetData, unhideCols = false, unhideRows = false) {
	const { hiddenColumns, hiddenRows } = json

	const rows = json.rows
		.filter((_, rowIndex) => unhideRows || !hiddenRows.includes(rowIndex))
		.map((row) => row.filter((_, cellIndex) => unhideCols || !hiddenColumns.includes(cellIndex)))

	return {
		...json,
		rows,
		hiddenColumns: unhideCols ? hiddenColumns : [],
		hiddenRows: unhideRows ? hiddenRows : [],
	}
}
