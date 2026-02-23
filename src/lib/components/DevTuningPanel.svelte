<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte'
	import type { DancePartyConfig } from '$lib/dance-party'
	import { DEFAULT_WEIGHTS, DEFAULT_LAYOUT, DEFAULT_DOCK } from '$lib/dance-party'
	import type { DancerRow } from '$lib/util'

	interface Props {
		config: DancePartyConfig
		songNumber: number
		maxSong: number
		viewHeightMultiplier?: number
		viewMarginTop?: number
		viewAnchorPercent?: number
		viewBubbleHeightFraction?: number
		onchange: (config: DancePartyConfig, songNumber: number) => void
		onviewchange?: (
			heightMultiplier: number,
			marginTop: number,
			anchorPercent: number,
			bubbleHeightFraction: number,
		) => void
		ondancers?: (dancers: DancerRow[] | null) => void
	}

	let {
		config,
		songNumber,
		maxSong,
		viewHeightMultiplier: initHeightMult = 0.8,
		viewMarginTop: initMarginTop = -36,
		viewAnchorPercent: initAnchorPct = 0,
		viewBubbleHeightFraction: initBubbleHF = 1.0,
		onchange,
		onviewchange,
		ondancers,
	}: Props = $props()

	const STORAGE_KEY = 'dance-party-dev'

	// --- Local state for each tunable parameter ---
	// Initialize from defaults; onMount will override from sessionStorage or prop.
	// Priority weights
	let hasMessage = $state(DEFAULT_WEIGHTS.hasMessage)
	let hasPaid = $state(DEFAULT_WEIGHTS.hasPaid)
	let earlySignup = $state(DEFAULT_WEIGHTS.earlySignup)
	let jitterWeight = $state(DEFAULT_WEIGHTS.jitterWeight)

	// Layout
	let centerBiasMax = $state(DEFAULT_LAYOUT.centerBiasMax)
	let verticalJitter = $state(DEFAULT_LAYOUT.verticalJitter)
	let soloAffinity = $state(DEFAULT_LAYOUT.soloAffinity)
	let messageBalanceRate = $state(DEFAULT_LAYOUT.messageBalanceRate)
	let minSpacing = $state(DEFAULT_LAYOUT.minSpacing)

	// Dock
	let dockMaxScale = $state(DEFAULT_DOCK.maxScale)
	let neighborCount = $state(DEFAULT_DOCK.neighborCount)
	let falloffFn: 'cosine' | 'gaussian' = $state(DEFAULT_DOCK.falloffFn)
	let baseIconHeight = $state(DEFAULT_DOCK.baseIconHeight)
	let magnifiedSpacing = $state(DEFAULT_DOCK.magnifiedSpacing)

	// Song
	let localSongNumber = $state(1)

	// View layout
	let heightMultiplier = $state(0.8)
	let marginTop = $state(-36)
	let anchorPercent = $state(0)
	let bubbleHeightFraction = $state(1.0)

	// Synthetic dancers
	let numLeads = $state(0)
	let numFollows = $state(0)
	let numBoth = $state(0)

	// Panel visibility
	let expanded = $state(false)

	// Portal: escape clipping ancestors by moving to document.body
	let panelEl = $state<HTMLElement>()

	// Build config from local state
	let currentConfig: DancePartyConfig = $derived({
		weights: {
			hasMessage,
			hasPaid,
			earlySignup,
			jitterWeight,
		},
		layout: {
			centerBiasMax,
			verticalJitter,
			soloAffinity,
			messageBalanceRate,
			minSpacing,
		},
		dock: {
			maxScale: dockMaxScale,
			neighborCount,
			falloffFn,
			baseIconHeight,
			magnifiedSpacing,
		},
	})

	/** Generate a stable list of synthetic dancers. Names and timestamps are
	 *  deterministic per role, so adding a lead doesn't shift follows/boths. */
	function generateSyntheticDancers(
		leads: number,
		follows: number,
		both: number,
	): DancerRow[] | null {
		if (leads === 0 && follows === 0 && both === 0) return null
		const dancers: DancerRow[] = []
		const baseTs = 1_700_000_000_000 // fixed epoch for stability
		// Each role uses its own offset so adding to one role doesn't shift others
		for (let i = 1; i <= leads; i++) {
			dancers.push({
				name: `Lead-${String(i).padStart(2, '0')}`,
				role: 'lead',
				ts: baseTs + (i - 1) * 60_000,
				wish: i % 3 === 1 ? `Lead ${i} says hi!` : undefined,
				paid: i % 4 === 0,
			})
		}
		for (let i = 1; i <= follows; i++) {
			dancers.push({
				name: `Follow-${String(i).padStart(2, '0')}`,
				role: 'follow',
				ts: baseTs + 1_000_000 + (i - 1) * 60_000,
				wish: i % 3 === 1 ? `Follow ${i} says hi!` : undefined,
				paid: i % 4 === 0,
			})
		}
		for (let i = 1; i <= both; i++) {
			dancers.push({
				name: `Both-${String(i).padStart(2, '0')}`,
				role: 'both',
				ts: baseTs + 2_000_000 + (i - 1) * 60_000,
				wish: i % 3 === 1 ? `Both ${i} says hi!` : undefined,
				paid: i % 4 === 0,
			})
		}
		return dancers
	}

	function applyConfig(
		c: DancePartyConfig,
		song: number,
		view?: {
			heightMultiplier: number
			marginTop: number
			anchorPercent: number
			bubbleHeightFraction?: number
		},
	) {
		hasMessage = c.weights.hasMessage
		hasPaid = c.weights.hasPaid
		earlySignup = c.weights.earlySignup
		jitterWeight = c.weights.jitterWeight
		centerBiasMax = c.layout.centerBiasMax
		verticalJitter = c.layout.verticalJitter
		soloAffinity = c.layout.soloAffinity
		messageBalanceRate = c.layout.messageBalanceRate
		minSpacing = c.layout.minSpacing ?? DEFAULT_LAYOUT.minSpacing
		dockMaxScale = c.dock.maxScale
		neighborCount = c.dock.neighborCount
		falloffFn = c.dock.falloffFn
		baseIconHeight = c.dock.baseIconHeight
		magnifiedSpacing = c.dock.magnifiedSpacing
		localSongNumber = song
		if (view) {
			heightMultiplier = view.heightMultiplier
			marginTop = view.marginTop
			anchorPercent = view.anchorPercent
			bubbleHeightFraction = view.bubbleHeightFraction ?? 1.0
		}
	}

	// Persist to sessionStorage & notify parent on any change
	$effect(() => {
		const view = { heightMultiplier, marginTop, anchorPercent, bubbleHeightFraction }
		const data = {
			config: currentConfig,
			songNumber: localSongNumber,
			view,
			dancers: { numLeads, numFollows, numBoth },
		}
		try {
			sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
		} catch {
			// sessionStorage may be unavailable
		}
		onchange(currentConfig, localSongNumber)
		onviewchange?.(heightMultiplier, marginTop, anchorPercent, bubbleHeightFraction)
	})

	// Emit synthetic dancers when counts change
	$effect(() => {
		ondancers?.(generateSyntheticDancers(numLeads, numFollows, numBoth))
	})

	// Load from sessionStorage on mount, or fall back to props.
	// Also portal: move panel to document.body to escape overflow:clip ancestors.
	onMount(() => {
		if (panelEl) {
			document.body.appendChild(panelEl)
		}

		let loaded = false
		try {
			const stored = sessionStorage.getItem(STORAGE_KEY)
			if (stored) {
				const data = JSON.parse(stored) as {
					config: DancePartyConfig
					songNumber: number
					view?: {
						heightMultiplier: number
						marginTop: number
						anchorPercent: number
						bubbleHeightFraction?: number
					}
					dancers?: { numLeads: number; numFollows: number; numBoth: number }
				}
				applyConfig(data.config, data.songNumber, data.view)
				if (data.dancers) {
					numLeads = data.dancers.numLeads ?? 0
					numFollows = data.dancers.numFollows ?? 0
					numBoth = data.dancers.numBoth ?? 0
				}
				loaded = true
			}
		} catch {
			// ignore parse errors
		}
		if (!loaded) {
			applyConfig(config, songNumber, {
				heightMultiplier: initHeightMult,
				marginTop: initMarginTop,
				anchorPercent: initAnchorPct,
				bubbleHeightFraction: initBubbleHF,
			})
		}
	})

	onDestroy(() => {
		panelEl?.remove()
	})

	function reset() {
		const defaults: DancePartyConfig = {
			weights: { ...DEFAULT_WEIGHTS },
			layout: { ...DEFAULT_LAYOUT },
			dock: { ...DEFAULT_DOCK },
		}
		applyConfig(
			defaults,
			untrack(() => songNumber),
			{
				heightMultiplier: 0.8,
				marginTop: -36,
				anchorPercent: 0,
				bubbleHeightFraction: 1.0,
			},
		)
		numLeads = 0
		numFollows = 0
		numBoth = 0
		try {
			sessionStorage.removeItem(STORAGE_KEY)
		} catch {
			// ignore
		}
	}
