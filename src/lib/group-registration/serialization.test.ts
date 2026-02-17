import { describe, it, expect } from 'vitest'
import { serialize, parse, type GroupMember } from './serialization'

// --- serialize ---

describe('serialize', () => {
	it('returns empty string for empty array', () => {
		expect(serialize([])).toBe('')
	})

	it('serializes named members with roles', () => {
		const members: GroupMember[] = [
			{ name: 'Jane Doe', role: 'follower' },
			{ name: 'Kim Park', role: 'leader' },
		]
		expect(serialize(members)).toBe('F:Jane Doe\nL:Kim Park')
	})

	it('serializes "both" role as LF: prefix', () => {
		expect(serialize([{ name: 'Carol', role: 'both' }])).toBe('LF:Carol')
	})

	it('serializes named member with no role (no prefix)', () => {
		expect(serialize([{ name: 'Alice', role: null }])).toBe('Alice')
	})

	it('serializes unnamed member with role as counted syntax', () => {
		expect(serialize([{ name: '', role: 'follower' }])).toBe('1F')
		expect(serialize([{ name: '', role: 'leader' }])).toBe('1L')
		expect(serialize([{ name: '', role: 'both' }])).toBe('1LF')
	})

	it('serializes unnamed member with no role as bare count', () => {
		expect(serialize([{ name: '', role: null }])).toBe('1')
	})

	it('serializes mixed members one per line', () => {
		const members: GroupMember[] = [
			{ name: 'Jane Doe', role: 'follower' },
			{ name: 'Kim Park', role: 'leader' },
			{ name: 'Carol', role: 'both' },
			{ name: '', role: 'leader' },
			{ name: '', role: null },
		]
		expect(serialize(members)).toBe('F:Jane Doe\nL:Kim Park\nLF:Carol\n1L\n1')
	})
})

// --- parse ---

