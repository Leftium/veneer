// https://stackoverflow.com/a/16233621/117030
function excelDateToJsDate(serial: number) {
	const utc_days = Math.floor(serial - 25569)
	const utc_value = utc_days * 86400
	const date_info = new Date(utc_value * 1000)

	const fractional_day = serial - Math.floor(serial) + 0.0000001

	let total_seconds = Math.floor(86400 * fractional_day)

	const seconds = total_seconds % 60

	total_seconds -= seconds

	const hours = Math.floor(total_seconds / (60 * 60))
	const minutes = Math.floor(total_seconds / 60) % 60

	return new Date(
		date_info.getFullYear(),
		date_info.getMonth(),
		date_info.getDate(),
		hours,
		minutes,
		seconds,
	)
}

type GoogleSheetsApiResult = {
	properties: { title: string }
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
	sheetTitle: string
	rows: (string | (string | Date)[])[][]
	hiddenColumns: number[]
	hiddenRows: number[]
}

export function adjustGoogleSheetData(json: GoogleSheetsApiResult) {
	const data = json?.sheets?.[0]?.data[0]
	if (!data) {
		return json
	}

	const title = json.properties.title
	const sheetTitle = json.sheets[0].properties.title

	const hiddenColumns = data.columnMetadata.flatMap((cm, i) => (cm.hiddenByUser ? i : []))
	const hiddenRows = data.rowMetadata.flatMap((rm, i) => (rm.hiddenByUser ? i : []))

	const rows = data.rowData.map((rowDatum) => {
		return rowDatum.values.map((value) => {
			const excelSerialDate = value?.userEnteredFormat?.numberFormat?.type.includes('DATE')
				? value?.effectiveValue?.numberValue
				: null
			return excelSerialDate
				? [value.formattedValue, excelDateToJsDate(excelSerialDate)]
				: value.formattedValue
		})
	})

	return { title, sheetTitle, rows, hiddenColumns, hiddenRows }
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
