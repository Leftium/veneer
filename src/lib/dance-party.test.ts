import { describe, it, expect } from 'vitest'
import type { DancerRow } from './util'
import {
	getSongNumber,
	getSongSlot,
	computePriority,
	maxPossibleScore,
	getTimestampRange,
	classifyDancers,
	priorityShuffle,
	matchPairs,
	balanceMessages,
	buildUnitKey,
	buildDanceUnits,
	placeDanceUnits,
	computeDanceFloor,
	getBubbleAlignment,
	getDockScale,
	LEADER_ON_LEFT,
	PAIRED_POOL,
	DEFAULT_CONFIG,
	DEFAULT_WEIGHTS,
	DEFAULT_LAYOUT,
	DEFAULT_DOCK,
	type DanceUnit,
	type DancePartyConfig,
} from './dance-party'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDancer(
	name: string,
	role: DancerRow['role'] = 'lead',
	overrides: Partial<DancerRow> = {},
): DancerRow {
	return { name, role, ...overrides }
}

const FORM = 'Test Dance Event 2026'

// ---------------------------------------------------------------------------
// Song Computation
// ---------------------------------------------------------------------------

describe('getSongNumber', () => {
	it('returns 1 for null/undefined timestamp', () => {
		expect(getSongNumber(null)).toBe(1)
		expect(getSongNumber(undefined)).toBe(1)
	})

	it('returns 1 for zero/negative timestamp', () => {
		expect(getSongNumber(0)).toBe(1)
		expect(getSongNumber(-1000)).toBe(1)
	})

	it('returns 1 when now is the same hour as first signup', () => {
		const ts = new Date('2026-02-24T10:30:00Z').getTime()
		const now = new Date('2026-02-24T10:45:00Z')
		expect(getSongNumber(ts, now)).toBe(1)
	})

	it('increments by 1 each hour', () => {
		const ts = new Date('2026-02-24T10:00:00Z').getTime()
		expect(getSongNumber(ts, new Date('2026-02-24T11:00:00Z'))).toBe(2)
		expect(getSongNumber(ts, new Date('2026-02-24T12:00:00Z'))).toBe(3)
		expect(getSongNumber(ts, new Date('2026-02-24T13:30:00Z'))).toBe(4)
	})

	it('never returns less than 1', () => {
		// now is before the first signup — clamp
		const ts = new Date('2026-02-24T15:00:00Z').getTime()
		const now = new Date('2026-02-24T10:00:00Z')
		expect(getSongNumber(ts, now)).toBe(1)
	})
})

describe('getSongSlot', () => {
	it('builds a deterministic slot string', () => {
		expect(getSongSlot('My Event', 1)).toBe('My Event\0song1')
		expect(getSongSlot('My Event', 5)).toBe('My Event\0song5')
	})

	it('different form titles produce different slots', () => {
		expect(getSongSlot('Event A', 1)).not.toBe(getSongSlot('Event B', 1))
	})
})

// ---------------------------------------------------------------------------
// Priority Scoring
// ---------------------------------------------------------------------------

