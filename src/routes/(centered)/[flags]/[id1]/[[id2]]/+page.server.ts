import { gg } from '@leftium/gg'

import { err, ok } from 'neverthrow'
import * as linkify from 'linkifyjs'

import { m } from '$lib/paraglide/messages.js'

import { getGoogleDocumentId } from '$lib/google-document-util/url-id.js'
import { stripHidden } from '$lib/google-document-util/google-sheets.js'
import type { ResultGoogleForm, ResultGoogleSheet } from '$lib/google-document-util/types'
import { fetchWithDocumentId } from '$lib/google-document-util/fetch-document-with-id'
import { fail } from '@sveltejs/kit'

export const load = async ({ params, url }) => {
	// URL params that control inclusion of sheet data hidden by user:
	const allCols = url.searchParams.has('allcols')
	const allRows = url.searchParams.has('allrows')

	const skipSheetIdScan = url.searchParams.has('skipsheetidscan')

	// prettier-ignore
	const TABS: Record<string, [number, string, string]> ={
        info: [0b0001, 'ℹ️', m.info()],
        form: [0b0010, '✍', m.form()], 
        list: [0b0100, '📋', m.list()],
        raw:  [0b1000, '🔧', 'RAW'], 
        dev:  [0b1000, '🔧', m.dev()],
    }

	const flags = Number(params.flags)

	const warnings = []

	const numTabs = flags.toString(2).replace(/0/g, '').length

	let title = ''
	let info = ''
	let footers: string[] = []

	let form: ResultGoogleForm = err({ message: `Initial form` })
	let sheet: ResultGoogleSheet = err({ message: `Initial sheet` })

	const [document1, document2] = await Promise.all([
		fetchWithDocumentId(params.id1),
		fetchWithDocumentId(params.id2),
	])

	if (document1.isErr()) {
		if (!document1.error.type) {
			form = document1 as ResultGoogleForm
			sheet = document1 as ResultGoogleSheet
		}
		form = (document1.error.type === 'form' ? document1 : document2) as ResultGoogleForm
		sheet = (document1.error.type === 'sheet' ? document1 : document2) as ResultGoogleSheet
	} else {
		form = (document1.value.type === 'form' ? document1 : document2) as ResultGoogleForm
		sheet = (document1.value.type === 'sheet' ? document1 : document2) as ResultGoogleSheet

		if (form.isOk()) {
			// Set info to markdown of initial non-question fields.
			let skippedFirstTitle = false
			let infoAndFooters = form.value.fields
				.slice(0, form.value.firstInput === -1 ? undefined : form.value.firstInput)
				.map((f) => {
					let s = ''
					function add(t: string | null, prefix = '') {
						if (t) {
							s += `${prefix}${t}\n`
						}
					}
					if (f.type === 'TITLE_AND_DESCRIPTION') {
						if (!skippedFirstTitle) {
							skippedFirstTitle = true
						} else {
							add(f.title, '# ')
						}
						add(f.description)
					} else if (f.type === 'IMAGE') {
						add(f.title, '# ')
						add(`![](${f.imgUrl?.replace(/=w\d+$/i, '')})`)
					}
					return s
				})
				.join('\n')
				.split(/^={3,}\s*(?<header>.*?)\s*={3,}$/m)

			if (params.id1 === 'g.r6eRUz2U9uf5oVFn6') {
				infoAndFooters = `
날짜
~ 9월 14일 일요일

파티 시간
~ 오후 6:30~9:30

장소
~ 오뜨라 (탱고바)
~ 서울 마포구 서교동 355-34 지하1층
~ 홍대역 9번 출구
 
🎧DJ
~ 6:30~8:00 **쵸리**
~ 8:00~9:30 **애쉬**

신청: https://forms.gle/r6eRUz2U9uf5oVFn6
신청확인: https://docs.google.com/spreadsheets/d/13E_wsbrKLEsuV-eDaTKl0a967EdpYgcZrXH0Gq_KK3g

![](https://lh7-rt.googleusercontent.com/formsz/AN7BsVCujzabFCv4aR685RcomoGklEO_iW2fJLnCSJckWWaF8CM51NMyw4F5FcIAc9qwgtMxrVMcDsxHmUSLyrGe1dy6yEUTk60Qvn3ZHdjPAMhv6NUE6918E8n0ieFjfZI4UfMpTLEvHPo_RGXZh8FQes5EpA=w740?key=BkxdXg6TnCgrK9mo7cW42g)



# 💸 비비블 입장료 💸
| -: |
|🐣 1.5만원 | 9월 3일 수요일 밤12시까지

|🐦 1.8만원 | 9월 10일 수요일 밤12시까지 신청+입금시

|🐌 2.0만원 | 9월 11일 목요일부터~14일 일요일 (현장결제 포함)

> 카톡 친구 송금 (vivian830)
> 카카오뱅크 3333278665234 (윤시은)

> 😉 블파 최초로 선입금 후 못오면 
🔹️ 환불 또는 이월 해드리지만 (카톡으로 연락)
🔹️ 양도 하실분 먼저 찾아보길 간곡히 부탁드려요💕 


=== 비비블 Links ===

Home
~ ${url.origin}

오시는 길
~ https://forms.gle/U3LdatNnxxW7yfAb6

비비블 수칙
~ https://forms.gle/1Maayp86fcwkJKeVA
`.split(/^={3,}\s*(?<header>.*?)\s*={3,}$/m)
			}

			footers = infoAndFooters
			info = footers.shift() || 'EMPTY'

			footers = footers.reduce((result, footer, i, footers) => {
				if (i % 2 === 0) {
					const header = footer ? `# ${footer}` : ''
					const body = footers[i + 1] || ''
					result.push(`${header}\n<div>${body}</div>`)
				}
				return result
			}, [] as string[])

			// Remove info fields from form.
			form.value.fields = form.value.fields.filter((f) => f.inputIndex)
		}

		// Detect and load sheet if necessary.
		if (
			!skipSheetIdScan &&
			form.isOk() &&
			form.value.firstInput !== -1 &&
			sheet.isErr() &&
			!sheet.error.documentId
		) {
			const links = linkify.find(info).filter((link) => !/googleusercontent.com/.test(link.href))

			// Reorder array to minimize expected number of url fetches:
			// Move first link (usually links to form itself) to 2nd slot.
			const shifted = links.shift()
			if (shifted) {
				links.splice(1, 0, shifted)
			}

			let numLinksChecked = 0
			for (const link of links) {
				gg(`Smart sheet ID scan #${++numLinksChecked}: ${link.href}`)
				const googleDocumentId = await getGoogleDocumentId(link.href)
				if (googleDocumentId.isOk() && googleDocumentId.value.documentId[0] === 's') {
					const document = await fetchWithDocumentId(googleDocumentId.value.documentId)
					if (document.isOk() && document.value.type === 'sheet') {
						sheet = document as ResultGoogleSheet
						break
					}
				}
			}
			if (numLinksChecked > 2) {
				warnings.push({
					message: `Smart sheet ID required many network requests. (Fetched ${numLinksChecked} links.)`,
				})
			}
		}

		title = form.isOk() ? form.value.title : sheet.isOk() ? sheet.value.title : ''

		if (sheet.isOk()) {
			sheet = ok(stripHidden(sheet.value, allCols, allRows))
		}
	}

	type TabsKey = keyof typeof TABS
	const navTabs = Object.entries(TABS).reduce(
		(acc, [hash, [bit, icon, name]]) => {
			const error =
				((hash === 'info' || hash === 'form') && form.isErr()) ||
				(hash === 'list' && sheet.isErr()) ||
				(hash === 'dev' && !!warnings.length)

			acc[hash] = {
				name,
				icon: (flags & bit) > 0 ? icon : '',
				error,
			}
			return acc
		},
		{} as Record<TabsKey, { name: string; icon: string; error: boolean }>,
	)

	return {
		warnings,
		info,
		footers,
		navTabs,
		numTabs,
		skipSheetIdScan,
		title,
		form,
		sheet,
	}
}

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData()

		const documentId = formData.get('documentId')?.toString()

		if (!documentId) {
			return fail(555, {
				status: 555,
				statusText: `No documentId: <${documentId}>`,
			})
		}

		const fetchUrl = `https://docs.google.com/forms/d/e/${documentId.slice(2)}/formResponse`
		const resp = await fetch(fetchUrl, {
			method: 'POST',
			body: formData,
		})

		if (resp.status !== 200) {
			return fail(resp.status, {
				status: resp.status,
				statusText: resp.statusText,
			})
		}

		return { success: true }
	},
}
