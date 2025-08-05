<script lang="ts">
	import dayjs from 'dayjs'
	import relativeTime from 'dayjs/plugin/relativeTime'
	import isBetween from 'dayjs/plugin/isBetween'
	import utc from 'dayjs/plugin/utc'

	dayjs.extend(relativeTime)
	dayjs.extend(isBetween)
	dayjs.extend(utc)

	import { gg } from '@leftium/gg'
	import { stringify } from '$lib/util'

	import type { GoogleSheet } from '$lib/google-document-util/types'

	import StickyHeaderGrid from '$lib/components/StickyHeaderSummaryDetailsGrid.svelte'

	interface Props {
		googleSheet: GoogleSheet
		onToggle?: () => void
	}

	let { googleSheet, onToggle }: Props = $props()

	const REGEX_DANCE_ROLE = /role|역할|리드|리더/i
	const REGEX_DANCE_NAME = /name|닉네임/i
	const REGEX_DANCE_WISH = /말씀|한마디/i
	const REGEX_DANCE_PAID = /입금여|입금확/i
	const REGEX_DANCE_LEADER = /lead|리더|리드/i
	const REGEX_DANCE_FOLLOW = /follow|팔뤄|팔로우/i

	const REGEX_NUMERIC = /^[0-9-.,/: ]*$/

	const { type, columns, rows } = $derived.by(() => {
		let type = 'regular'
		const sheetJson = googleSheet
		if (sheetJson.rows) {
			let rows = [...sheetJson.rows]

			// Skip extraneous rows without timestamps.
			// Adjust title row if extra columns are found.
			while (false && !rows[1][0]) {
				rows[0] = Array(Math.max(rows[0].length, rows[1].length))
					.fill(1)
					.map((_, index) => rows[1][index] || rows[0][index])
				rows.splice(1, 1)
			}

			// Remove empty rows:
			rows = rows.filter((row) => row.join(''))

			// Add index column:
			rows = rows.map((row, indexRow) => [indexRow ? `${indexRow}` : '', ...row])

			// Gather column info:
			let columns = rows[0].map((cell) => ({
				title: cell as string,
				type: 'numeric',
				lengthMin: Number.MAX_SAFE_INTEGER,
				lengthMax: 0,
			}))

			rows.shift() // Remove title row

			for (let row of rows) {
				for (let [indexCol, cell] of row.entries()) {
					const valueString = (Array.isArray(cell) ? cell[0] : cell) as string
					const column = columns[indexCol]
					if (column) {
						column.lengthMax = Math.max(column.lengthMax, valueString.length)
						column.lengthMin = Math.min(column.lengthMin, valueString.length)
						if (!REGEX_NUMERIC.test(valueString)) {
							column.type = 'string'
						}
					}
				}
			}

			// Remove empty columns:
			rows = rows.map((row) => {
				return row.filter((cell, indexColumn) => columns[indexColumn]?.lengthMax !== 0)
			})
			columns = columns.filter((cell) => cell?.lengthMax !== 0)

			// Detect special types
			if (
				columns.filter(({ title }) => REGEX_DANCE_NAME.test(title)).length &&
				columns.filter(({ title }) => REGEX_DANCE_ROLE.test(title)).length
			) {
				type = 'dance-event'
			} else if (
				columns.filter(({ title }) => /주소/i.test(title)).length &&
				columns.filter(({ title }) => /면적/i.test(title)).length
			) {
				type = 'real-estate'
			}

			const rowsRender = rows.map((row) => {
				return row.map((cell, indexColumn) => {
					const column = columns[indexColumn]
					const valueString = (Array.isArray(cell) ? cell[0] : cell) as string
					const valueTs = Array.isArray(cell) && cell[1] ? cell[1] : null

					let renderedString = ''

					if (valueTs) {
						const utcjs = dayjs.utc

						// Relative date if within one year:
						if (utcjs(valueTs).isBetween(utcjs().subtract(25, 'd'), utcjs().add(25, 'd'))) {
							renderedString = dayjs().utc().to(valueTs)
						} else {
							renderedString = dayjs.tz(valueTs, googleSheet?.timeZone).format('YYYY-MM-DD')
						}
					} else {
						renderedString =
							column?.type === 'numeric'
								? valueString.padStart(column?.lengthMax, '0')
								: valueString
					}
					if (type === 'dance-event' && /(contact)|(연락)/i.test(column?.title)) {
						return {
							value: valueString.replaceAll(/[0-9]/g, '*'),
							rendered: renderedString.replaceAll(/[0-9]/g, '*'),
						}
					}
					return {
						value: valueString,
						valueTs,
						rendered: renderedString,
					}
				})
			})

			if (type === 'dance-event') {
				rowsRender.reverse()
			}

			return { type, columns, rows: rowsRender }
		}
		return { type, columns: [], rows: [] }
	})

	const danceEventInfo = $derived.by(() => {
		if (type !== 'dance-event') {
			return {
				total: 0,
				follows: 0,
				leaders: 0,
				ci: {
					role: -1,
					name: -1,
					paid: -1,
					wish: -1,
				},
			}
		}

		const ci = {
			role: columns.findIndex((c) => REGEX_DANCE_ROLE.test(c.title)),
			name: columns.findIndex((c) => REGEX_DANCE_NAME.test(c.title)),
			paid: columns.findIndex((c) => REGEX_DANCE_PAID.test(c.title)),
			wish: columns.findIndex((c) => REGEX_DANCE_WISH.test(c.title)),
		}

		const follows = rows.filter((row) => REGEX_DANCE_FOLLOW.test(row[ci.role]?.value)).length
		const leaders = rows.filter((row) => REGEX_DANCE_LEADER.test(row[ci.role]?.value)).length

		return {
			total: rows.length,
			follows,
			leaders,
			ci,
		}
	})