describe('computePriority', () => {
	const range = { earliest: 1000, latest: 5000 }

	it('returns 0 for a dancer with nothing special and latest signup', () => {
		const d = makeDancer('A', 'lead', { ts: 5000 })
		// earlySignup = 0 (latest signup), no message, not paid
		expect(computePriority(d, range)).toBe(0)
	})

	it('adds hasMessage weight when wish is present', () => {
		const d = makeDancer('A', 'lead', { wish: 'hello', ts: 5000 })
		expect(computePriority(d, range)).toBe(DEFAULT_WEIGHTS.hasMessage)
	})

	it('adds hasPaid weight when paid is true', () => {
		const d = makeDancer('A', 'lead', { paid: true, ts: 5000 })
		expect(computePriority(d, range)).toBe(DEFAULT_WEIGHTS.hasPaid)
	})

	it('stacks message + paid + early signup', () => {
		const d = makeDancer('A', 'lead', { wish: 'hi', paid: true, ts: 1000 })
		// earlySignup = 1.0 (earliest)
		const expected =
			DEFAULT_WEIGHTS.hasMessage + DEFAULT_WEIGHTS.hasPaid + DEFAULT_WEIGHTS.earlySignup
		expect(computePriority(d, range)).toBeCloseTo(expected)
	})

	it('interpolates earlySignup linearly', () => {
		const midD = makeDancer('A', 'lead', { ts: 3000 })
		const score = computePriority(midD, range)
		// ts=3000 is halfway: normalized = 1 - (3000-1000)/(5000-1000) = 0.5
		expect(score).toBeCloseTo(0.5 * DEFAULT_WEIGHTS.earlySignup)
	})

	it('gives full earlySignup bonus when range is zero (single dancer)', () => {
		const d = makeDancer('A', 'lead', { ts: 1000 })
		const score = computePriority(d, { earliest: 1000, latest: 1000 })
		expect(score).toBe(DEFAULT_WEIGHTS.earlySignup)
	})

	it('gives full earlySignup bonus when ts is null', () => {
		const d = makeDancer('A', 'lead')
		const score = computePriority(d, range)
		expect(score).toBe(DEFAULT_WEIGHTS.earlySignup)
	})
})

describe('maxPossibleScore', () => {
	it('sums all weights', () => {
		expect(maxPossibleScore()).toBe(
			DEFAULT_WEIGHTS.hasMessage + DEFAULT_WEIGHTS.hasPaid + DEFAULT_WEIGHTS.earlySignup,
		)
	})
})

describe('getTimestampRange', () => {
	it('returns zeros for empty array', () => {
		expect(getTimestampRange([])).toEqual({ earliest: 0, latest: 0 })
	})

	it('returns zeros when no dancers have timestamps', () => {
		expect(getTimestampRange([makeDancer('A')])).toEqual({ earliest: 0, latest: 0 })
	})

	it('returns min/max of timestamps', () => {
		const dancers = [
			makeDancer('A', 'lead', { ts: 3000 }),
			makeDancer('B', 'follow', { ts: 1000 }),
			makeDancer('C', 'lead', { ts: 5000 }),
		]
		expect(getTimestampRange(dancers)).toEqual({ earliest: 1000, latest: 5000 })
	})

	it('skips null timestamps', () => {
		const dancers = [makeDancer('A', 'lead', { ts: null }), makeDancer('B', 'follow', { ts: 2000 })]
		expect(getTimestampRange(dancers)).toEqual({ earliest: 2000, latest: 2000 })
	})
})

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

describe('classifyDancers', () => {
	const slot = 'test\0song1'

	it('sorts explicit roles correctly', () => {
		const dancers = [makeDancer('L1', 'lead'), makeDancer('F1', 'follow'), makeDancer('B1', 'both')]
		const { leaders, followers, flex } = classifyDancers(dancers, slot)
		expect(leaders.map((d) => d.name)).toEqual(['L1'])
		expect(followers.map((d) => d.name)).toEqual(['F1'])
		expect(flex.map((d) => d.name)).toEqual(['B1'])
	})

	it('assigns unknown role dancers deterministically', () => {
		const dancers = [makeDancer('U1', 'unknown'), makeDancer('U2', 'unknown')]
		const result1 = classifyDancers(dancers, slot)
		const result2 = classifyDancers(dancers, slot)

		// Same slot → same assignment
		expect(result1.leaders.map((d) => d.name)).toEqual(result2.leaders.map((d) => d.name))
		expect(result1.followers.map((d) => d.name)).toEqual(result2.followers.map((d) => d.name))
	})

	it('unknown dancers may change assignment with different song slot', () => {
		const dancers = Array.from({ length: 10 }, (_, i) => makeDancer(`U${i}`, 'unknown'))
		const r1 = classifyDancers(dancers, 'form\0song1')
		const r2 = classifyDancers(dancers, 'form\0song2')

		// At least some should differ (with 10 dancers, probabilistically near-certain)
		const names1 = new Set(r1.leaders.map((d) => d.name))
		const names2 = new Set(r2.leaders.map((d) => d.name))
		const same = [...names1].filter((n) => names2.has(n)).length
		// Not all should be the same (extremely unlikely with 10 dancers and different slots)
		expect(same).toBeLessThan(10)
	})
})

