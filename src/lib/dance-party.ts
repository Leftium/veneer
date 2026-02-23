/**
 * Dance Party — Core Engine (Phase 1)
 *
 * Pure TypeScript functions with no DOM dependencies.
 * Handles priority scoring, pairing, placement, song computation, and image metadata.
 */

import { hashString, type DancerRow } from './util'

// ---------------------------------------------------------------------------
// Constants & Configuration
// ---------------------------------------------------------------------------

/** Maximum value of hashString (32-bit unsigned). */
const MAX_HASH = 0xffff_ffff

export interface PriorityWeights {
	hasMessage: number
	hasPaid: number
	earlySignup: number
	jitterWeight: number
}

export interface LayoutConfig {
	centerBiasMax: number
	verticalJitter: number
	soloAffinity: number
	messageBalanceRate: number
}

export interface DockConfig {
	maxScale: number
	neighborCount: number
	falloffFn: 'cosine' | 'gaussian'
	baseIconHeight: number
	magnifiedSpacing: number
}

export interface DancePartyConfig {
	weights: PriorityWeights
	layout: LayoutConfig
	dock: DockConfig
}

/** Default priority weights. All are overridable via the dev tuning UI. */
export const DEFAULT_WEIGHTS: PriorityWeights = {
	hasMessage: 3,
	hasPaid: 2,
	earlySignup: 1,
	jitterWeight: 2.0,
}

/** Default layout/placement parameters. */
export const DEFAULT_LAYOUT: LayoutConfig = {
	centerBiasMax: 0.8,
	verticalJitter: 4, // ±px
	soloAffinity: 0.3, // 0 = scatter, 1 = collapse
	messageBalanceRate: 0.5, // probability of swap attempt per messageless pair
}

/** Dock magnification defaults (used in Phase 3, defined here for type completeness). */
export const DEFAULT_DOCK: DockConfig = {
	maxScale: 2.75,
	neighborCount: 3,
	falloffFn: 'cosine',
	baseIconHeight: 32,
	magnifiedSpacing: 4,
}

export const DEFAULT_CONFIG: DancePartyConfig = {
	weights: { ...DEFAULT_WEIGHTS },
	layout: { ...DEFAULT_LAYOUT },
	dock: { ...DEFAULT_DOCK },
}

// ---------------------------------------------------------------------------
// Image Metadata
// ---------------------------------------------------------------------------

/**
 * Both-image pool: connected dance hold poses (07–32).
 * Breakaway poses (01–06) are available but reserved for the full pool.
 */
export const PAIRED_POOL = [
	7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
	32,
] as const

/** All 32 both-images (breakaway + connected). */
export const ALL_BOTH_POOL = [
	1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27,
	28, 29, 30, 31, 32,
] as const

/**
 * true = leader (pants figure) is on the LEFT side of the unflipped image.
 */
