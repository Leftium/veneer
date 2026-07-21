import { describe, expect, it } from 'vitest'
import {
	extractGoogleFormsImageUrls,
	googleImageUrl,
	isGoogleFormsImageUrl,
} from './google-image-url'

describe('Google image URLs', () => {
	it('accepts HTTPS googleusercontent.com subdomains', () => {
		expect(isGoogleFormsImageUrl('https://lh7-rt.googleusercontent.com/formsz/image=w1200')).toBe(
			true,
		)
	})

	it('accepts the Google Forms image endpoint on docs.google.com', () => {
		expect(isGoogleFormsImageUrl('https://docs.google.com/forms-images-rt/image-id=w1536')).toBe(
			true,
		)
	})

	it.each([
		'http://lh3.googleusercontent.com/formsz/image',
		'https://googleusercontent.com.example.com/image',
		'https://uploads.googleusercontent.com/formsz/image',
		'https://lh3.googleusercontent.com/not-a-form/image',
		'https://docs.google.com/document/d/private-document',
		'https://docs.google.com/forms-images-rt-evil/image',
		'https://example.com/?next=googleusercontent.com/image',
		'not a URL',
	])('rejects unsupported URL %s', (url) => {
		expect(isGoogleFormsImageUrl(url)).toBe(false)
	})

	it('extracts old and new Form image URLs without unrelated images', () => {
		const oldUrl = 'https://lh3.googleusercontent.com/formsz/old=image&amp;crop=1'
		const newUrl = 'https://docs.google.com/forms-images-rt/new=image'
		const html = [
			`<img src="${oldUrl}">`,
			`<img class="question" src='${newUrl}'>`,
			'<img src="https://docs.google.com/document/d/private">',
		].join('')

		expect(extractGoogleFormsImageUrls(html)).toEqual([oldUrl.replace('&amp;', '&'), newUrl])
	})

	it('builds relative and absolute proxy URLs without changing other images', () => {
		const source = 'https://lh3.googleusercontent.com/formsz/image=w800'
		const path = `/api/image-proxy?url=${encodeURIComponent(source)}`

		expect(googleImageUrl(source)).toBe(path)
		expect(googleImageUrl(source, 'https://btango.com')).toBe(`https://btango.com${path}`)
		expect(googleImageUrl('/dance_night.gif')).toBe('/dance_night.gif')
	})
})