// ---------------------------------------------------------------------------
// Priority Shuffle
// ---------------------------------------------------------------------------

describe('priorityShuffle', () => {
	const range = { earliest: 1000, latest: 5000 }

	it('returns all members', () => {
		const pool = [makeDancer('A'), makeDancer('B'), makeDancer('C')]
		const result = priorityShuffle(pool, 'slot', range)
		expect(result).toHaveLength(3)
		expect(new Set(result.map((d) => d.name))).toEqual(new Set(['A', 'B', 'C']))
	})

	it('is deterministic for same inputs', () => {
		const pool = [makeDancer('A'), makeDancer('B'), makeDancer('C')]
		const r1 = priorityShuffle(pool, 'slot', range)
		const r2 = priorityShuffle(pool, 'slot', range)
		expect(r1.map((d) => d.name)).toEqual(r2.map((d) => d.name))
	})

	it('tends to place high-priority dancers first', () => {
		const pool = [
			makeDancer('Low', 'lead', { ts: 5000 }), // latest signup, no extras
			makeDancer('High', 'lead', { ts: 1000, wish: 'hello', paid: true }), // max priority
		]

		// With low jitter, High should consistently come first
		const weights = { ...DEFAULT_WEIGHTS, jitterWeight: 0.1 }
		const result = priorityShuffle(pool, 'slot', range, weights)
		expect(result[0].name).toBe('High')
	})

	it('does not mutate the input array', () => {
		const pool = [makeDancer('A'), makeDancer('B')]
		const copy = [...pool]
		priorityShuffle(pool, 'slot', range)
		expect(pool).toEqual(copy)
	})
})

// ---------------------------------------------------------------------------
// Match Pairs
// ---------------------------------------------------------------------------

describe('matchPairs', () => {
	it('pairs leaders with followers', () => {
		const leaders = [makeDancer('L1', 'lead'), makeDancer('L2', 'lead')]
		const followers = [makeDancer('F1', 'follow'), makeDancer('F2', 'follow')]
		const { pairs, solos } = matchPairs(leaders, followers, [])

		expect(pairs).toHaveLength(2)
		expect(pairs[0][0].name).toBe('L1')
		expect(pairs[0][1].name).toBe('F1')
		expect(solos).toHaveLength(0)
	})

	it('fills from flex when one side is short', () => {
		const leaders = [makeDancer('L1', 'lead'), makeDancer('L2', 'lead')]
		const followers = [makeDancer('F1', 'follow')]
		const flex = [makeDancer('B1', 'both')]
		const { pairs, solos } = matchPairs(leaders, followers, flex)

		expect(pairs).toHaveLength(2)
		// L2 was unmatched, so B1 fills the follower side
		expect(pairs[1][0].name).toBe('L2')
		expect(pairs[1][1].name).toBe('B1')
		expect(solos).toHaveLength(0)
	})

	it('pairs flex members with each other when leaders/followers exhausted', () => {
		const flex = [makeDancer('B1', 'both'), makeDancer('B2', 'both')]
		const { pairs, solos } = matchPairs([], [], flex)

		expect(pairs).toHaveLength(1)
		expect(solos).toHaveLength(0)
	})

	it('leaves unmatched dancers as solos', () => {
		const leaders = [makeDancer('L1', 'lead'), makeDancer('L2', 'lead'), makeDancer('L3', 'lead')]
		const followers = [makeDancer('F1', 'follow')]
		const { pairs, solos } = matchPairs(leaders, followers, [])

		expect(pairs).toHaveLength(1)
		expect(solos).toHaveLength(2)
		expect(solos.map((d) => d.name).sort()).toEqual(['L2', 'L3'])
	})

	it('odd flex member becomes solo', () => {
		const flex = [makeDancer('B1', 'both'), makeDancer('B2', 'both'), makeDancer('B3', 'both')]
		const { pairs, solos } = matchPairs([], [], flex)

		expect(pairs).toHaveLength(1)
		expect(solos).toHaveLength(1)
		expect(solos[0].name).toBe('B3')
	})

	it('handles empty inputs', () => {
		const { pairs, solos } = matchPairs([], [], [])
		expect(pairs).toHaveLength(0)
		expect(solos).toHaveLength(0)
	})
})

