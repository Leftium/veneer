import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { REGEX_DANCE_LEADER, REGEX_DANCE_FOLLOW } from '$lib/dance-constants'

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
export function hashString(str: string): number {
	let hash = 5381
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0
	}
	return hash
}

/** Pool sizes per role (lead/follow use 1-indexed image numbers; both uses 0-indexed into bothPool). */
const POOL_SIZE: Record<string, number> = { lead: 6, follow: 6, both: 18 }

export interface DancerRow {
	name: string
	role: 'lead' | 'follow' | 'both' | 'unknown'
	/** Row index in the sheet (0-based). Unique per page load; used for keying. */
	index: number
	/** Signup timestamp (unix ms) for stable ordering. Older entries get icons first. */
	ts?: number | null
	/** Wish/message text from the signup form. */
	wish?: string
	/** Whether this dancer has confirmed payment. */
	paid?: boolean
}

/**
 * Assign dancer image numbers using a two-layer approach:
 *
 * Layer 1 — Stable identity: hash(formTitle, name) → base icon per person.
 *   Same person on the same form always gets the same base icon, regardless
 *   of row order, merges, or garbage collection.
 *
 * Layer 2 — Render-time variety: walk rows oldest-first, per-role "used" set.
 *   If the base icon collides with a recently-used icon for that role, offset
 *   to the next available. When the pool is exhausted, reset the used set but
 *   carry the last 2 icons forward to prevent repeats at the boundary.
 *
 * For lead/follow: returns 1-indexed image numbers (1–6).
 * For both: returns 0-indexed pool indices (0–17), mapped through bothPool by DancerIcon.
 * For unknown: returns 0 (no image).
 */
export function assignDancerImages(formTitle: string, dancers: DancerRow[]): number[] {
	if (dancers.length === 0) return []

	// Sort indices by timestamp (oldest first) so earlier signups get icons
	// first and stay stable when new rows are added. Rows without timestamps
	// fall back to their display order (index) to maintain determinism.
	const sortedIndices = dancers
		.map((_, i) => i)
		.sort((a, b) => (dancers[a].ts ?? Infinity) - (dancers[b].ts ?? Infinity))

	// Per-role tracking: which icons have been used in the current "bag"
	const used: Record<string, Set<number>> = {
		lead: new Set(),
		follow: new Set(),
		both: new Set(),
	}

	// Per-role: last 2 assigned icons (for boundary overlap when resetting)
	const recentByRole: Record<string, number[]> = {
		lead: [],
		follow: [],
		both: [],
	}

	// Assign in timestamp order, then scatter results back to display order
	const result = new Array<number>(dancers.length)

	for (const idx of sortedIndices) {
		const { name, role } = dancers[idx]

		if (role === 'unknown') {
			result[idx] = 0
			continue
		}

		const poolSize = POOL_SIZE[role]
		const usedSet = used[role]
		const recent = recentByRole[role]

		// Layer 1: stable base icon from hash
		const baseIndex = hashString(formTitle + '\0' + name) % poolSize

		// Layer 2: if base collides with used set, find next available
		let chosen = baseIndex
		if (usedSet.has(chosen)) {
			// Walk forward from baseIndex to find first unused slot
			for (let offset = 1; offset < poolSize; offset++) {
				const candidate = (baseIndex + offset) % poolSize
				if (!usedSet.has(candidate)) {
					chosen = candidate
					break
				}
			}
			// If all are used (shouldn't happen since we reset below), just use base
		}

		usedSet.add(chosen)
		recent.push(chosen)

		// Convert to expected output format
		// lead/follow: 1-indexed (1–6); both: 0-indexed (0–17)
		result[idx] = role === 'both' ? chosen : chosen + 1

		// Reset bag when pool is exhausted, carrying last 2 forward
		if (usedSet.size >= poolSize) {
			usedSet.clear()
			// Carry last 2 into new bag to prevent repeats at boundary
			const tail = recent.slice(-2)
			for (const t of tail) {
				usedSet.add(t)
			}
		}
	}

	return result
}

/**
 * Detect a dancer's role from the role column text.
 */
function detectRole(roleText: string): DancerRow['role'] {
	const isLead = REGEX_DANCE_LEADER.test(roleText)
	const isFollow = REGEX_DANCE_FOLLOW.test(roleText)
	if (isLead && isFollow) return 'both'
	if (isLead) return 'lead'
	if (isFollow) return 'follow'
	return 'unknown'
}

/**
 * Derive DancerRow[] and firstSignupTs from processed sheet data.
 * Shared by Sheet.svelte (list tab) and the layout footer dance party.
 */
export function getDancersFromSheetData(
	rows: any[],
	extra: { ci: { name: number; role: number; wish: number; paid: number }; [key: string]: any },
): { dancers: DancerRow[]; firstSignupTs: number | null } {
	const ci = extra?.ci
	if (!ci) return { dancers: [], firstSignupTs: null }

	const dancers: DancerRow[] = rows.map((row: any, i: number) => ({
		name: row[ci.name]?.render ?? '',
		role: detectRole(row[ci.role]?.render ?? ''),
		index: i,
		ts: row.find((cell: any) => cell?.ts != null)?.ts ?? null,
		wish: row[ci.wish]?.render || undefined,
		paid: !!row[ci.paid]?.render,
	}))

	let earliest = Infinity
	for (const d of dancers) {
		if (d.ts != null && d.ts < earliest) earliest = d.ts
	}
	const firstSignupTs = earliest === Infinity ? null : earliest

	return { dancers, firstSignupTs }
}

export function excelDateToUnix(excelDate: number, timeZone = 'UTC') {
	// Calculate the Unix timestamp
	const unixTimestamp = (excelDate - EXCEL_EPOCH_DIFFERENCE) * SECONDS_IN_A_DAY * 1000

	// Apply cached timezone offset (much faster than dayjs.tz() per cell)
	const offset = getTimezoneOffset(timeZone)
	return unixTimestamp - offset
}