export const LEADER_ON_LEFT: Record<number, boolean> = {
	// Breakaway poses (01–06)
	1: true,
	2: false,
	3: false,
	4: false,
	5: true,
	6: true,
	// Connected dance hold (07–32)
	7: true,
	8: false,
	9: false,
	10: false,
	11: true,
	12: true,
	13: false,
	14: true,
	15: false,
	16: true,
	17: true,
	18: true,
	19: true,
	20: true,
	21: false,
	22: true,
	23: true,
	24: true,
	25: true,
	26: true,
	27: true,
	28: true,
	29: true,
	30: true,
	31: true,
	32: true,
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DanceUnit {
	type: 'pair' | 'solo'
	/** For pairs: [leader, follower]. For solos: [member]. */
	members: DancerRow[]
	/** Deterministic key for hashing (sorted names for pairs, single name for solos). */
	unitKey: string
	/** Priority score for placement (max of members for pairs). */
	priorityScore: number
	/** Assigned both-image number (for pairs) or lead/follow image number (for solos). */
	imageNum: number
}

export interface PlacedUnit extends DanceUnit {
	/** Horizontal position on the dance floor, normalized [0, 1]. */
	x: number
	/** Vertical jitter offset in pixels (±verticalJitter). */
	yOffset: number
	/** Whether the image should be horizontally flipped. */
	flipped: boolean
}

// ---------------------------------------------------------------------------
// Song Computation
// ---------------------------------------------------------------------------

/**
 * Get the current song number. Song 1 = the hour of the first signup.
 * Returns 1 if no valid timestamp is provided.
 */
export function getSongNumber(
	firstSignupTs: number | null | undefined,
	now: Date = new Date(),
): number {
	if (firstSignupTs == null || firstSignupTs <= 0) return 1
	const firstHour = Math.floor(firstSignupTs / (3600 * 1000))
	const currentHour = Math.floor(now.getTime() / (3600 * 1000))
	return Math.max(1, currentHour - firstHour + 1)
}

/**
 * Build a song-specific seed string for deterministic hashing.
 */
export function getSongSlot(formTitle: string, songNumber: number): string {
	return `${formTitle}\0song${songNumber}`
}

// ---------------------------------------------------------------------------
// Priority Scoring
// ---------------------------------------------------------------------------

/**
 * Compute a priority score for a single dancer.
 *
 * earlySignup is normalized: first signup = 1.0, last = 0.0.
 * If there's only one dancer, earlySignup = 1.0.
 */
export function computePriority(
	dancer: DancerRow,
	timestamps: { earliest: number; latest: number },
	weights: PriorityWeights = DEFAULT_WEIGHTS,
): number {
	let score = 0
	if (dancer.wish) score += weights.hasMessage
	if (dancer.paid) score += weights.hasPaid

	// Early-signup bonus: linear interpolation
	const ts = dancer.ts ?? null
	if (ts != null && timestamps.earliest !== timestamps.latest) {
		const normalized = 1 - (ts - timestamps.earliest) / (timestamps.latest - timestamps.earliest)
		score += normalized * weights.earlySignup
	} else {
		// Single dancer or no timestamp: full bonus
		score += weights.earlySignup
	}

	return score
}

/**
 * Compute the maximum possible priority score (for center-bias normalization).
 */
export function maxPossibleScore(weights: PriorityWeights = DEFAULT_WEIGHTS): number {
	return weights.hasMessage + weights.hasPaid + weights.earlySignup
}

/**
 * Get earliest and latest timestamps from a list of dancers.
 * Returns { earliest, latest } in unix ms. Dancers without timestamps are skipped.
 */
export function getTimestampRange(dancers: DancerRow[]): { earliest: number; latest: number } {
	let earliest = Infinity
	let latest = -Infinity
	for (const d of dancers) {
		if (d.ts != null) {
			if (d.ts < earliest) earliest = d.ts
			if (d.ts > latest) latest = d.ts
		}
	}
	// If no timestamps found, return zeros
	if (earliest === Infinity) return { earliest: 0, latest: 0 }
	return { earliest, latest }
}

// ---------------------------------------------------------------------------
// Pairing Algorithm
// ---------------------------------------------------------------------------

/**
 * Classify dancers into leader/follower/flex pools.
 * `unknown` role dancers are assigned lead or follow via hash.
 */
export function classifyDancers(
	dancers: DancerRow[],
	songSlot: string,
): { leaders: DancerRow[]; followers: DancerRow[]; flex: DancerRow[] } {
	const leaders: DancerRow[] = []
	const followers: DancerRow[] = []
	const flex: DancerRow[] = []

	for (const d of dancers) {
		switch (d.role) {
			case 'lead':
				leaders.push(d)
				break
			case 'follow':
				followers.push(d)
				break
			case 'both':
				flex.push(d)
				break
			case 'unknown': {
				// Deterministic assignment per song
				const h = hashString(songSlot + '\0unknown\0' + d.name)
				if (h % 2 === 0) {
					leaders.push(d)
				} else {
					followers.push(d)
				}
				break
			}
		}
	}

	return { leaders, followers, flex }
}

/**
 * Priority-biased shuffle: sort by priority + jitter.
 * Returns a new array (does not mutate input).
 */
export function priorityShuffle(
	pool: DancerRow[],
	songSlot: string,
	timestamps: { earliest: number; latest: number },
	weights: PriorityWeights = DEFAULT_WEIGHTS,
): DancerRow[] {
	return [...pool]
		.map((d) => {
			const priority = computePriority(d, timestamps, weights)
			const jitter =
				(hashString(songSlot + '\0jitter\0' + d.name) / MAX_HASH) * weights.jitterWeight
			return { dancer: d, sortKey: priority + jitter }
		})
		.sort((a, b) => b.sortKey - a.sortKey)
		.map((x) => x.dancer)
}

interface PairingResult {
	pairs: [DancerRow, DancerRow][] // [leader, follower]
	solos: DancerRow[]
}

/**
 * Match leaders and followers into pairs. Pull from flex pool when one side
 * runs short. Remaining unmatched dancers become solos.
 */
export function matchPairs(
	leaders: DancerRow[],
	followers: DancerRow[],
	flex: DancerRow[],
): PairingResult {
	const pairs: [DancerRow, DancerRow][] = []
	const remainingFlex = [...flex]

	// Work with copies so we don't mutate the originals
	const leaderQueue = [...leaders]
	const followerQueue = [...followers]

	while (leaderQueue.length > 0 && followerQueue.length > 0) {
		pairs.push([leaderQueue.shift()!, followerQueue.shift()!])
	}

	// One side ran out — fill from flex
	while (leaderQueue.length > 0 && remainingFlex.length > 0) {
		// Need a follower from flex
		pairs.push([leaderQueue.shift()!, remainingFlex.shift()!])
	}
	while (followerQueue.length > 0 && remainingFlex.length > 0) {
		// Need a leader from flex
		pairs.push([remainingFlex.shift()!, followerQueue.shift()!])
	}

	// Pair remaining flex with each other (leader side first)
	while (remainingFlex.length >= 2) {
		pairs.push([remainingFlex.shift()!, remainingFlex.shift()!])
	}

	// Anything left is a solo
	const solos = [...leaderQueue, ...followerQueue, ...remainingFlex]

	return { pairs, solos }
}

/**
 * Message-balancing pass: probabilistically swap members between pairs
 * to spread messages more evenly.
 */
export function balanceMessages(
	pairs: [DancerRow, DancerRow][],
	songSlot: string,
	messageBalanceRate: number = DEFAULT_LAYOUT.messageBalanceRate,
): [DancerRow, DancerRow][] {
	if (pairs.length < 2 || messageBalanceRate <= 0) return pairs

	// Work with mutable copies
	const result: [DancerRow, DancerRow][] = pairs.map(([l, f]) => [l, f])

	// Track which "rich" pairs have already donated
	const donated = new Set<number>()

	for (let i = 0; i < result.length; i++) {
		const [leader, follower] = result[i]
		const leaderHasMsg = !!leader.wish
		const followerHasMsg = !!follower.wish

		// Only target messageless pairs
		if (leaderHasMsg || followerHasMsg) continue

		// Roll per-song hash to decide whether to attempt a swap
		const swapChance = hashString(songSlot + '\0msgbal\0' + i) / MAX_HASH
		if (swapChance >= messageBalanceRate) continue

		// Find a "rich" pair (both members have messages) that hasn't donated yet
		const richCandidates: number[] = []
		for (let j = 0; j < result.length; j++) {
			if (j === i || donated.has(j)) continue
			if (result[j][0].wish && result[j][1].wish) {
				richCandidates.push(j)
			}
		}

		if (richCandidates.length === 0) continue

		// Pick which rich pair to swap with (deterministic per song)
		const richIdx =
			richCandidates[hashString(songSlot + '\0richpick\0' + i) % richCandidates.length]

		// Decide which side to swap (leader or follower)
		const swapLeaderSide = hashString(songSlot + '\0swapside\0' + i) % 2 === 0

		if (swapLeaderSide) {
			// Swap leaders: result[i][0] ↔ result[richIdx][0]
			const temp = result[i][0]
			result[i] = [result[richIdx][0], result[i][1]]
			result[richIdx] = [temp, result[richIdx][1]]
		} else {
			// Swap followers: result[i][1] ↔ result[richIdx][1]
			const temp = result[i][1]
			result[i] = [result[i][0], result[richIdx][1]]
			result[richIdx] = [result[richIdx][0], temp]
		}

		donated.add(richIdx)
	}

	return result
}

/**
 * Build a disambiguation suffix for a dancer name if there are duplicates.
 * Returns '' for unique names or '#N' (1-indexed) for Nth occurrence.
 */
function disambiguate(name: string, allNames: string[]): string {
	const count = allNames.filter((n) => n === name).length
	if (count <= 1) return ''
	const idx = allNames.indexOf(name)
	let occurrence = 0
	for (let i = 0; i <= idx; i++) {
		if (allNames[i] === name) occurrence++
	}
	// Only suffix 2nd, 3rd, etc. — first occurrence gets no suffix
	return occurrence > 1 ? `#${occurrence}` : ''
}

/**
 * Build a unit key for a pair (sorted names) or solo (single name).
 * Includes disambiguation suffixes for duplicate names.
 */
export function buildUnitKey(members: DancerRow[], allNames: string[]): string {
	const keys = members.map((m) => m.name + disambiguate(m.name, allNames))
	return keys.sort().join('\0')
}

/**
 * Full pairing pipeline: classify → shuffle → match → balance → build units.
 */
export function buildDanceUnits(
	dancers: DancerRow[],
	formTitle: string,
	songNumber: number,
	config: DancePartyConfig = DEFAULT_CONFIG,
): DanceUnit[] {
	if (dancers.length === 0) return []

	const songSlot = getSongSlot(formTitle, songNumber)
	const timestamps = getTimestampRange(dancers)
	const allNames = dancers.map((d) => d.name)

	// Step 1: Classify
	const { leaders, followers, flex } = classifyDancers(dancers, songSlot)

	// Step 2: Priority-biased shuffle each pool
	const shuffledLeaders = priorityShuffle(leaders, songSlot, timestamps, config.weights)
	const shuffledFollowers = priorityShuffle(followers, songSlot, timestamps, config.weights)
	const shuffledFlex = priorityShuffle(flex, songSlot, timestamps, config.weights)

	// Step 3: Match pairs
	const { pairs, solos } = matchPairs(shuffledLeaders, shuffledFollowers, shuffledFlex)

	// Step 4: Message balance
	const balancedPairs = balanceMessages(pairs, songSlot, config.layout.messageBalanceRate)

	// Step 5: Build DanceUnit[]
	const units: DanceUnit[] = []

	for (const [leader, follower] of balancedPairs) {
		const unitKey = buildUnitKey([leader, follower], allNames)
		const leaderScore = computePriority(leader, timestamps, config.weights)
		const followerScore = computePriority(follower, timestamps, config.weights)
		const priorityScore = Math.max(leaderScore, followerScore)

		// Assign a both-image from the paired pool
		const imageNum = PAIRED_POOL[hashString(songSlot + '\0img\0' + unitKey) % PAIRED_POOL.length]

		units.push({
			type: 'pair',
			members: [leader, follower],
			unitKey,
			priorityScore,
			imageNum,
		})
	}

	for (const solo of solos) {
		const unitKey = buildUnitKey([solo], allNames)
		const priorityScore = computePriority(solo, timestamps, config.weights)

		// Solo image: lead images 1-6, follow images 1-6
		const role = solo.role === 'lead' || solo.role === 'unknown' ? 'lead' : 'follow'
		const imageNum = (hashString(songSlot + '\0img\0' + unitKey) % 6) + 1

		units.push({
			type: 'solo',
			members: [solo],
			unitKey,
			priorityScore,
			imageNum,
		})
	}

	return units
}

// ---------------------------------------------------------------------------
// Placement Algorithm
// ---------------------------------------------------------------------------

/**
 * Compute placed units with x position, y jitter, and flip state.
 */
export function placeDanceUnits(
	units: DanceUnit[],
	formTitle: string,
	songNumber: number,
	config: DancePartyConfig = DEFAULT_CONFIG,
): PlacedUnit[] {
	if (units.length === 0) return []

	const songSlot = getSongSlot(formTitle, songNumber)
	const maxScore = maxPossibleScore(config.weights)

	// Compute solo cluster center for this song
	const soloClusterCenter = hashString(songSlot + '\0soloCenter') / MAX_HASH

	return units.map((unit) => {
		// Raw position via hash
		let rawPos = hashString(songSlot + '\0pos\0' + unit.unitKey) / MAX_HASH

		// Solo grouping: nudge solos toward the cluster center
		if (unit.type === 'solo') {
			rawPos = lerp(rawPos, soloClusterCenter, config.layout.soloAffinity)
		}

		// Center bias based on priority
		const bias =
			maxScore > 0 ? clamp(unit.priorityScore / maxScore, 0, config.layout.centerBiasMax) : 0
		const x = lerp(rawPos, 0.5, bias)

		// Vertical jitter
		const jitterRange = config.layout.verticalJitter
		const yHash = hashString(songSlot + '\0y\0' + unit.unitKey)
		const yOffset = (yHash % (jitterRange * 2 + 1)) - jitterRange

		// Horizontal flip
		const flipped = hashString(songSlot + '\0flip\0' + unit.unitKey) % 2 === 1

		return { ...unit, x, yOffset, flipped }
	})
}

// ---------------------------------------------------------------------------
// Bubble Alignment
// ---------------------------------------------------------------------------

export function getBubbleAlignment(
	imageNum: number,
	flipped: boolean,
): { leftMember: 'leader' | 'follower'; rightMember: 'leader' | 'follower' } {
	const leaderIsLeft = LEADER_ON_LEFT[imageNum] ?? true
	const effectiveLeaderIsLeft = flipped ? !leaderIsLeft : leaderIsLeft
	return effectiveLeaderIsLeft
		? { leftMember: 'leader', rightMember: 'follower' }
		: { leftMember: 'follower', rightMember: 'leader' }
}

// ---------------------------------------------------------------------------
// Dock-Style Magnification
// ---------------------------------------------------------------------------

/**
 * Compute the scale factor for a unit at a given distance from the scrub position.
 * Returns 1.0 if outside the magnification range.
 */
export function getDockScale(
	distance: number,
	neighborRadius: number,
	dock: DockConfig = DEFAULT_DOCK,
): number {
	const normalizedDist = distance / neighborRadius
	if (normalizedDist >= 1) return 1.0

	let t: number
	if (dock.falloffFn === 'gaussian') {
		// Gaussian: exp(-4 * d^2) — drops to ~2% at the edge
		t = Math.exp(-4 * normalizedDist * normalizedDist)
	} else {
		// Cosine (default): smooth bell curve
		t = (1 + Math.cos(Math.PI * normalizedDist)) / 2
	}

	return 1.0 + (dock.maxScale - 1.0) * t
}

// ---------------------------------------------------------------------------
// Top-level orchestrator
// ---------------------------------------------------------------------------

/**
 * Compute the full dance floor layout: pairing + placement in one call.
 */
export function computeDanceFloor(
	dancers: DancerRow[],
	formTitle: string,
	songNumber: number,
	config: DancePartyConfig = DEFAULT_CONFIG,
): PlacedUnit[] {
	const units = buildDanceUnits(dancers, formTitle, songNumber, config)
	return placeDanceUnits(units, formTitle, songNumber, config)
}

// ---------------------------------------------------------------------------
// Utilities (internal)
// ---------------------------------------------------------------------------

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value))
}