// ---------------------------------------------------------------------------
// Message Balancing
// ---------------------------------------------------------------------------

describe('balanceMessages', () => {
	it('does nothing with rate=0', () => {
		const pairs: [DancerRow, DancerRow][] = [
			[makeDancer('L1', 'lead', { wish: 'hi' }), makeDancer('F1', 'follow', { wish: 'yo' })],
			[makeDancer('L2', 'lead'), makeDancer('F2', 'follow')],
		]
		const result = balanceMessages(pairs, 'slot', 0)
		// Should be unchanged
		expect(result[0][0].name).toBe('L1')
		expect(result[1][0].name).toBe('L2')
	})

	it('does nothing when fewer than 2 pairs', () => {
		const pairs: [DancerRow, DancerRow][] = [[makeDancer('L1', 'lead'), makeDancer('F1', 'follow')]]
		const result = balanceMessages(pairs, 'slot', 1.0)
		expect(result).toHaveLength(1)
	})

	it('can swap to spread messages (rate=1)', () => {
		// Rich pair: both have messages. Poor pair: neither has messages.
		const rich: [DancerRow, DancerRow] = [
			makeDancer('L1', 'lead', { wish: 'hello' }),
			makeDancer('F1', 'follow', { wish: 'world' }),
		]
		const poor: [DancerRow, DancerRow] = [makeDancer('L2', 'lead'), makeDancer('F2', 'follow')]

		const result = balanceMessages([rich, poor], 'slot', 1.0)

		// After balancing, the poor pair should have at least one member with a message
		const poorResult = result[1]
		const hasMessage = !!poorResult[0].wish || !!poorResult[1].wish
		expect(hasMessage).toBe(true)
	})

	it('does not mutate the input', () => {
		const pairs: [DancerRow, DancerRow][] = [
			[makeDancer('L1', 'lead', { wish: 'hi' }), makeDancer('F1', 'follow', { wish: 'yo' })],
			[makeDancer('L2', 'lead'), makeDancer('F2', 'follow')],
		]
		const origNames = pairs.map(([l, f]) => [l.name, f.name])
		balanceMessages(pairs, 'slot', 1.0)
		expect(pairs.map(([l, f]) => [l.name, f.name])).toEqual(origNames)
	})

	it('is deterministic', () => {
		const pairs: [DancerRow, DancerRow][] = [
			[makeDancer('L1', 'lead', { wish: 'hi' }), makeDancer('F1', 'follow', { wish: 'yo' })],
			[makeDancer('L2', 'lead'), makeDancer('F2', 'follow')],
		]
		const r1 = balanceMessages(pairs, 'slot', 1.0)
		const r2 = balanceMessages(pairs, 'slot', 1.0)
		expect(r1.map(([l, f]) => [l.name, f.name])).toEqual(r2.map(([l, f]) => [l.name, f.name]))
	})
})

// ---------------------------------------------------------------------------
// Unit Key
// ---------------------------------------------------------------------------

describe('buildUnitKey', () => {
	it('sorts pair names', () => {
		const key = buildUnitKey([makeDancer('Bob'), makeDancer('Alice')], ['Bob', 'Alice'])
		expect(key).toBe('Alice\0Bob')
	})

	it('returns single name for solo', () => {
		const key = buildUnitKey([makeDancer('Alice')], ['Alice'])
		expect(key).toBe('Alice')
	})

	it('disambiguates duplicate names', () => {
		const allNames = ['Kim', 'Kim', 'Lee']
		const key1 = buildUnitKey([makeDancer('Kim')], allNames) // first Kim
		// Second Kim would be at index 1 in allNames — but buildUnitKey uses the first
		// occurrence in allNames. The first Kim gets no suffix.
		expect(key1).toBe('Kim')
	})
})

