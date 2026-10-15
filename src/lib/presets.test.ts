import { describe, expect, it } from 'vitest'
import { DOMAIN_PRESETS, PRESETS, resolvePresetName } from './presets'

describe('domain presets', () => {
	it.each(['blues-social', 'slow-sat', 'slow-social'])(
		'does not retain retired %s preset or hostname',
		(name) => {
			expect(PRESETS).not.toHaveProperty(name)
			expect(DOMAIN_PRESETS).not.toHaveProperty(`${name}.leftium.com`)
			expect(resolvePresetName(`${name}.leftium.com`)).toBeNull()
		},
	)

	it.each([
		['btango.com', 'btango'],
		['tangoclass.btango.com', 'btango-class'],
		['tangodj.btango.com', 'btango-dj'],
		['vivimil.com', 'vivimil'],
		['xn--pg3bl5ba.com', 'vivimil'],
		['party.leftium.com', 'party'],
	])('preserves %s as %s', (hostname, name) => {
		expect(resolvePresetName(hostname)).toBe(name)
		expect(PRESETS).toHaveProperty(name)
	})

	it('keeps launcher and unknown-domain fallback behavior', () => {
		expect(resolvePresetName('veneer.leftium.com')).toBeNull()
		expect(resolvePresetName('unknown.leftium.com')).toBeNull()
	})
})