</script>

<div class="dev-panel" class:expanded bind:this={panelEl}>
	<button class="toggle" onclick={() => (expanded = !expanded)}>
		{expanded ? '▲' : '▼'} Dev
	</button>

	{#if expanded}
		<div class="body">
			<fieldset>
				<legend>Priority</legend>
				<div class="grid">
					<label for="dp-hasMessage">hasMessage</label>
					<span class="val">{hasMessage}</span>
					<input
						id="dp-hasMessage"
						type="range"
						min="0"
						max="10"
						step="1"
						bind:value={hasMessage}
					/>

					<label for="dp-hasPaid">hasPaid</label>
					<span class="val">{hasPaid}</span>
					<input id="dp-hasPaid" type="range" min="0" max="10" step="1" bind:value={hasPaid} />

					<label for="dp-earlySignup">earlySignup</label>
					<span class="val">{earlySignup}</span>
					<input
						id="dp-earlySignup"
						type="range"
						min="0"
						max="10"
						step="1"
						bind:value={earlySignup}
					/>

					<label for="dp-jitterWeight">jitterWeight</label>
					<span class="val">{jitterWeight.toFixed(1)}</span>
					<input
						id="dp-jitterWeight"
						type="range"
						min="0"
						max="5"
						step="0.1"
						bind:value={jitterWeight}
					/>

					<label for="dp-centerBiasMax">centerBias max</label>
					<span class="val">{centerBiasMax.toFixed(2)}</span>
					<input
						id="dp-centerBiasMax"
						type="range"
						min="0"
						max="1"
						step="0.05"
						bind:value={centerBiasMax}
					/>
				</div>
			</fieldset>

			<fieldset>
				<legend>Pairing</legend>
				<div class="grid">
					<label for="dp-messageBalanceRate">messageBalanceRate</label>
					<span class="val">{messageBalanceRate.toFixed(2)}</span>
					<input
						id="dp-messageBalanceRate"
						type="range"
						min="0"
						max="1"
						step="0.05"
						bind:value={messageBalanceRate}
					/>
				</div>
			</fieldset>

			<fieldset>
				<legend>Dock</legend>
				<div class="grid">
					<label for="dp-maxScale">maxScale</label>
					<span class="val">{dockMaxScale.toFixed(2)}</span>
					<input
						id="dp-maxScale"
						type="range"
						min="1"
						max="5"
						step="0.25"
						bind:value={dockMaxScale}
					/>

					<label for="dp-neighborCount">neighborCount</label>
					<span class="val">{neighborCount}</span>
					<input
						id="dp-neighborCount"
						type="range"
						min="1"
						max="6"
						step="1"
						bind:value={neighborCount}
					/>

					<label for="dp-magnifiedSpacing">magnifiedSpacing</label>
					<span class="val">{magnifiedSpacing}</span>
					<input
						id="dp-magnifiedSpacing"
						type="range"
						min="0"
						max="16"
						step="1"
						bind:value={magnifiedSpacing}
					/>

					<label for="dp-falloffFn">falloffFn</label>
					<span class="val">{falloffFn}</span>
					<button
						id="dp-falloffFn"
						class="toggle-btn"
						onclick={() => (falloffFn = falloffFn === 'cosine' ? 'gaussian' : 'cosine')}
					>
						{falloffFn === 'cosine' ? 'cosine → gaussian' : 'gaussian → cosine'}
					</button>
				</div>
			</fieldset>

			<fieldset>
				<legend>Layout</legend>
				<div class="grid">
					<label for="dp-verticalJitter">verticalJitter</label>
					<span class="val">{verticalJitter}</span>
					<input
						id="dp-verticalJitter"
						type="range"
						min="0"
						max="16"
						step="1"
						bind:value={verticalJitter}
					/>

					<label for="dp-soloAffinity">soloAffinity</label>
					<span class="val">{soloAffinity.toFixed(2)}</span>
					<input
						id="dp-soloAffinity"
						type="range"
						min="0"
						max="1"
						step="0.05"
						bind:value={soloAffinity}
					/>

					<label for="dp-minSpacing">minSpacing</label>
					<span class="val">{minSpacing.toFixed(3)}</span>
					<input
						id="dp-minSpacing"
						type="range"
						min="0"
						max="0.15"
						step="0.005"
						bind:value={minSpacing}
					/>
				</div>
			</fieldset>

			<fieldset>
				<legend>Song</legend>
				<div class="grid">
					<label for="dp-songNumber">song #</label>
					<span class="val">{localSongNumber}</span>
					<input
						id="dp-songNumber"
						type="number"
						min="1"
						max={maxSong}
						bind:value={localSongNumber}
					/>
				</div>
			</fieldset>

			<fieldset>
				<legend>View</legend>
				<div class="grid">
					<label for="dp-baseIconHeight">iconHeight</label>
					<span class="val">{baseIconHeight}</span>
					<input
						id="dp-baseIconHeight"
						type="range"
						min="16"
						max="120"
						step="1"
						bind:value={baseIconHeight}
					/>

					<label for="dp-heightMult">heightMult</label>
					<span class="val">{heightMultiplier.toFixed(1)}</span>
					<input
						id="dp-heightMult"
						type="range"
						min="0.5"
						max="3.0"
						step="0.1"
						bind:value={heightMultiplier}
					/>

					<label for="dp-marginTop">marginTop</label>
					<span class="val">{marginTop}</span>
					<input
						id="dp-marginTop"
						type="range"
						min="-80"
						max="20"
						step="1"
						bind:value={marginTop}
					/>

					<label for="dp-anchorPct">anchorPct</label>
					<span class="val">{anchorPercent}</span>
					<input
						id="dp-anchorPct"
						type="range"
						min="0"
						max="100"
						step="5"
						bind:value={anchorPercent}
					/>

					<label for="dp-bubbleHF">bubbleHF</label>
					<span class="val">{bubbleHeightFraction.toFixed(2)}</span>
					<input
						id="dp-bubbleHF"
						type="range"
						min="0.5"
						max="1.2"
						step="0.01"
						bind:value={bubbleHeightFraction}
					/>
				</div>
			</fieldset>

			<fieldset>
				<legend>Dancers</legend>
				<div class="grid">
					<label for="dp-numLeads">leads</label>
					<span class="val">{numLeads}</span>
					<input id="dp-numLeads" type="number" min="0" max="30" bind:value={numLeads} />

					<label for="dp-numFollows">follows</label>
					<span class="val">{numFollows}</span>
					<input id="dp-numFollows" type="number" min="0" max="30" bind:value={numFollows} />

					<label for="dp-numBoth">both</label>
					<span class="val">{numBoth}</span>
					<input id="dp-numBoth" type="number" min="0" max="30" bind:value={numBoth} />
				</div>
				{#if numLeads > 0 || numFollows > 0 || numBoth > 0}
					<div class="dancer-summary">
						{numLeads + numFollows + numBoth} synthetic dancers (overriding real data)
					</div>
				{/if}
			</fieldset>

			<button class="reset-btn" onclick={reset}>Reset All</button>
		</div>
	{/if}
</div>

<style lang="scss">
	@use 'open-props-scss' as *;

	.dev-panel {
		position: fixed;
		top: 8px;
		right: 8px;
		z-index: 9999;
		font-family: $font-mono;
		font-size: 11px;
		color: $gray-2;
		background: rgba(20, 20, 30, 0.92);
		border: 1px solid $gray-7;
		border-radius: $radius-2;
		width: min(320px, calc((100vw - $size-content-3) / 2 - 16px));
		backdrop-filter: blur(8px);
		box-shadow: 0px 6px 24px rgba(0, 0, 0, 0.35);
	}

	.toggle {
		display: block;
		width: 100%;
		padding: 4px 10px;
		background: none;
		border: none;
		color: $gray-3;
		font-family: inherit;
		font-size: inherit;
		cursor: pointer;
		text-align: left;

		&:hover {
			color: $gray-0;
			background: rgba(255, 255, 255, 0.06);
		}
	}

	.body {
		max-height: calc(100vh - 48px);
		overflow-y: auto;
		padding: 4px 8px 8px;
	}

	fieldset {
		border: 1px solid $gray-8;
		border-radius: $radius-1;
		padding: 4px 6px 6px;
		margin: 0 0 4px;

		legend {
			font-size: 10px;
			font-weight: 600;
			color: $indigo-4;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			padding: 0 4px;
		}
	}

	.grid {
		display: grid;
		grid-template-columns: auto 40px 1fr;
		gap: 2px 6px;
		align-items: center;
	}

	label {
		white-space: nowrap;
		color: $gray-4;
	}

	.val {
		text-align: right;
		font-variant-numeric: tabular-nums;
		color: $lime-4;
	}

	input[type='range'] {
		width: 100%;
		height: 14px;
		accent-color: $indigo-5;
		cursor: pointer;
	}

	input[type='number'] {
		width: 100%;
		padding: 1px 4px;
		background: $gray-9;
		color: $gray-1;
		border: 1px solid $gray-7;
		border-radius: $radius-1;
		font-family: inherit;
		font-size: inherit;
	}

	.toggle-btn {
		padding: 1px 6px;
		background: $gray-8;
		color: $gray-2;
		border: 1px solid $gray-7;
		border-radius: $radius-1;
		font-family: inherit;
		font-size: 10px;
		cursor: pointer;

		&:hover {
			background: $gray-7;
		}
	}

	.dancer-summary {
		margin-top: 4px;
		padding: 2px 6px;
		font-size: 10px;
		color: $yellow-4;
		background: rgba(255, 200, 0, 0.08);
		border-radius: $radius-1;
		text-align: center;
	}

	.reset-btn {
		display: block;
		width: 100%;
		margin-top: 6px;
		padding: 4px 0;
		background: $red-9;
		color: $red-3;
		border: 1px solid $red-7;
		border-radius: $radius-1;
		font-family: inherit;
		font-size: 11px;
		cursor: pointer;
		text-align: center;

		&:hover {
			background: $red-8;
			color: $red-1;
		}
	}
</style>