describe('parse', () => {
	it('returns empty array for empty/blank input', () => {
		expect(parse('')).toEqual([])
		expect(parse('   ')).toEqual([])
		expect(parse('\n\n')).toEqual([])
	})

	// Named entries with role prefixes
	it('parses L:Name as leader', () => {
		expect(parse('L:Alice')).toEqual([{ name: 'Alice', role: 'leader' }])
	})

	it('parses F:Name as follower', () => {
		expect(parse('F:Bob')).toEqual([{ name: 'Bob', role: 'follower' }])
	})

	it('parses B:Name as both', () => {
		expect(parse('B:Carol')).toEqual([{ name: 'Carol', role: 'both' }])
	})

	it('parses LF:Name as both (combo prefix)', () => {
		expect(parse('LF:Carol')).toEqual([{ name: 'Carol', role: 'both' }])
	})

	it('parses FL:Name as both (reversed combo)', () => {
		expect(parse('FL:Carol')).toEqual([{ name: 'Carol', role: 'both' }])
	})

	it('parses ㄹF:Name as both (mixed Korean/English)', () => {
		expect(parse('ㄹF:Carol')).toEqual([{ name: 'Carol', role: 'both' }])
	})

	it('parses Korean consonant prefixes', () => {
		expect(parse('ㄹ:수진')).toEqual([{ name: '수진', role: 'leader' }])
		expect(parse('ㅍ:민지')).toEqual([{ name: '민지', role: 'follower' }])
	})

	it('parses case-insensitive prefixes', () => {
		expect(parse('l:Alice')).toEqual([{ name: 'Alice', role: 'leader' }])
		expect(parse('f:Bob')).toEqual([{ name: 'Bob', role: 'follower' }])
		expect(parse('lf:Carol')).toEqual([{ name: 'Carol', role: 'both' }])
		expect(parse('b:Dave')).toEqual([{ name: 'Dave', role: 'both' }])
	})

	// Names without role
	it('parses plain name (no colon) as no role', () => {
		expect(parse('Alice')).toEqual([{ name: 'Alice', role: null }])
	})

	it('parses name starting with L/F/B without colon as plain name', () => {
		expect(parse('Lisa')).toEqual([{ name: 'Lisa', role: null }])
		expect(parse('Frank')).toEqual([{ name: 'Frank', role: null }])
		expect(parse('Bobby')).toEqual([{ name: 'Bobby', role: null }])
	})

	// Names with spaces on their own line (no quoting needed)
	it('parses "F:Jane Doe" on its own line without quotes', () => {
		expect(parse('F:Jane Doe')).toEqual([{ name: 'Jane Doe', role: 'follower' }])
	})

	// Counted role syntax
	it('parses 3F as 3 unnamed followers', () => {
		const result = parse('3F')
		expect(result).toHaveLength(3)
		expect(result).toEqual([
			{ name: '', role: 'follower' },
			{ name: '', role: 'follower' },
			{ name: '', role: 'follower' },
		])
	})

	it('parses 2LF as 2 unnamed both', () => {
		const result = parse('2LF')
		expect(result).toHaveLength(2)
		expect(result[0]).toEqual({ name: '', role: 'both' })
	})

	it('parses 3ㄹ as 3 unnamed leaders', () => {
		const result = parse('3ㄹ')
		expect(result).toHaveLength(3)
		expect(result[0]).toEqual({ name: '', role: 'leader' })
	})

	// Bare count
	it('parses bare number as unnamed members with no role', () => {
		const result = parse('3')
		expect(result).toHaveLength(3)
		expect(result[0]).toEqual({ name: '', role: null })
	})

	// Multiple entries on one line (space-delimited)
	it('parses multiple entries on one line', () => {
		expect(parse('L:Alice F:Bob')).toEqual([
			{ name: 'Alice', role: 'leader' },
			{ name: 'Bob', role: 'follower' },
		])
	})

	it('parses counted entries on one line', () => {
		expect(parse('2l 1F')).toEqual([
			{ name: '', role: 'leader' },
			{ name: '', role: 'leader' },
			{ name: '', role: 'follower' },
		])
	})

	it('parses mixed counted and named on one line', () => {
		expect(parse('3ㄹ 2ㅍ')).toEqual([
			{ name: '', role: 'leader' },
			{ name: '', role: 'leader' },
			{ name: '', role: 'leader' },
			{ name: '', role: 'follower' },
			{ name: '', role: 'follower' },
		])
	})

	// Quoted entries (for names with spaces on a multi-entry line)
	it('parses double-quoted entries on one line', () => {
		expect(parse('"F:Jane Doe" L:Bob')).toEqual([
			{ name: 'Jane Doe', role: 'follower' },
			{ name: 'Bob', role: 'leader' },
		])
	})

	it('parses single-quoted entries on one line', () => {
		expect(parse("'F:Jane Doe' L:Bob")).toEqual([
			{ name: 'Jane Doe', role: 'follower' },
			{ name: 'Bob', role: 'leader' },
		])
	})

	// Newline-delimited (serializer output format)
	it('parses newline-delimited entries', () => {
		const input = 'F:Jane Doe\nL:Kim Park\nLF:Carol\n3ㄹ\n2'
		const result = parse(input)
		expect(result).toEqual([
			{ name: 'Jane Doe', role: 'follower' },
			{ name: 'Kim Park', role: 'leader' },
			{ name: 'Carol', role: 'both' },
			{ name: '', role: 'leader' },
			{ name: '', role: 'leader' },
			{ name: '', role: 'leader' },
			{ name: '', role: null },
			{ name: '', role: null },
		])
	})

	// Whitespace tolerance
	it('tolerates extra blank lines and whitespace', () => {
		const input = '\n  F:Alice  \n\n  L:Bob \n'
		expect(parse(input)).toEqual([
			{ name: 'Alice', role: 'follower' },
			{ name: 'Bob', role: 'leader' },
		])
	})

	// Unrecognised prefix — treated as plain name
	it('treats unrecognised prefix before colon as plain name', () => {
		expect(parse('X:Charlie')).toEqual([{ name: 'X:Charlie', role: null }])
	})
})

// --- Round-trip ---

describe('round-trip (serialize → parse)', () => {
	it('round-trips named members with roles', () => {
		const members: GroupMember[] = [
			{ name: 'Jane', role: 'follower' },
			{ name: 'Bob', role: 'leader' },
			{ name: 'Carol', role: 'both' },
			{ name: 'Dave', role: null },
		]
		expect(parse(serialize(members))).toEqual(members)
	})

	it('round-trips unnamed members', () => {
		const members: GroupMember[] = [
			{ name: '', role: 'follower' },
			{ name: '', role: null },
		]
		const serialized = serialize(members)
		const parsed = parse(serialized)
		expect(parsed).toEqual(members)
	})
})
