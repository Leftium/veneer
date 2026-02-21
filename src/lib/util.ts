import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

export function stringify(json: unknown) {
	return JSON.stringify(json, null, 4)
}

// Define constants for the conversion
const SECONDS_IN_A_DAY = 86400
const EXCEL_EPOCH_DIFFERENCE = 25569 // Days from 1900-01-01 to 1970-01-01

// Cache timezone offsets to avoid repeated dayjs.tz() calls
const timezoneOffsetCache = new Map<string, number>()

function getTimezoneOffset(timeZone: string): number {
	if (!timezoneOffsetCache.has(timeZone)) {
		// Get offset once per timezone (in milliseconds)
		const offset = dayjs().tz(timeZone).utcOffset() * 60 * 1000
		timezoneOffsetCache.set(timeZone, offset)
	}
	return timezoneOffsetCache.get(timeZone)!
}

export function excelDateToUnix(excelDate: number, timeZone = 'UTC') {
	// Calculate the Unix timestamp
	const unixTimestamp = (excelDate - EXCEL_EPOCH_DIFFERENCE) * SECONDS_IN_A_DAY * 1000

	// Apply cached timezone offset (much faster than dayjs.tz() per cell)
	const offset = getTimezoneOffset(timeZone)
	return unixTimestamp - offset
}
