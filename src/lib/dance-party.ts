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
	/** Minimum horizontal spacing between adjacent units (normalized [0,1]). 0 = no enforcement. */
	minSpacing: number
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
	minSpacing: 0.1, // minimum horizontal gap between adjacent units (normalized)
}

/** Dock magnification defaults (used in Phase 3, defined here for type completeness). */
export const DEFAULT_DOCK: DockConfig = {
	maxScale: 2,
	neighborCount: 2,
	falloffFn: 'cosine',
	baseIconHeight: 109,
	magnifiedSpacing: 4,
}

export const DEFAULT_CONFIG: DancePartyConfig = {
	weights: { ...DEFAULT_WEIGHTS },
	layout: { ...DEFAULT_LAYOUT },
	dock: { ...DEFAULT_DOCK },
}

// ---------------------------------------------------------------------------
// Image Scale Normalization
// ---------------------------------------------------------------------------

/**
 * Per-image scale factors to normalize visual height.
 * Auto-computed from content bounding boxes (median-targeted), then hand-tunable.
 * Applied as CSS transform: scale() in the rendering layer.
 */
export const DANCER_SCALES = {
	both: {
		'1': 1.103,
		'2': 1.133,
		'3': 1.146,
		'4': 1.075,
		'5': 1.061,
		'6': 1.09,
		'7': 1.082,
		'8': 1.02,
		'9': 0.964,
		'10': 0.882,
		'11': 1.251,
		'12': 1.111,
		'13': 0.901,
		'14': 1.201,
		'15': 1.003,
		'16': 1.026,
		'17': 0.988,
		'18': 1.166,
		'19': 1.285,
		'20': 0.929,
		'21': 0.992,
		'22': 1.057,
		'23': 1.051,
		'24': 1.223,
		'25': 0.949,
		'26': 1.169,
		'27': 1.009,
		'28': 1.158,
		'29': 1.169,
		'30': 1.131,
		'31': 1.025,
		'32': 0.981,
	},
	lead: {
		'1': 1.038,
		'2': 1.018,
		'3': 0.982,
		'4': 0.938,
		'5': 0.982,
		'6': 1.057,
	},
	follow: {
		'1': 1.071,
		'2': 1.01,
		'3': 1.003,
		'4': 0.991,
		'5': 0.901,
		'6': 0.997,
	},
} as const

/**
 * Look up the scale factor for a dancer image.
 * Returns 1.0 for unknown images.
 */
