<script lang="ts">
	import { onMount, tick } from 'svelte'
	import { SvelteSet } from 'svelte/reactivity'
	import dayjs from 'dayjs'
	import relativeTime from 'dayjs/plugin/relativeTime'
	import isBetween from 'dayjs/plugin/isBetween'
	import utc from 'dayjs/plugin/utc'

	dayjs.extend(relativeTime)
	dayjs.extend(isBetween)
	dayjs.extend(utc)

	import { stringify, assignDancerImages, getDancersFromSheetData } from '$lib/util'

	import StickyHeaderGrid from '$lib/components/StickyHeaderSummaryDetailsGrid.svelte'
	import DancerIcon from '$lib/components/DancerIcon.svelte'
	import DanceParty from '$lib/components/DanceParty.svelte'
	import { m } from '$lib/paraglide/messages.js'

	interface Props {
		data: any
		title?: string
	}

	let { data, title = '' }: Props = $props()

	let extra = $derived(data.extra)
	let columns = $derived(data.columns)
	let rows = $derived(data.rows)

	let { dancers, firstSignupTs } = $derived(getDancersFromSheetData(rows, extra))
	let imageNums = $derived(assignDancerImages(title, dancers))

	let wrapperEl = $state<HTMLElement>()

	// Column rotation/pinning state (only for default table mode)
	let pinnedIndices = new SvelteSet([0]) // Pin first column (#) by default
	let rotationStart = $state(0)

	// Compute display order: pinned columns first (in original order), then non-pinned rotated
	let displayOrder = $derived.by(() => {
		const pinned = [...pinnedIndices].sort((a, b) => a - b)
		const nonPinned = columns
			.map((_: any, i: number) => i)
			.filter((i: number) => !pinnedIndices.has(i))
		// Rotate non-pinned array so rotationStart is first
		const start = rotationStart % (nonPinned.length || 1)
		const rotated = [...nonPinned.slice(start), ...nonPinned.slice(0, start)]
		return [...pinned, ...rotated]
	})

	let displayColumns = $derived(displayOrder.map((i: number) => columns[i]))
	let displayRows = $derived(rows.map((row: any[]) => displayOrder.map((i: number) => row[i])))
	let firstNonPinnedDi = $derived(displayOrder.findIndex((i: number) => !pinnedIndices.has(i)))

	const FLIP_DURATION = 1000 // ms

	function snapshotHeaderPositions(): Map<number, number> {
		const positions = new Map<number, number>()
		if (!wrapperEl) return positions
		const headers = wrapperEl.querySelectorAll('grid-table > gh') as NodeListOf<HTMLElement>
		headers.forEach((gh, di) => {
			positions.set(displayOrder[di], gh.getBoundingClientRect().left)
		})
		return positions
	}

	async function flipColumns(applyChange: () => void, retreating: Set<number>) {
		const before = snapshotHeaderPositions()

		applyChange()

		// Wait for Svelte to update the DOM
		await tick()

		// Compute deltas per original column index
		const deltas = new Map<number, number>()
		const headers = wrapperEl?.querySelectorAll('grid-table > gh') as NodeListOf<HTMLElement>
		if (headers) {
			headers.forEach((gh, di) => {
				const origIndex = displayOrder[di]
				const oldLeft = before.get(origIndex)
				if (oldLeft !== undefined) {
					const delta = oldLeft - gh.getBoundingClientRect().left
					if (Math.abs(delta) > 1) {
						deltas.set(origIndex, delta)
					}
				}
			})
		}

		if (deltas.size === 0) return

		// Collect all non-pinned cells, grouped by their original column index
		const gridTable = wrapperEl?.querySelector('grid-table') as HTMLElement
		if (!gridTable) return

		const cells = gridTable.querySelectorAll('gh, gd') as NodeListOf<HTMLElement>
		const numCols = displayOrder.length

		// Apply FLIP: set transform to old position (Invert), then animate to 0 (Play)
		cells.forEach((cell, i) => {
			const colIndex = i % numCols
			const origIndex = displayOrder[colIndex]
			const delta = deltas.get(origIndex)
			if (delta === undefined || pinnedIndices.has(origIndex)) return

			// Immediately position at old location
			cell.style.transform = `translateX(${delta}px)`
			cell.style.transition = 'none'
			// Nearly hide retreating columns so focus is on incoming ones
			if (retreating.has(origIndex)) {
				cell.style.opacity = '0.15'
			}
		})

		// Force layout so the browser registers the initial transform
		void gridTable.offsetHeight

		// Now animate to final position
		requestAnimationFrame(() => {
			cells.forEach((cell, i) => {
				const colIndex = i % numCols
				const origIndex = displayOrder[colIndex]
				const delta = deltas.get(origIndex)
				if (delta === undefined || pinnedIndices.has(origIndex)) return

				// Retreating columns: stay hidden during move, fade in at the end
				const isRetreating = retreating.has(origIndex)
				cell.style.transition = isRetreating
					? `transform ${FLIP_DURATION}ms cubic-bezier(0.25, 0.1, 0.25, 1), opacity ${FLIP_DURATION * 0.4}ms ease ${FLIP_DURATION * 0.6}ms`
					: `transform ${FLIP_DURATION}ms cubic-bezier(0.25, 0.1, 0.25, 1)`
				cell.style.transform = ''
				if (isRetreating) cell.style.opacity = ''
			})

			// Clean up inline styles after animation
			setTimeout(() => {
				cells.forEach((cell) => {
					cell.style.transition = ''
					cell.style.transform = ''
					cell.style.opacity = ''
				})
			}, FLIP_DURATION + 50)
		})
	}

	function handleHeaderTap(displayIndex: number) {
		const originalIndex = displayOrder[displayIndex]
		if (pinnedIndices.has(originalIndex)) return // Don't rotate pinned columns

		const nonPinnedDisplay = displayOrder.filter((i: number) => !pinnedIndices.has(i))
		const posInNonPinned = nonPinnedDisplay.indexOf(originalIndex)

		// Columns before the tapped one are retreating to the back
		const retreating = new Set(nonPinnedDisplay.slice(0, posInNonPinned === 0 ? 1 : posInNonPinned))

		flipColumns(() => {
			if (posInNonPinned === 0) {
				rotationStart = (rotationStart + 1) % (nonPinnedDisplay.length || 1)
			} else {
				const allNonPinned = columns
					.map((_: any, i: number) => i)
					.filter((i: number) => !pinnedIndices.has(i))
				const originalPos = allNonPinned.indexOf(originalIndex)
				rotationStart = originalPos
			}
		}, retreating)
	}

	function togglePin(displayIndex: number) {
		const originalIndex = displayOrder[displayIndex]
		if (pinnedIndices.has(originalIndex)) {
			pinnedIndices.delete(originalIndex)
		} else {
			pinnedIndices.add(originalIndex)
		}
		// Reset rotation when pinning changes to avoid confusing jumps
		rotationStart = 0
	}

	onMount(() => {
		if (!wrapperEl || extra.type) return // only for default table mode
		const gridTable = wrapperEl.querySelector('grid-table') as HTMLElement
		const article = wrapperEl.closest('d-article') as HTMLElement
		if (!gridTable || !article) return

		// Set immediately to avoid transition flash on initial load
		article.style.setProperty('--table-width', `${gridTable.scrollWidth}px`)

		const ro = new ResizeObserver(() => {
			article.style.setProperty('--table-width', `${gridTable.scrollWidth}px`)
		})
		ro.observe(gridTable)

		return () => {
			ro.disconnect()
			article.style.removeProperty('--table-width')
		}
	})
