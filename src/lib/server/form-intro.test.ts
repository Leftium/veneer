import { describe, expect, it } from 'vitest'
import { isOk } from 'wellcrafted/result'
import { adjustGoogleFormData, parseGoogleForm } from '#lib/google-document-util/google-form.js'
import { extractFormIntro } from './form-intro'

function intro(description: string) {
	const source = [null, [description, [], null, null, null, null, null, null, 'Event']]
	const parsed = parseGoogleForm(`FB_PUBLIC_LOAD_DATA_ = ${JSON.stringify(source)};`)
	if (!isOk(parsed)) throw new Error('invalid fixture')
	return extractFormIntro(adjustGoogleFormData(parsed.data))
}

describe('form intro footer delimiters', () => {
	it.each(['===', '======', '====================', '===   ===', '===\t==='])(
		'keeps decorative divider %j between Korean and English in Info',
		(divider) => {
			const description = `한국어 안내\n${divider}\nEnglish information`
			const result = intro(description)
			expect(result.info).toBe(`${description}\n`)
			expect(result.footers).toEqual([])
			expect(result.infoText).toBe(description)
		},
	)

	it('does not combine separate divider lines into a named footer', () => {
		const description = '한국어 안내\n===\nEnglish information\n===\nMore information'
		expect(intro(description)).toMatchObject({
			info: `${description}\n`,
			footers: [],
			infoText: description,
		})
	})

	it.each(['=== Venue ===', '===Venue===', '=====\t Venue \t=====', '=== Venue ===  '])(
		'keeps named footer %j working with surrounding whitespace',
		(delimiter) => {
			const description = `Info\n${delimiter}\nHall A\n=== Links ===\nhttps://example.test`
			expect(intro(description)).toMatchObject({
				info: 'Info\n',
				footers: ['# Venue\n<div>\nHall A\n</div>', '# Links\n<div>\nhttps://example.test\n</div>'],
				infoText: description,
			})
		},
	)

	it('preserves decorative dividers before and inside a named footer', () => {
		const description = '한국어 안내\n====================\nEnglish information'
		const footer = '\nHall A\n===\nDirections\n'
		expect(intro(`${description}\n=== Venue ===${footer}`)).toMatchObject({
			info: `${description}\n`,
			footers: [`# Venue\n<div>${footer}\n</div>`],
		})
	})
})