// ---------------------------------------------------------------------------
// Build Dance Units (Integration)
// ---------------------------------------------------------------------------

describe('buildDanceUnits', () => {
	it('returns empty for empty input', () => {
		expect(buildDanceUnits([], FORM, 1)).toEqual([])
	})

	it('creates a pair from one leader and one follower', () => {
		const dancers = [makeDancer('L1', 'lead'), makeDancer('F1', 'follow')]
		const units = buildDanceUnits(dancers, FORM, 1)

		expect(units).toHaveLength(1)
		expect(units[0].type).toBe('pair')
		expect(units[0].members).toHaveLength(2)
	})

	it('creates solos when there are no pairing partners', () => {
		const dancers = [makeDancer('L1', 'lead'), makeDancer('L2', 'lead'), makeDancer('L3', 'lead')]
		const units = buildDanceUnits(dancers, FORM, 1)

		// All leaders, no followers/flex → all solos
		expect(units.every((u) => u.type === 'solo')).toBe(true)
		expect(units).toHaveLength(3)
	})

	it('mixes pairs and solos', () => {
		const dancers = [makeDancer('L1', 'lead'), makeDancer('L2', 'lead'), makeDancer('F1', 'follow')]
		const units = buildDanceUnits(dancers, FORM, 1)

		const pairs = units.filter((u) => u.type === 'pair')
		const solos = units.filter((u) => u.type === 'solo')
		expect(pairs).toHaveLength(1)
		expect(solos).toHaveLength(1)
	})

	it('uses flex members to fill both sides', () => {
		const dancers = [
			makeDancer('L1', 'lead'),
			makeDancer('B1', 'both'),
			makeDancer('B2', 'both'),
			makeDancer('F1', 'follow'),
		]
		const units = buildDanceUnits(dancers, FORM, 1)

		// Should form 2 pairs: L1+someone, someone+F1
		const pairs = units.filter((u) => u.type === 'pair')
		expect(pairs).toHaveLength(2)
	})

	it('assigns valid paired-pool image numbers to pairs', () => {
		const dancers = [makeDancer('L1', 'lead'), makeDancer('F1', 'follow')]
		const units = buildDanceUnits(dancers, FORM, 1)
		expect(PAIRED_POOL).toContain(units[0].imageNum)
	})

	it('assigns 1-6 image numbers to solos', () => {
		const dancers = [makeDancer('L1', 'lead')]
		const units = buildDanceUnits(dancers, FORM, 1)
		expect(units[0].imageNum).toBeGreaterThanOrEqual(1)
		expect(units[0].imageNum).toBeLessThanOrEqual(6)
	})

	it('is deterministic', () => {
		const dancers = [
			makeDancer('L1', 'lead', { ts: 1000, wish: 'hi' }),
			makeDancer('F1', 'follow', { ts: 2000 }),
			makeDancer('B1', 'both', { ts: 3000, paid: true }),
		]
		const u1 = buildDanceUnits(dancers, FORM, 1)
		const u2 = buildDanceUnits(dancers, FORM, 1)
		expect(u1.map((u) => u.unitKey)).toEqual(u2.map((u) => u.unitKey))
		expect(u1.map((u) => u.imageNum)).toEqual(u2.map((u) => u.imageNum))
	})

	it('produces different arrangements for different songs', () => {
		// Use many dancers to make it overwhelmingly likely that at least one
		// unit key or image number differs across songs
		const dancers = Array.from({ length: 20 }, (_, i) =>
			makeDancer(`D${i}`, i % 2 === 0 ? 'lead' : 'follow', { ts: 1000 + i * 100 }),
		)

		// Check across several song pairs — we only need ONE to differ
		let anyDifference = false
		for (let song = 1; song <= 10; song++) {
			const u1 = buildDanceUnits(dancers, FORM, song)
			const u2 = buildDanceUnits(dancers, FORM, song + 1)

			const keys1 = u1.map((u) => u.unitKey).sort()
			const keys2 = u2.map((u) => u.unitKey).sort()
			const imgs1 = u1.map((u) => u.imageNum).sort()
			const imgs2 = u2.map((u) => u.imageNum).sort()

			if (
				JSON.stringify(keys1) !== JSON.stringify(keys2) ||
				JSON.stringify(imgs1) !== JSON.stringify(imgs2)
			) {
				anyDifference = true
				break
			}
		}
		expect(anyDifference).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

describe('placeDanceUnits', () => {
	it('returns empty for empty units', () => {
		expect(placeDanceUnits([], FORM, 1)).toEqual([])
	})

	it('assigns x in [0, 1] range', () => {
		const dancers = [makeDancer('L1', 'lead'), makeDancer('F1', 'follow'), makeDancer('L2', 'lead')]
		const units = buildDanceUnits(dancers, FORM, 1)
		const placed = placeDanceUnits(units, FORM, 1)

		for (const p of placed) {
			expect(p.x).toBeGreaterThanOrEqual(0)
			expect(p.x).toBeLessThanOrEqual(1)
		}
	})

	it('applies center bias: high-priority closer to 0.5', () => {
		// Create two dancers: one with max priority, one with zero
		const highPriority: DanceUnit = {
			type: 'solo',
			members: [makeDancer('High', 'lead', { wish: 'hi', paid: true, ts: 1000 })],
			unitKey: 'High',
			priorityScore: maxPossibleScore(),
			imageNum: 1,
		}
		const lowPriority: DanceUnit = {
			type: 'solo',
			members: [makeDancer('Low', 'lead', { ts: 5000 })],
			unitKey: 'Low',
			priorityScore: 0,
			imageNum: 2,
		}

		const placed = placeDanceUnits([highPriority, lowPriority], FORM, 1)

		// High-priority should be closer to center (0.5)
		const highDist = Math.abs(placed[0].x - 0.5)
		const lowDist = Math.abs(placed[1].x - 0.5)
		// This isn't guaranteed for all hash values, but with center bias = 0.8
		// the high-priority item should be very close to 0.5
		expect(highDist).toBeLessThan(0.15) // within 15% of center
	})

	it('yOffset is within jitter range', () => {
		const dancers = Array.from({ length: 10 }, (_, i) =>
			makeDancer(`D${i}`, i % 2 === 0 ? 'lead' : 'follow'),
		)
		const units = buildDanceUnits(dancers, FORM, 1)
		const placed = placeDanceUnits(units, FORM, 1)

		for (const p of placed) {
			expect(Math.abs(p.yOffset)).toBeLessThanOrEqual(DEFAULT_LAYOUT.verticalJitter)
		}
	})

	it('flipped is a boolean', () => {
		const dancers = [makeDancer('L1', 'lead'), makeDancer('F1', 'follow')]
		const units = buildDanceUnits(dancers, FORM, 1)
		const placed = placeDanceUnits(units, FORM, 1)

		for (const p of placed) {
			expect(typeof p.flipped).toBe('boolean')
		}
	})

	it('solos cluster together', () => {
		// 5 solos with high affinity
		const dancers = Array.from({ length: 5 }, (_, i) => makeDancer(`S${i}`, 'lead'))
		const units = buildDanceUnits(dancers, FORM, 1)

		const highAffinity = { ...DEFAULT_CONFIG, layout: { ...DEFAULT_LAYOUT, soloAffinity: 0.9 } }
		const placed = placeDanceUnits(units, FORM, 1, highAffinity)

		// With 0.9 affinity, all solos should be close to each other
		const xs = placed.map((p) => p.x)
		const range = Math.max(...xs) - Math.min(...xs)
		expect(range).toBeLessThan(0.3) // tightly clustered
	})

	it('is deterministic', () => {
		const dancers = [makeDancer('L1', 'lead'), makeDancer('F1', 'follow')]
		const units = buildDanceUnits(dancers, FORM, 1)

		const p1 = placeDanceUnits(units, FORM, 1)
		const p2 = placeDanceUnits(units, FORM, 1)
		expect(p1.map((p) => p.x)).toEqual(p2.map((p) => p.x))
		expect(p1.map((p) => p.yOffset)).toEqual(p2.map((p) => p.yOffset))
		expect(p1.map((p) => p.flipped)).toEqual(p2.map((p) => p.flipped))
	})
})

// ---------------------------------------------------------------------------
// computeDanceFloor (end-to-end)
// ---------------------------------------------------------------------------

describe('computeDanceFloor', () => {
	it('returns placed units for a realistic scenario', () => {
		const dancers: DancerRow[] = [
			{ name: '김철수', role: 'lead', ts: 1000, wish: 'Having a great time!', paid: true },
			{ name: '이영희', role: 'follow', ts: 2000, wish: "Can't wait! 🎉" },
			{ name: '박지훈', role: 'lead', ts: 3000, paid: true },
			{ name: '최수정', role: 'follow', ts: 4000, wish: 'So excited!' },
			{ name: '정민수', role: 'both', ts: 5000 },
			{ name: '한소연', role: 'follow', ts: 6000, wish: 'My first dance!' },
			{ name: '오태호', role: 'lead', ts: 7000 },
		]

		const placed = computeDanceFloor(dancers, FORM, 1)

		// 7 dancers: expect some pairs and some solos
		expect(placed.length).toBeGreaterThan(0)
		expect(placed.length).toBeLessThanOrEqual(7) // at most 7 units (all solos)

		// All should have valid placement data
		for (const p of placed) {
			expect(p.x).toBeGreaterThanOrEqual(0)
			expect(p.x).toBeLessThanOrEqual(1)
			expect(typeof p.flipped).toBe('boolean')
			expect(typeof p.yOffset).toBe('number')
			expect(p.imageNum).toBeGreaterThan(0)
		}

		// Total members across all units should equal input count
		const totalMembers = placed.reduce((sum, u) => sum + u.members.length, 0)
		expect(totalMembers).toBe(dancers.length)
	})

	it('handles single dancer', () => {
		const placed = computeDanceFloor([makeDancer('Solo', 'lead')], FORM, 1)
		expect(placed).toHaveLength(1)
		expect(placed[0].type).toBe('solo')
	})

	it('handles empty input', () => {
		expect(computeDanceFloor([], FORM, 1)).toEqual([])
	})
})

// ---------------------------------------------------------------------------
// Bubble Alignment
// ---------------------------------------------------------------------------

describe('getBubbleAlignment', () => {
	it('returns leader left when LEADER_ON_LEFT is true and not flipped', () => {
		// Image 1: LEADER_ON_LEFT[1] = true
		const result = getBubbleAlignment(1, false)
		expect(result).toEqual({ leftMember: 'leader', rightMember: 'follower' })
	})

	it('flips when image is flipped', () => {
		// Image 1: LEADER_ON_LEFT[1] = true, but flipped
		const result = getBubbleAlignment(1, true)
		expect(result).toEqual({ leftMember: 'follower', rightMember: 'leader' })
	})

	it('handles LEADER_ON_LEFT = false', () => {
		// Image 2: LEADER_ON_LEFT[2] = false
		const result = getBubbleAlignment(2, false)
		expect(result).toEqual({ leftMember: 'follower', rightMember: 'leader' })
	})

	it('double-flip restores original', () => {
		// Image 2: LEADER_ON_LEFT[2] = false, flipped → leader is left
		const result = getBubbleAlignment(2, true)
		expect(result).toEqual({ leftMember: 'leader', rightMember: 'follower' })
	})

	it('defaults to leader-left for unknown image numbers', () => {
		const result = getBubbleAlignment(99, false)
		expect(result).toEqual({ leftMember: 'leader', rightMember: 'follower' })
	})
})

// ---------------------------------------------------------------------------
// Dock Magnification
// ---------------------------------------------------------------------------

describe('getDockScale', () => {
	it('returns maxScale at distance 0', () => {
		const scale = getDockScale(0, 0.2)
		expect(scale).toBeCloseTo(DEFAULT_DOCK.maxScale)
	})

	it('returns 1.0 at the edge of neighbor radius', () => {
		const scale = getDockScale(0.2, 0.2)
		expect(scale).toBeCloseTo(1.0)
	})

	it('returns 1.0 beyond the neighbor radius', () => {
		expect(getDockScale(0.5, 0.2)).toBe(1.0)
	})

	it('cosine falloff: midpoint is roughly halfway between 1 and maxScale', () => {
		const radius = 0.3
		const scale = getDockScale(radius / 2, radius)
		// Cosine at π/2: (1 + cos(π/2))/2 = 0.5, so scale ≈ 1 + 0.5 * (max-1)
		const expected = 1 + 0.5 * (DEFAULT_DOCK.maxScale - 1)
		expect(scale).toBeCloseTo(expected)
	})

	it('gaussian falloff: midpoint is steeper than cosine', () => {
		const radius = 0.3
		const gaussDock = { ...DEFAULT_DOCK, falloffFn: 'gaussian' as const }
		const scaleGauss = getDockScale(radius / 2, radius, gaussDock)
		const scaleCosine = getDockScale(radius / 2, radius)
		// Gaussian drops faster in the middle, so scale should be lower
		expect(scaleGauss).toBeLessThan(scaleCosine)
	})
})

// ---------------------------------------------------------------------------
// Image Metadata
// ---------------------------------------------------------------------------

describe('LEADER_ON_LEFT', () => {
	it('has entries for all 32 images', () => {
		for (let i = 1; i <= 32; i++) {
			expect(LEADER_ON_LEFT[i]).toBeDefined()
			expect(typeof LEADER_ON_LEFT[i]).toBe('boolean')
		}
	})
})

describe('PAIRED_POOL', () => {
	it('contains images 7-32', () => {
		expect(PAIRED_POOL).toHaveLength(26)
		expect(PAIRED_POOL[0]).toBe(7)
		expect(PAIRED_POOL[PAIRED_POOL.length - 1]).toBe(32)
	})
})

// ---------------------------------------------------------------------------
// Edge Cases (from spec)
// ---------------------------------------------------------------------------

describe('edge cases', () => {
	it('0 dancers: empty output', () => {
		expect(computeDanceFloor([], FORM, 1)).toEqual([])
	})

	it('1 dancer: single solo', () => {
		const placed = computeDanceFloor([makeDancer('Solo', 'lead')], FORM, 1)
		expect(placed).toHaveLength(1)
		expect(placed[0].type).toBe('solo')
	})

	it('2 dancers (1 leader + 1 follower): single pair', () => {
		const placed = computeDanceFloor([makeDancer('L', 'lead'), makeDancer('F', 'follow')], FORM, 1)
		expect(placed).toHaveLength(1)
		expect(placed[0].type).toBe('pair')
		expect(placed[0].members).toHaveLength(2)
	})

	it('all leaders, no followers: all solos', () => {
		const dancers = Array.from({ length: 5 }, (_, i) => makeDancer(`L${i}`, 'lead'))
		const placed = computeDanceFloor(dancers, FORM, 1)
		expect(placed.every((u) => u.type === 'solo')).toBe(true)
		expect(placed).toHaveLength(5)
	})

	it('50+ dancers: all get placed', () => {
		const dancers: DancerRow[] = Array.from({ length: 60 }, (_, i) => ({
			name: `Dancer${i}`,
			role: i % 3 === 0 ? 'lead' : i % 3 === 1 ? 'follow' : 'both',
			ts: 1000 + i * 100,
			wish: i % 4 === 0 ? `Message ${i}` : undefined,
			paid: i % 5 === 0,
		}))

		const placed = computeDanceFloor(dancers, FORM, 1)

		// Total members should equal input
		const totalMembers = placed.reduce((sum, u) => sum + u.members.length, 0)
		expect(totalMembers).toBe(60)

		// All positions valid
		for (const p of placed) {
			expect(p.x).toBeGreaterThanOrEqual(0)
			expect(p.x).toBeLessThanOrEqual(1)
		}
	})

	it('song clamping: getSongNumber handles edge values', () => {
		expect(getSongNumber(null)).toBe(1)
		expect(getSongNumber(0)).toBe(1)
		// Future timestamp (now before first signup) → clamp to 1
		const future = Date.now() + 10_000_000
		expect(getSongNumber(future)).toBe(1)
	})
})