</script>

{#snippet rowDetails(_row: string | any[], r: any)}
	{@const row = rows[r]}
	{@const skippedColumns = 1}
	<dl>
		{#each row.slice(skippedColumns) as cell, ci (ci)}
			<dt>{columns[ci + skippedColumns]?.title}</dt>
			<dd>
				{cell.value}
				{#if cell.ts}({dayjs().utc().to(cell.ts)}){/if}
			</dd>
		{/each}
	</dl>
{/snippet}

<div class={extra.type || 'default-table'} bind:this={wrapperEl}>
	{#if !extra.type}
		{@const gridTemplateColumns = `max-content repeat(${displayColumns.length - 1}, minmax(120px, max-content))`}
		<StickyHeaderGrid
			{gridTemplateColumns}
			data={{ columns: displayColumns, rows: displayRows }}
			{rowDetails}
		>
			{#snippet header()}
				{#each displayColumns as column, di (displayOrder[di])}
					{@const isPinned = pinnedIndices.has(displayOrder[di])}
					<gh class={{ pinned: isPinned }} onclick={() => handleHeaderTap(di)}>
						{#if !isPinned}
							<span class="rotate-chevron" class:first-visible={di === firstNonPinnedDi}
								>{'\u21A9\uFE0E'}</span
							>
						{/if}
						<span class="col-title">{column.title}</span>
						<button
							class="pin-toggle"
							onclick={(e) => {
								e.stopPropagation()
								togglePin(di)
							}}
							title={pinnedIndices.has(displayOrder[di]) ? 'Unpin column' : 'Pin column'}
						>
							<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"
								><path
									d="M4.146.146A.5.5 0 0 1 4.5 0h7a.5.5 0 0 1 .5.5c0 .68-.342 1.174-.646 1.479-.126.125-.25.224-.354.298v4.431l.078.048c.203.127.476.314.751.555C12.36 7.775 13 8.527 13 9.5a.5.5 0 0 1-.5.5h-4v4.5a.5.5 0 0 1-1 0V10h-4A.5.5 0 0 1 3 9.5c0-.973.64-1.725 1.17-2.189A6 6 0 0 1 5 6.708V2.277a3 3 0 0 1-.354-.298C4.342 1.674 4 1.179 4 .5a.5.5 0 0 1 .146-.354"
								/></svg
							>
						</button>
					</gh>
				{/each}
			{/snippet}

			{#snippet rowSummary(_columns, _row, r, makeToggleDetails)}
				{@const row = displayRows[r]}
				{#each displayColumns as { isNumeric }, c (displayOrder[c])}
					{@const render = row?.[c]?.render || ''}
					{@const isPinnedCell = pinnedIndices.has(displayOrder[c])}
					<gd
						class={{
							numeric: isNumeric,
							pinned: isPinnedCell,
						}}
						onclick={makeToggleDetails(r)}
						role="none"
					>
						{@html isNumeric ? render.replace(/^0*/, '<gz>$&</gz>') : render}
					</gd>
				{/each}
			{/snippet}
		</StickyHeaderGrid>
	{:else if extra.type === 'dance-event'}
		<StickyHeaderGrid gridTemplateColumns="1fr" data={{ columns, rows }} {rowDetails}>
			{#snippet header()}
				{@const count = extra.count}
				<gh>
					<span>{m.people_going({ count: count.total })}</span>
					<span
						><DancerIcon role="follow" representative />{count.follows}
						<DancerIcon role="lead" representative />{count.leaders}</span
					>
					<dance-floor-wrap>
						<DanceParty {dancers} formTitle={title} {firstSignupTs} />
					</dance-floor-wrap>
				</gh>
			{/snippet}

			{#snippet rowSummary(_columns, row, r, makeToggleDetails)}
				{@const ci = extra.ci}
				{@const groupIndex = (row as any)._groupIndex ?? -1}
				{@const isGroupMember = (row as any)._isGroupMember === true}
				<gd
					class={{
						'group-alt': groupIndex % 2 === 1,
						'group-member': isGroupMember,
					}}
					onclick={makeToggleDetails(r)}
					role="none"
				>
					<content>
						<fi-index>
							<div>{@html row[0].render.replace(/^0*/, '<gz>$&</gz>')}.</div>
							<div>{row[ci.paid]?.render ? '💰' : ''}</div>
						</fi-index>
						<fi-role>
							<DancerIcon role={dancers[r]?.role ?? 'unknown'} imageNum={imageNums[r]} />
						</fi-role>
						<fi-info>
							<h4>{row[ci.name]?.render}</h4>
							{#if !isGroupMember}
								<div>{row[ci.wish]?.render}</div>
							{/if}
						</fi-info>
					</content>
				</gd>
			{/snippet}
		</StickyHeaderGrid>
	{/if}
</div>

<div hidden>
	<pre>columns = {stringify(columns)}</pre>
	<pre>rows    = {stringify(rows)}</pre>
</div>

<style lang="scss">
	@use 'open-props-scss' as *;

	gh,
	gd {
		padding: $size-2 $size-2;

		&:global(.numeric) {
			font-family: Lato, Helvetica, sans-serif;
			font-feature-settings: 'tnum';
			font-variant-numeric: tabular-nums;
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
		top: calc(min(0px, 2 * 1.5em + var(--app-spacing) / 2 - var(--header-height)));
		background-color: var(--app-card-section-bg);

		// Align items to bottom
		display: flex;
		align-items: flex-end;

		padding-bottom: $size-1;

		font-weight: $font-weight-7;

		border: 2px solid var(--app-muted-border-color);
		border-inline: none;

		cursor: pointer;
		gap: $size-1;

		&.pinned {
			background-color: color-mix(
				in srgb,
				var(--app-card-section-bg) 92%,
				var(--app-accent-color, #6750a4)
			);
		}

		.pin-toggle {
			all: unset;
			cursor: pointer;
			display: inline-flex;
			align-items: center;
			padding: 2px;
			border-radius: 2px;
			opacity: 0.2;
			transition: opacity 0.15s;
			margin-left: auto;
			align-self: flex-end;
			margin-bottom: 0.25em;

			&:hover {
				background: rgba(0, 0, 0, 0.08);
			}
		}

		.rotate-chevron {
			font-size: 1.1em;
			line-height: 1;
			opacity: 0;
			transition: opacity 0.15s;
			user-select: none;
			color: currentColor;
			flex-shrink: 0;
			align-self: flex-end;
			margin-bottom: 0em;

			&.first-visible {
				opacity: 0.3;
			}
		}

		&:hover .pin-toggle {
			opacity: 0.5;
		}

		&:hover .rotate-chevron {
			opacity: 0.5;
		}

		&:hover .rotate-chevron.first-visible {
			opacity: 0.7;
		}

		&.pinned .pin-toggle {
			opacity: 1;
		}
	}

	gd {
		display: block;
		white-space: nowrap;
		overflow: clip;
		text-overflow: ellipsis;

		border-top: 1px solid var(--app-muted-border-color);
	}

	dl {
		display: grid;

		flex-basis: $size-content-3;
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

	.default-table {
		:global(grid-table) {
			width: max-content;
			min-width: $size-content-3;
			margin-inline: auto;
		}
	}

	.dance-event {
		gh {
			grid-column: 1 / -1;
			display: flex;
			flex-wrap: wrap;
			justify-content: center;
			font-size: 188%;

			dance-floor-wrap {
				flex-basis: 100%;
				font-size: initial;
			}
		}

		gd {
			grid-column: 1 / -1;

			&.group-alt {
				background-color: rgba(128, 128, 128, 0.06);
			}

			&.group-member {
				border-top-color: transparent;
			}

			content {
				display: flex;
				column-gap: $size-2;

				margin: auto;

				max-width: $size-content-3;

				fi-index {
					opacity: 0.5;
					text-align: right;
					margin-top: $size-1;
				}

				fi-role {
					margin-left: -0.5em;
				}

				fi-info {
					flex-shrink: 1;

					white-space: wrap;

					h4 {
						margin-top: $size-1;
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
