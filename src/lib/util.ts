import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

export function stringify(json: unknown) {
	return JSON.stringify(json, null, 4)
}

// https://stackoverflow.com/a/16233621/117030
export function excelDateToJsDate(serial: number) {
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

// Define constants for the conversion
const SECONDS_IN_A_DAY = 86400
const EXCEL_EPOCH_DIFFERENCE = 25569 // Days from 1900-01-01 to 1970-01-01

export function excelDateToUnix(excelDate: number, timeZone = 'UTC') {
	// Calculate the Unix timestamp
	const unixTimestamp = (excelDate - EXCEL_EPOCH_DIFFERENCE) * SECONDS_IN_A_DAY * 1000

	// Adjust for the specified time zone using dayjs
	const unixTimeWithOffset = dayjs.utc(unixTimestamp).tz(timeZone, true).valueOf()

	return unixTimeWithOffset
}