export function getDancerScale(role: 'both' | 'lead' | 'follow', imageNum: number): number {
	return DANCER_SCALES[role]?.[imageNum] ?? 1.0
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
 * Pick an image from a pool, avoiding already-used images when possible.
 *
 * Hashes to pick an initial candidate; if it collides with `usedImages`,
 * re-hashes with incrementing seeds (up to pool size attempts).
 * Falls back to the original hash pick if all images are used.
 */
export function assignUniqueImage(
	songSlot: string,
	unitKey: string,
	pool: readonly number[],
	usedImages: Set<number>,
): number {
	const baseHash = hashString(songSlot + '\0img\0' + unitKey)
	const firstChoice = pool[baseHash % pool.length]

	// If the pool is fully exhausted, just return the hash pick (allow repeats)
	if (usedImages.size >= pool.length) return firstChoice

	// If first choice is free, use it
	if (!usedImages.has(firstChoice)) return firstChoice

	// Re-hash with incrementing seeds to find an unused image
	for (let attempt = 1; attempt < pool.length; attempt++) {
		const candidate =
			pool[hashString(songSlot + '\0img\0' + unitKey + '\0' + attempt) % pool.length]
		if (!usedImages.has(candidate)) return candidate
	}

	// Fallback: linear scan for any unused image (guarantees a result if pool isn't exhausted)
	const startIdx = baseHash % pool.length
	for (let offset = 0; offset < pool.length; offset++) {
		const candidate = pool[(startIdx + offset) % pool.length]
		if (!usedImages.has(candidate)) return candidate
	}

	// All used (shouldn't reach here if usedImages.size < pool.length, but safety)
	return firstChoice
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

	// Track used images per pool to avoid duplicates within a song
	const usedPairImages = new Set<number>()
	const usedLeadImages = new Set<number>()
	const usedFollowImages = new Set<number>()

	for (const [leader, follower] of balancedPairs) {
		const unitKey = buildUnitKey([leader, follower], allNames)
		const leaderScore = computePriority(leader, timestamps, config.weights)
		const followerScore = computePriority(follower, timestamps, config.weights)
		const priorityScore = Math.max(leaderScore, followerScore)

		// Assign a both-image from the paired pool, avoiding duplicates
		const imageNum = assignUniqueImage(songSlot, unitKey, PAIRED_POOL, usedPairImages)
		usedPairImages.add(imageNum)

		units.push({
			type: 'pair',
			members: [leader, follower],
			unitKey,
			priorityScore,
			imageNum,
		})
	}

	const SOLO_POOL = [1, 2, 3, 4, 5, 6] as const

	for (const solo of solos) {
		const unitKey = buildUnitKey([solo], allNames)
		const priorityScore = computePriority(solo, timestamps, config.weights)

		// Solo image: lead images 1-6, follow images 1-6 (deduped per role)
		const role = solo.role === 'lead' || solo.role === 'unknown' ? 'lead' : 'follow'
		const usedPool = role === 'lead' ? usedLeadImages : usedFollowImages
		const imageNum = assignUniqueImage(songSlot, unitKey, SOLO_POOL, usedPool)
		usedPool.add(imageNum)

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
 * Enforce minimum horizontal spacing between adjacent placed units.
 *
 * Algorithm:
 * 1. Sort units by their hash-derived x positions
 * 2. Sweep left→right, pushing any unit that's too close to its left neighbor
 * 3. If the sweep pushes units past x=1, re-center the entire spread within
 *    [margin, 1-margin] so everything fits
 *
 * This preserves the relative ordering from hashing (no scramble) while
 * eliminating clumps. Adding a dancer only shifts immediate neighbors.
 */
export function enforceMinSpacing(units: PlacedUnit[], minSpacing: number): PlacedUnit[] {
	if (units.length <= 1 || minSpacing <= 0) return units

	// Sort indices by x position (stable: break ties by unitKey)
	const indices = units.map((_, i) => i)
	indices.sort(
		(a, b) => units[a].x - units[b].x || units[a].unitKey.localeCompare(units[b].unitKey),
	)

	// Work with a mutable copy of x values in sorted order
	const sortedX = indices.map((i) => units[i].x)

	// Sweep left→right: enforce minimum gap
	for (let i = 1; i < sortedX.length; i++) {
		const gap = sortedX[i] - sortedX[i - 1]
		if (gap < minSpacing) {
			sortedX[i] = sortedX[i - 1] + minSpacing
		}
	}

	// Check if the spread exceeds [0, 1] and re-center if needed
	const margin = minSpacing / 2
	const totalSpread = sortedX[sortedX.length - 1] - sortedX[0]
	const available = 1 - 2 * margin

	if (totalSpread > available) {
		// Spread is wider than the available range — compress proportionally
		// while maintaining min spacing as best we can
		const scale = available / totalSpread
		const base = sortedX[0]
		for (let i = 0; i < sortedX.length; i++) {
			sortedX[i] = margin + (sortedX[i] - base) * scale
		}
	} else {
		// Shift so the spread is centered in [margin, 1-margin]
		const currentCenter = (sortedX[0] + sortedX[sortedX.length - 1]) / 2
		const targetCenter = 0.5
		const shift = targetCenter - currentCenter

		// Clamp the shift so we don't push past margins
		const leftOverflow = margin - (sortedX[0] + shift)
		const rightOverflow = sortedX[sortedX.length - 1] + shift - (1 - margin)
		const clampedShift = shift + Math.max(0, leftOverflow) - Math.max(0, rightOverflow)

		for (let i = 0; i < sortedX.length; i++) {
			sortedX[i] = clamp(sortedX[i] + clampedShift, margin, 1 - margin)
		}
	}

	// Write adjusted x values back to a new array of PlacedUnits
	const result = [...units]
	for (let i = 0; i < indices.length; i++) {
		const origIdx = indices[i]
		if (result[origIdx].x !== sortedX[i]) {
			result[origIdx] = { ...result[origIdx], x: sortedX[i] }
		}
	}

	return result
}

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

	const placed = units.map((unit) => {
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

		return { ...unit, x, yOffset, flipped } as PlacedUnit
	})

	// Enforce minimum spacing to prevent clumping
	return enforceMinSpacing(placed, config.layout.minSpacing)
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

export interface DockLayoutEntry {
	/** Scale factor for this unit (1.0 when outside magnification range). */
	scale: number
	/** Horizontal pixel offset from idle position (due to magnified region expanding). */
	dx: number
}

/**
 * Compute the dock-style magnification layout for all units.
 *
 * Returns per-unit { scale, dx } where:
 * - `scale` is the magnification factor (1.0 = idle)
 * - `dx` is the pixel offset from the idle position to accommodate the expanded magnified region
 *
 * The "lens" model: magnified units need extra horizontal space proportional to
 * (scale - 1) * baseWidth. This extra space is accumulated and split so items
 * to the left of the scrub center shift left, and items to the right shift right.
 * Items outside the magnification range get a flat shift equal to their side's
 * total accumulated extra width.
 *
 * @param unitPositions - normalized [0,1] x positions of each unit (from PlacedUnit.x)
 * @param scrubX - normalized [0,1] scrub position
 * @param containerWidth - pixel width of the dance floor container
 * @param dock - dock configuration (maxScale, neighborCount, falloffFn, baseIconHeight, magnifiedSpacing)
 */
export function computeDockLayout(
	unitPositions: number[],
	scrubX: number,
	containerWidth: number,
	dock: DockConfig = DEFAULT_DOCK,
): DockLayoutEntry[] {
	const n = unitPositions.length
	if (n === 0) return []

	// Compute neighbor radius: average spacing * neighborCount
	// This adapts to dancer density — sparse floors get wider radius, dense floors tighter
	const sorted = [...unitPositions].sort((a, b) => a - b)
	let avgSpacing: number
	if (sorted.length <= 1) {
		avgSpacing = 0.2 // fallback for 0-1 units
	} else {
		let totalGap = 0
		for (let i = 1; i < sorted.length; i++) {
			totalGap += sorted[i] - sorted[i - 1]
		}
		avgSpacing = totalGap / (sorted.length - 1)
	}
	const neighborRadius = avgSpacing * dock.neighborCount

	// If radius is effectively zero, no magnification is possible
	if (neighborRadius <= 0) {
		return unitPositions.map(() => ({ scale: 1, dx: 0 }))
	}

	// Step 1: Compute per-unit scale
	const scales = unitPositions.map((pos) => {
		const distance = Math.abs(pos - scrubX)
		return getDockScale(distance, neighborRadius, dock)
	})

	// Step 2: Compute per-unit extra width in pixels
	// Each unit's idle width is baseIconHeight (icons are square-ish).
	// When magnified, it occupies baseIconHeight * scale.
	// The extra width = baseIconHeight * (scale - 1).
	const baseWidth = dock.baseIconHeight
	const extras = scales.map((s) => baseWidth * (s - 1))

	// Step 3: Compute dx offsets using the "lens" model.
	// We accumulate extra width from the scrub center outward.
	// Items to the left of scrubX shift leftward (negative dx),
	// items to the right shift rightward (positive dx).
	// Each item's own expansion also contributes: it shifts by half its own extra
	// plus all the extras of items between it and the scrub center.

	// Sort indices by position for the sweep
	const indices = unitPositions.map((_, i) => i)
	indices.sort((a, b) => unitPositions[a] - unitPositions[b])

	// Find the split point: last index whose position <= scrubX
	let splitIdx = -1
	for (let i = 0; i < indices.length; i++) {
		if (unitPositions[indices[i]] <= scrubX) splitIdx = i
	}

	const dx = new Array<number>(n).fill(0)

	// Sweep rightward from the split point: items to the right of scrub center
	// Each item shifts right by the accumulated extra of items between it and scrubX,
	// plus half its own extra.
	let accumulatedRight = 0
	for (let i = splitIdx + 1; i < indices.length; i++) {
		const idx = indices[i]
		// Add half the extra of the previous magnified item (or the item at scrubX)
		if (i === splitIdx + 1 && splitIdx >= 0) {
			accumulatedRight += extras[indices[splitIdx]] / 2
		} else if (i > splitIdx + 1) {
			accumulatedRight += extras[indices[i - 1]] / 2
		}
		accumulatedRight += extras[idx] / 2
		dx[idx] = accumulatedRight
	}

	// Sweep leftward from the split point: items to the left shift left (negative dx)
	let accumulatedLeft = 0
	for (let i = splitIdx; i >= 0; i--) {
		const idx = indices[i]
		if (i === splitIdx && splitIdx + 1 < indices.length) {
			// The item at/just-left-of scrubX: shift left by half its own extra
			// plus half the extra of the first right-side item
			accumulatedLeft += extras[idx] / 2
			if (splitIdx + 1 < indices.length) {
				accumulatedLeft += extras[indices[splitIdx + 1]] / 2
			}
		} else if (i < splitIdx) {
			accumulatedLeft += extras[indices[i + 1]] / 2
			accumulatedLeft += extras[idx] / 2
		} else {
			// splitIdx === i and nothing to the right
			accumulatedLeft += extras[idx] / 2
		}
		dx[idx] = -accumulatedLeft
	}

	return scales.map((scale, i) => ({ scale, dx: dx[i] }))
}

/**
 * Find the index of the unit nearest to the given scrub position.
 * Returns -1 if the array is empty.
 */
export function findNearestUnit(unitPositions: number[], scrubX: number): number {
	if (unitPositions.length === 0) return -1
	let bestIdx = 0
	let bestDist = Math.abs(unitPositions[0] - scrubX)
	for (let i = 1; i < unitPositions.length; i++) {
		const dist = Math.abs(unitPositions[i] - scrubX)
		if (dist < bestDist) {
			bestDist = dist
			bestIdx = i
		}
	}
	return bestIdx
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
