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

/**
 * Simple string hash (djb2) → 32-bit unsigned integer.
 */
function hashString(str: string): number {
	let hash = 5381
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0
	}
	return hash
}

/**
 * Mulberry32 — a fast 32-bit seeded PRNG.
 * Returns a function that produces deterministic floats in [0, 1).
 */
function mulberry32(seed: number): () => number {
	let t = seed >>> 0
	return () => {
		t = (t + 0x6d2b79f5) >>> 0
		let r = Math.imul(t ^ (t >>> 15), t | 1)
		r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
		return ((r ^ (r >>> 14)) >>> 0) / 0x100000000
	}
}

/**
 * Create a deterministic PRNG from a string seed.
 * Usage: `const rand = seededRandom('formTitle::dancerName'); rand() // 0..1`
 */
export function seededRandom(seed: string): () => number {
	return mulberry32(hashString(seed))
}

/**
 * Fisher-Yates shuffle using a seeded PRNG. Returns a new array.
 */
function seededShuffle<T>(arr: readonly T[], rand: () => number): T[] {
	const out = arr.slice()
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1))
		;[out[i], out[j]] = [out[j], out[i]]
	}
	return out
}

/**
 * Assign dancer image numbers (1–numImages) to `count` slots using a
 * shuffle-bag approach seeded by `seed`. Guarantees no adjacent repeats,
 * even across bag boundaries.
 */
export function assignDancerImages(seed: string, count: number, numImages = 6): number[] {
	if (count === 0) return []
	const rand = seededRandom(seed)
	const pool = Array.from({ length: numImages }, (_, i) => i + 1)
	const result: number[] = []

	while (result.length < count) {
		const bag = seededShuffle(pool, rand)

		// Avoid repeat at bag boundary: if first element of new bag matches
		// last assigned, rotate it to a later position.
		if (result.length > 0 && bag[0] === result[result.length - 1]) {
			// Find the first element that differs and swap it to front
			for (let i = 1; i < bag.length; i++) {
				if (bag[i] !== bag[0]) {
					;[bag[0], bag[i]] = [bag[i], bag[0]]
					break
				}
			}
		}

		for (const img of bag) {
			if (result.length >= count) break
			result.push(img)
		}
	}

	return result
}

export function excelDateToUnix(excelDate: number, timeZone = 'UTC') {
	// Calculate the Unix timestamp
	const unixTimestamp = (excelDate - EXCEL_EPOCH_DIFFERENCE) * SECONDS_IN_A_DAY * 1000

	// Apply cached timezone offset (much faster than dayjs.tz() per cell)
	const offset = getTimezoneOffset(timeZone)
	return unixTimestamp - offset
}
