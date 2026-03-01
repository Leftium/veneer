<script lang="ts">
	import type { Snippet } from 'svelte'
	import StickyHeaderGrid from '$lib/components/StickyHeaderSummaryDetailsGrid.svelte'

	/** Format "8:47 PM" -> "8:47p", "10:34 AM" -> "10:34a" */
	function formatPlayTime(value: string): string {
		const m = value.match(/^(\d{1,2}:\d{2})\s*(AM|PM)$/i)
		if (!m) return value
		return m[1] + m[2][0].toLowerCase()
	}

	interface Props {
		data: any
		rowDetails: Snippet<[string | any[], number]>
	}

	let { data, rowDetails }: Props = $props()

	let extra = $derived(data.extra)
	let columns = $derived(data.columns)
	let rows = $derived(data.rows)
	let ci = $derived(extra.ci)
</script>

<div class="playlist">
	<StickyHeaderGrid gridTemplateColumns="1fr" data={{ columns, rows }} {rowDetails}>
		{#snippet header()}
			<gh>
				<span class="playlist-stats">
					{extra.trackCount} tracks{#if extra.totalDuration}
						&middot; {extra.totalDuration}{/if}
				</span>
			</gh>
		{/snippet}

		{#snippet rowSummary(_columns, row, r, makeToggleDetails)}
			<gd onclick={makeToggleDetails(r)} role="none">
				<pl-content>
					<pl-index>{@html row[0].render.replace(/^0*/, '<gz>$&</gz>')}.</pl-index>
					<pl-info>
						<pl-line1>
							{#if ci.length !== -1 && row[ci.length]?.render}
								<pl-length>{row[ci.length].render}</pl-length>
							{/if}
							<pl-title>
								<a
									href="https://www.youtube.com/results?search_query={encodeURIComponent(
										(row[ci.artist]?.value || '') + ' ' + (row[ci.title]?.value || ''),
									)}"
									target="_blank"
									rel="noopener noreferrer"
									onclick={(e) => e.stopPropagation()}
								>
									{row[ci.title]?.render}{#if ci.remix !== -1 && row[ci.remix]?.render}
										<pl-remix>({row[ci.remix].render})</pl-remix>{/if}
								</a>
							</pl-title>
						</pl-line1>
						<pl-line2>
							{#if ci.bpm !== -1 && row[ci.bpm]?.value}
								<pl-bpm>{row[ci.bpm].value}</pl-bpm>
							{/if}
							<pl-artist>{row[ci.artist]?.render}</pl-artist>
							{#if ci.playTime !== -1 && row[ci.playTime]?.value}
								<pl-playtime>{formatPlayTime(row[ci.playTime].value)}</pl-playtime>
							{/if}
						</pl-line2>
					</pl-info>
				</pl-content>
			</gd>
		{/snippet}
	</StickyHeaderGrid>
</div>

<style lang="scss">
	@use '$lib/styles/sheet-base' as sheet;
	@use 'open-props-scss' as *;

	@include sheet.base;

	.playlist {
		gh {
			grid-column: 1 / -1;
			display: flex;
			justify-content: center;
			font-size: 110%;

			.playlist-stats {
				opacity: 0.6;
			}
		}

		gd {
			grid-column: 1 / -1;
			border-top: 1px solid var(--app-muted-border-color);

			pl-content {
				display: flex;
				column-gap: $size-2;
				margin: auto;
				max-width: $size-content-3;
				padding-block: $size-1;

				pl-index {
					opacity: 0.35;
					text-align: right;
					min-width: 2.5ch;
					flex-shrink: 0;
					padding-top: $size-1;
				}

				pl-info {
					flex: 1;
					min-width: 0;
					display: flex;
					flex-direction: column;
					gap: 0;

					pl-line1,
					pl-line2 {
						display: flex;
						align-items: baseline;
						gap: $size-2;
						min-width: 0;
					}

					pl-length,
					pl-bpm {
						flex-shrink: 0;
						min-width: 4.5ch;
						text-align: right;
						opacity: 0.4;
						font-family: Lato, Helvetica, sans-serif;
						font-feature-settings: 'tnum';
						font-variant-numeric: tabular-nums;
						font-size: 0.9em;
					}

					pl-title {
						font-weight: $font-weight-7;
						white-space: nowrap;
						overflow: hidden;
						text-overflow: ellipsis;
						min-width: 0;
						flex: 1;

						a {
							color: inherit;
							text-decoration: underline;
							text-decoration-color: color-mix(in srgb, currentColor 15%, transparent);

							&:hover {
								text-decoration-color: currentColor;
							}
						}

						pl-remix {
							font-weight: $font-weight-4;
							opacity: 0.5;
							font-size: 0.9em;
						}
					}

					pl-artist {
						white-space: nowrap;
						overflow: hidden;
						text-overflow: ellipsis;
						min-width: 0;
						flex: 1;
					}

					pl-playtime {
						flex-shrink: 0;
						opacity: 0.4;
						font-size: 0.85em;
						margin-left: auto;
						font-family: Lato, Helvetica, sans-serif;
						font-feature-settings: 'tnum';
						font-variant-numeric: tabular-nums;
					}
				}
			}
		}
	}
</style>