</script>

{#snippet rowDetails(row: string | any[], r: any)}
	{@const skippedColumns = 0}
	<dl>
		{#each row.slice(skippedColumns) as cell, ci}
			<dt>{columns[ci + skippedColumns]?.title}</dt>
			<dd>
				{cell.value}
				{#if cell.valueTs}({dayjs().utc().to(cell.valueTs)}){/if}
			</dd>
		{/each}
	</dl>
{/snippet}

<div class={type}>
	{#if type === 'dance-event'}
		<StickyHeaderGrid gridTemplateColumns="1fr" data={{ columns, rows }} {onToggle} {rowDetails}>
			{#snippet header()}
				<gh>
					<span>{danceEventInfo.total}명 신청</span>
					<span>💃{danceEventInfo.follows} 🕺{danceEventInfo.leaders}</span>
				</gh>
			{/snippet}

			{#snippet rowSummary(columns, row, r, makeToggleDetails)}
				{@const ci = danceEventInfo.ci}
				<gd onclick={makeToggleDetails(r)} role="none">
					<content>
						<fi-index>
							<div>{@html row[0].rendered.replace(/^0*/, '<gz>$&</gz>')}.</div>
							<div>{row[ci.paid]?.rendered ? '💰' : ''}</div>
						</fi-index>
						<fi-role
							>{REGEX_DANCE_LEADER.test(row[ci.role]?.rendered)
								? '🕺'
								: REGEX_DANCE_FOLLOW.test(row[ci.role]?.rendered)
									? '💃'
									: '❓'}
						</fi-role>
						<fi-info>
							<h4>{row[ci.name]?.rendered}</h4>
							<div>{row[ci.wish]?.rendered}</div>
						</fi-info>
					</content>
				</gd>
			{/snippet}
		</StickyHeaderGrid>
	{:else}
		{@const gridTemplateColumns = `auto repeat(${columns.length - 1}, minmax(120px, 1fr))`}
		<StickyHeaderGrid {gridTemplateColumns} data={{ columns, rows }} {onToggle} {rowDetails}>
			{#snippet header()}
				{#each columns as column}
					<gh>{column.title}</gh>
				{/each}
			{/snippet}

			{#snippet rowSummary(columns, row, r, makeToggleDetails)}
				{#each columns as { type }, c}
					{@const rendered = row[c]?.rendered || ''}
					<gd onclick={makeToggleDetails(r)} role="none">
						{@html type === 'numeric' ? rendered.replace(/^0*/, '<gz>$&</gz>') : rendered}
					</gd>
				{/each}
			{/snippet}
		</StickyHeaderGrid>
	{/if}
</div>

<div hidden>
	<pre>type    = {type}</pre>
	<pre>columns = {stringify(columns)}</pre>
	<pre>rows    = {stringify(rows)}</pre>
</div>

<style lang="scss">
	@use 'open-props-scss' as *;

	gh,
	gd {
		padding: $size-2 $size-2;

		.numeric {
			font-family: Lato, sans-serif;
		}

		// Ghost zero: takes up space for alignment but cannot be seen/selected.
		:global(gz) {
			opacity: 0;
			user-select: none;
		}
	}

	gh {
		position: sticky;
		z-index: 100;
		// At most 2 lines of header will become sticky:
		top: calc(min(0px, 2 * 1.5em + var(--pico-spacing) / 2 - var(--header-height)));
		background-color: var(--pico-card-sectioning-background-color);

		// Align items to bottom
		display: flex;
		align-items: flex-end;

		padding-bottom: $size-1;

		font-weight: $font-weight-7;

		border-bottom: 2px solid var(--pico-muted-border-color);
	}

	gd {
		display: block;
		white-space: nowrap;
		overflow: clip;
		text-overflow: ellipsis;

		border-top: 1px solid var(--pico-muted-border-color);
	}

	dl {
		display: grid;

		flex-basis: $size-content-2;
		flex-shrink: 1;

		dt {
			margin-top: $size-2;
			font-weight: bold;
			opacity: 15%;
		}

		dd {
			margin-left: 0;
		}
	}

	.dance-event {
		gh {
			grid-column: 1 / -1;
			display: flex;
			flex-wrap: wrap;
			column-gap: 1rem;

			justify-content: center;
			font-size: 188%;
		}

		gd {
			grid-column: 1 / -1;

			content {
				display: flex;
				column-gap: $size-2;

				margin: auto;

				max-width: $size-content-2;

				fi-index {
					opacity: 0.5;
					text-align: right;
				}

				fi-role {
					font-size: $font-size-6;
				}

				fi-info {
					flex-shrink: 1;

					white-space: wrap;

					h4 {
						margin-bottom: $size-1;
					}

					div {
						opacity: 0.5;
					}
				}
			}
		}
	}
</style>
