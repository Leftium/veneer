<script lang="ts">
	import type { Snippet } from 'svelte'
	import { assignDancerImages, getDancersFromSheetData } from '$lib/util'
	import StickyHeaderGrid from '$lib/components/StickyHeaderSummaryDetailsGrid.svelte'
	import DancerIcon from '$lib/components/DancerIcon.svelte'
	import DanceParty from '$lib/components/DanceParty.svelte'
	import { m } from '$lib/paraglide/messages.js'

	interface Props {
		data: any
		title?: string
		rowDetails: Snippet<[string | any[], number]>
	}

	let { data, title = '', rowDetails }: Props = $props()

	let extra = $derived(data.extra)
	let columns = $derived(data.columns)
	let rows = $derived(data.rows)

	let { dancers, firstSignupTs } = $derived(getDancersFromSheetData(rows, extra))
	let imageNums = $derived(assignDancerImages(title, dancers))
</script>

<div class="dance-event">
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
</div>

<style lang="scss">
	@use '$lib/styles/sheet-base' as sheet;
	@use 'open-props-scss' as *;

	@include sheet.base;

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
