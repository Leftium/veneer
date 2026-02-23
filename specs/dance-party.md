# Virtual Dance Party

> **Status**: Draft
>
> **Last updated**: 2026-02-24

## Overview

An interactive visualization of signed-up dancers displayed as a "virtual dance party" — a horizontal strip (the "dance floor") where dancer icons are scattered naturally. Users scrub horizontally through the dancers, macOS Dock-style, with the active dancer/pair enlarged and their name + message shown in a speech bubble.

The visualization lives inside the existing sticky header of the list tab (`<gh>` in `Sheet.svelte`), directly below the signup counts ("14명 신청!"), extending the header's height. The dance floor occupies the full width of the header container.

---

## Implementation Phases

### Phase 1 — Core Engine (`dance-party.ts`)

Pure TypeScript module with no DOM dependencies. Fully unit-testable.

- Priority scoring (weighted, configurable)
- Pairing algorithm (classify → shuffle → match → message-balance)
- Placement algorithm (hash-based position, center bias, solo grouping, jitter, flip)
- Song slot computation
- Image metadata (`LEADER_ON_LEFT` for all 32 both-images)
- Hash utilities

**Deliverable**: `src/lib/dance-party.ts` + vitest tests
**Depends on**: nothing

### Phase 2 — Static Dance Floor

Render positioned dancer icons as a non-interactive strip. No scrub, no magnification — just the idle-state layout.

- `DanceFloor.svelte`: absolutely-positioned `DancerIcon` instances using computed placements
- `DancerIcon.svelte` modifications: `glow` prop, `flipped` prop
- Integrate into `Sheet.svelte` `<gh>` header (dance-event mode)
- Dev tuning panel (sliders for all configurable parameters)

**Deliverable**: visible dance floor with correct pairing, placement, image assignment
**Depends on**: Phase 1

### Phase 3 — Scrub Interaction + Dock Magnification

Make the dance floor interactive.

- Port `trackable.ts` from weather-sense
- Dock-style magnification (scale computation, lens layout, direct DOM transforms)
- Glow activation on scrubbed dancer
- Performance: `will-change`, `pointer-events: none`, skip-unchanged, RAF throttle

**Deliverable**: scrubbing through dancers with smooth magnification
**Depends on**: Phase 2

### Phase 4 — Speech Bubbles

Show dancer info when active.

- Solo bubble (name + message + paid indicator)
- Dual bubble overlay for pairs (left/right aligned to image side)
- Bubble alignment using `LEADER_ON_LEFT` + flip state
- Positioning relative to magnified dancer

**Deliverable**: informative overlays during scrub
**Depends on**: Phase 3

### Phase 5 — Sharing + URL State

Enable sharing a specific dancer at a specific song.

- URL params: `?song=N&dancer=이름`
- Auto-activate dancer on page load from URL
- Image capture (clipboard on desktop, Web Share API on mobile)

**Deliverable**: shareable deep links and image export
**Depends on**: Phase 4

### Phase 6 — Polish + Standalone

- Standalone `DanceParty.svelte` wrapper component
- List ↔ dance floor cross-highlighting (future enhancement)
- Keyboard accessibility (arrow keys to step through dancers)
- Edge case handling refinement

**Deliverable**: production-ready component
**Depends on**: Phase 5

---

## Visual Layout

```
┌──────────────────────────────────────────────────────┐
│  14명 신청!                          👠6  👞5        │  ← existing count row
│                                                      │
│       🕺  💃🕺 💃  💃🕺  🕺   💃🕺  💃  🕺  💃🕺  │  ← dance floor
│     (small icons, slight overlaps, natural scatter)  │
│                                                      │
│            🕺  💃  ████████  💃🕺  🕺               │  ← neighbors also enlarged with falloff
│                    💃🕺                              │  ← active pair enlarged (dock effect)
│              ┌──────────┴───────────────┐            │
│              │   김철수 & 이영희        │            │  ← speech bubble (below dancer)
│              │  "Having a great time!"  │            │
│              └──────────────────────────┘            │
│                                                      │
└──────────────────────────────────────────────────────┘
│  1. 💰 🕺 김철수  "Having a great time!"             │  ← existing dancer list below
│  2.    💃 이영희                                     │
│  ...                                                 │
```

### Idle State (no scrub active)

- Dancers are shown at a small base size (e.g., 28–36px icon height), packed along the horizontal strip
- No speech bubble visible
- No glow effect on any dancer
- Slight vertical jitter (deterministic) for natural feel
- Some images horizontally flipped (deterministic) for variety

### Active State (scrubbing)

- macOS Dock magnification effect: the dancer/pair nearest the pointer is enlarged (e.g., 2.5–3x), with ~2–3 neighbors on each side progressively scaled down (cosine or gaussian falloff)
- Active dancer/pair gets a glow effect (reusing existing `DancerIcon` glow colors)
- Speech bubble appears above the active dancer/pair showing:
  - Name(s): `김철수` (solo) or `김철수 & 이영희` (pair)
  - Message/wish text (if any)
  - 💰 indicator (if paid)
- Adjacent dancers shift outward to make room for the enlarged active dancer (like the real Dock)

---

## Dancer Units

Each "slot" on the dance floor is one of three types:

### 1. Paired Dancer (leader + follower)

Uses a **both** image (`/dancers/both/NN-B.png`) — a single sprite showing two people dancing together. One image represents the pair.

**Paired pool** — images where the two figures are in a connected dance hold (07–32):

```ts
const PAIRED_POOL = [
	7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
	32,
]
```

### 2. Solo Dancer

Uses either a **lead** image (`/dancers/leads/NN-L.png`, pool of 6) or a **follow** image (`/dancers/follows/NN-F.png`, pool of 6).

Solo dancers have placement affinity toward each other — they tend to cluster together on the dance floor rather than being evenly scattered among pairs. See [Placement Algorithm — Solo Grouping](#solo-grouping).

### When to Use Each Type

- If a leader and follower are paired → use a paired pool image (single unit)
- If a member is unpaired (solo) → use the corresponding lead or follow image
- `unknown` role members are randomly assigned lead or follow for the current song (may change next song)
- `both` role members can pair as either side; treated as flexible during matching

---

## Pairing Algorithm

Pairing is deterministic per song but varies between songs. The algorithm uses priority-biased shuffling to ensure high-priority members are more likely to pair, while still producing variety across songs.

### Steps

1. **Classify all members** into leaders, followers, and flex pools:
   - Explicit `lead` → leader pool
   - Explicit `follow` → follower pool
   - `both` → flex pool (can fill either side)
   - `unknown` → assigned lead or follow via `hash(formTitle + songSlot + name) % 2`, then placed into the appropriate pool

2. **Shuffle each pool with priority bias**:

   Each member gets a **sort key** that combines their priority score with per-song hash jitter:

   ```
   sortKey = priorityScore + jitterWeight * (hash(formTitle + songSlot + name) / MAX_HASH)
   ```

   Where `jitterWeight` is a tunable parameter (dev slider, default ~2.0). This means:
   - High-priority members generally sort near the top, but not always in the same order
   - The hash component changes every song, so pairings shuffle
   - Higher `jitterWeight` = more randomness; lower = more priority-driven
   - At `jitterWeight = 0`, behavior degrades to pure priority order (no variety)

   Sort each pool by `sortKey` descending.

3. **Match pairs** from the tops of the shuffled leader and follower pools:
   - Pair leader[0] with follower[0], leader[1] with follower[1], etc.
   - When one pool runs out, pull from the flex pool to fill the shorter side
   - Any remaining unmatched members become solos

4. **Message-balancing pass**:

   After initial pairing, probabilistically spread messages across pairs. The goal: reduce (not eliminate) the number of pairs where neither member has a message, so more speech bubbles have content when scrubbed.

   For each messageless pair (neither member has a message), roll a per-song hash to decide whether to attempt a swap:

   ```
   swapChance = hash(formTitle + songSlot + 'msgbal' + pairIndex) / MAX_HASH
   if (swapChance < messageBalanceRate) → attempt swap
   ```

   If a swap is attempted, find a "message-rich" pair (both members have messages) and swap one member:

   ```
   // Before: [A(msg) + B(msg)], [C(none) + D(none)]  →  2 pairs, 1 has message
   // After:  [A(msg) + D(none)], [C(none) + B(msg)]  →  2 pairs, 2 have message
   ```

   Swap rules:
   - Only swap within the same role (leader↔leader, follower↔follower) to preserve role correctness
   - Which message-rich pair to swap with is picked by hash (deterministic per song)
   - A message-rich pair can only be "stolen from" once — after donating a member, it's no longer rich
   - `messageBalanceRate` is tunable (dev slider, default 0.5 — roughly half of messageless pairs get a swap attempt)
   - At rate 0, no balancing occurs. At rate 1, every messageless pair attempts a swap (but may not find a rich pair). Natural variety is preserved because the hash decides differently each song.

5. **Pair priority for placement**: A pair's priority score for center-bias placement uses `max(leaderScore, followerScore)` — the pair gets at least as much center bias as its strongest member.

6. **New signups during the hour**: A new signup may pair with a currently-solo dancer. Since pairing is recomputed from the full member list each time, adding a member can convert a solo into a pair. The priority-biased shuffle means high-priority solos are more likely to pair first — a new low-priority signup is unlikely to displace an existing pair, preserving visual consistency.

### Priority Weights

Weights are configurable constants for tuning. Exposed as dev-mode sliders (see [Dev Tuning UI](#dev-tuning-ui)):

```ts
const PRIORITY_WEIGHTS = {
	hasMessage: 3, // has non-empty wish/message text
	hasPaid: 2, // has payment confirmation
	earlySignup: 1, // normalized: earliest signup = 1.0, latest = 0.0
	jitterWeight: 2.0, // how much hash-based randomness affects pairing order per song
}
```

**Priority score** for a member (weights stack additively):

```
score = (hasMessage ? W.hasMessage : 0)
      + (hasPaid    ? W.hasPaid    : 0)
      + (earlySignup * W.earlySignup)
```

Where `earlySignup` is linearly interpolated: the first signup gets 1.0, the last gets 0.0. (If only one member, earlySignup = 1.0.)

The priority score drives both **pairing order** (via sort key with jitter, see above) and **center bias** in placement. For pairs, the placement uses `max(leaderScore, followerScore)`.

---

## Placement Algorithm

Each dancer unit (pair or solo) receives a horizontal position on the dance floor. Placement is **independently computed per unit** (not a global shuffle), so adding a new signup doesn't rearrange existing dancers.

### Position Computation

1. **Compute raw position** via hash:

   ```
   rawPos = hash(formTitle + songSlot + unitKey) / MAX_HASH  →  [0, 1]
   ```

   Where `unitKey` = sorted pair of names for pairs, or single name for solos.

2. **Apply center bias** based on priority:

   ```
   biasedPos = lerp(rawPos, 0.5, centerBias)
   ```

   Where `centerBias` is derived from the unit's priority score:
   - For solos: `centerBias = clamp(priorityScore / maxPossibleScore, 0, 0.8)`
   - For pairs: `centerBias = clamp(max(leaderScore, followerScore) / maxPossibleScore, 0, 0.8)`
   - High-priority units are pulled toward center; low-priority stay near their raw hash position

3. **Vertical jitter** for natural feel:

   ```
   yOffset = (hash(formTitle + songSlot + unitKey + 'y') % JITTER_RANGE) - JITTER_RANGE/2
   ```

   Small range (e.g., ±4px) so dancers don't look misaligned, just natural.

4. **Horizontal flip** for variety:
   ```
   flipped = hash(formTitle + songSlot + unitKey + 'flip') % 2 === 1
   ```
   Applied via CSS `transform: scaleX(-1)`. (Note: speech bubble text must NOT be flipped.)

### Solo Grouping

Solo dancers have a placement affinity: their raw hash positions are nudged toward a shared "solo cluster center" on the dance floor. This creates natural clusters of solo dancers rather than isolated individuals scattered among pairs.

```
soloClusterCenter = hash(formTitle + songSlot + 'soloCenter') / MAX_HASH  →  [0, 1]
soloAffinity = 0.3  // tunable: how strongly solos are pulled toward each other

// For solo units, modify the raw position:
rawPos = lerp(rawPos, soloClusterCenter, soloAffinity)
// Then apply center bias on top of that as usual
```

The `soloAffinity` strength is exposed as a dev slider. At 0, solos scatter normally. At 1, all solos collapse to the same point. The cluster center itself changes per song, so solos group in different areas each hour.

### Overlap Handling

- Dancers are allowed to slightly overlap horizontally (unlike the macOS Dock which has strict spacing)
- No collision resolution needed — overlaps are part of the "crowded dance floor" aesthetic
- When magnified (active scrub), the enlarged dancer and its neighbors push apart via the Dock-style spacing algorithm, temporarily resolving overlaps in the active region

### Consistency Across New Signups

Because each unit's position is independently hashed (not dependent on how many other dancers exist), adding a new signup:

- Places the new dancer at a deterministic position
- Does NOT move any existing dancer
- May convert an existing solo into a pair (new pairing), which changes that unit's `unitKey` and thus its image, but the position is recomputed from the new key and will likely shift — this is acceptable since the visual identity changes anyway (solo → pair)

---

## Songs (Hourly Variation)

Each "song" is a unique arrangement of dancers. Songs are numbered starting from 1, where song 1 corresponds to the hour of the first signup.

### Song Slot Computation

```ts
function getSongNumber(firstSignupTs: number, now: Date = new Date()): number {
	const firstHour = Math.floor(firstSignupTs / (3600 * 1000))
	const currentHour = Math.floor(now.getTime() / (3600 * 1000))
	return currentHour - firstHour + 1
}

function getSongSlot(formTitle: string, songNumber: number): string {
	return `${formTitle}\0song${songNumber}`
}
```

- `song=1` = the hour when the first person signed up
- `song=2` = the next hour, etc.
- The current song is determined at page load and does **not** reactively update when the wall clock crosses an hour boundary — the arrangement only changes on reload
- Different events have independent song numbering (song 1 for event A is a different wall-clock hour than song 1 for event B)

### What Changes Per Song

- Dancer positions (different hash inputs)
- Dancer image assignments (different hash inputs)
- Pairing order (hash-based tiebreaking changes)
- `unknown` role assignments (may flip lead/follow)
- Horizontal flip decisions

### What Stays Constant Across Songs

- Priority scores (based on signup data, not song)
- Center bias (derived from priority)
- The set of dancers (data doesn't change, only arrangement)

---

## Dock-Style Magnification

The magnification effect follows the macOS Dock model:

### Parameters

```ts
const DOCK_CONFIG = {
	maxScale: 2.75, // scale of the active (nearest) item
	neighborCount: 3, // how many neighbors on each side are affected
	falloffFn: 'cosine', // 'cosine' | 'gaussian' — shape of scale falloff
	baseIconHeight: 32, // px, un-magnified icon height
	magnifiedSpacing: 4, // px, gap between items when magnified region expands
}
```

All parameters are exposed as dev-mode sliders (see [Dev Tuning UI](#dev-tuning-ui)).

### Scale Computation

For each dancer unit at position `i`, given the continuous scrub position `t` (normalized 0–1):

```ts
function getScale(unitIndex: number, scrubPosition: number, unitPositions: number[]): number {
	const distance = Math.abs(unitPositions[unitIndex] - scrubPosition)
	const normalizedDist = distance / neighborRadius // 0 = at pointer, 1 = edge of effect

	if (normalizedDist >= 1) return 1.0 // outside magnification range

	// Cosine falloff: smooth bell curve
	const t = (1 + Math.cos(Math.PI * normalizedDist)) / 2 // 1 at center, 0 at edge
	return 1.0 + (DOCK_CONFIG.maxScale - 1.0) * t
}
```

### Layout During Magnification

When magnification is active, dancers in the affected region need extra horizontal space. Rather than repositioning all dancers, only the magnified region expands:

- The magnified region acts as a "lens" — items within it spread apart proportionally to their scale
- Items outside the region stay fixed
- This is achieved via CSS transforms (translateX + scale), not layout changes — GPU-friendly

---

## Speech Bubble / Popup Overlay

Appears **below** the active dancer/pair when scrubbing. Positioned below (not above) so the signup count row ("14명 신청!") at the top of the header is never obscured.

### Solo Dancer — Single Bubble

```
              [dancer]
                 ▲
      ┌──────────┴───────────┐
      │  💰 김철수            │
      │  "Having a great     │
      │    time!"            │
      └──────────────────────┘
```

- **Name**: with 💰 prefix if paid
- **Message**: wish text (if present), omitted if no message
- **Pointer**: upward-pointing triangle, centered on the dancer

### Paired Dancers — Dual Bubble Overlay

For pairs, a popup/overlay appears containing **two speech bubbles** — one for each member, aligned to match their visual position in the image (left/right):

```
                   [pair image]
                       ▲
  ┌────────────────────┴────────────────────┐
  │                                         │
  │  ┌──────────────┐  ┌──────────────────┐ │
  │  │ 💰 김철수     │  │ 이영희           │ │
  │  │ "Great time!" │  │ "Can't wait! 🎉" │ │
  │  └──────────────┘  └──────────────────┘ │
  │                                         │
  └─────────────────────────────────────────┘
```

- **Left bubble**: corresponds to the left figure in the image
- **Right bubble**: corresponds to the right figure in the image
- Each bubble shows that member's name (with 💰 if paid) and their individual message
- If a member has no message, their bubble shows only the name (no empty space)
- If neither has a message, bubbles show names only (compact)
- The outer container is a semi-transparent overlay/card that groups both bubbles
- When the image is horizontally flipped, the bubble positions also flip (left figure's bubble stays on the left visually)

This uses per-image metadata indicating which side the leader is on (see [Image Metadata](#image-metadata)).

### Bubble Alignment by Image Side

```ts
function getBubbleAlignment(
	imageNum: number,
	flipped: boolean,
): { leftMember: 'leader' | 'follower'; rightMember: 'leader' | 'follower' } {
	const leaderIsLeft = LEADER_ON_LEFT[imageNum]
	const effectiveLeaderIsLeft = flipped ? !leaderIsLeft : leaderIsLeft
	return effectiveLeaderIsLeft
		? { leftMember: 'leader', rightMember: 'follower' }
		: { leftMember: 'follower', rightMember: 'leader' }
}
```

---

## Image Metadata

All 32 both-images are catalogued. The visual convention: **pants/trousers = lead, skirt/dress = follow**.

### Leader Side (before any horizontal flip)

```ts
// true = leader (pants figure) is on the LEFT side of the image
const LEADER_ON_LEFT: Record<number, boolean> = {
	// Breakaway poses (01–06): separated figures
	1: true, // 01-B: lead left, follow right — facing forward, apart
	2: false, // 02-B: follow left, lead right — arms up, jumping
	3: false, // 03-B: follow left, lead right — low crouching
	4: false, // 04-B: follow left, lead right — jumping
	5: true, // 05-B: lead left, follow right — jumping
	6: true, // 06-B: lead left, follow right — peace signs

	// Connected dance hold (07–32)
	7: true, // 07-B: arabesque/ballet hold
	8: false, // 08-B: close tango dip
	9: false, // 09-B: underarm turn, hands joined above
	10: false, // 10-B: close hold, moving right
	11: true, // 11-B: lift — lead holds follow overhead
	12: true, // 12-B: dip — lead dips follow backward
	13: false, // 13-B: close embrace, slow dance
	14: true, // 14-B: open hold, hands joined, leaping
	15: false, // 15-B: close embrace, cheek to cheek
	16: true, // 16-B: close side embrace
	17: true, // 17-B: side by side, parallel move
	18: true, // 18-B: open hold, hands joined, spinning
	19: true, // 19-B: open hold, counterbalance
	20: true, // 20-B: closed position, walking
	21: false, // 21-B: hand hold, jumping
	22: true, // 22-B: close embrace, dramatic
	23: true, // 23-B: side by side, running/jog
	24: true, // 24-B: acrobatic lift
	25: true, // 25-B: underarm turn, hands high
	26: true, // 26-B: open hand hold, swing out
	27: true, // 27-B: behind embrace, airplane
	28: true, // 28-B: low lunge, dramatic
	29: true, // 29-B: hand hold, one kneeling
	30: true, // 30-B: close embrace, dip
	31: true, // 31-B: open hold, swing out
	32: true, // 32-B: close embrace, dynamic
}
```

### Name/Bubble Placement

The `LEADER_ON_LEFT` metadata combined with the flip state determines which member's bubble goes on which side, via `getBubbleAlignment()` (see [Speech Bubble — Bubble Alignment by Image Side](#bubble-alignment-by-image-side)).

---

## Scrub Interaction

### Input Handling

Port `trackable.ts` from the weather-sense project, adapted for this use case:

| weather-sense           | dance-party                                               |
| ----------------------- | --------------------------------------------------------- |
| `getMs(e) → timestamp`  | `getPosition(e) → normalized 0–1 along dance floor width` |
| `onTimeChange(ms)`      | `onScrubChange(position: number)`                         |
| `onTrackingStart(node)` | `onScrubStart(node)`                                      |
| `onTrackingEnd()`       | `onScrubEnd()`                                            |

The horizontal-scrub vs. vertical-scroll gesture discrimination is identical. RAF throttling at 60fps is identical.

### Rendering During Scrub

All visual updates during active scrub use **direct DOM manipulation** (not Svelte reactivity) for performance:

- `element.style.transform = \`scale(${s}) translateX(${dx}px) translateY(${dy}px)\`` on each dancer
- Speech bubble positioned via `style.transform`
- Glow toggled via `style.opacity` on the `::before` pseudo-element

When scrub ends, reactive state catches up (e.g., for accessibility, for URL update).

### Performance Targets

Following the weather-sense performance patterns:

- `will-change: transform` on all dancer icon containers
- `pointer-events: none` on non-interactive children during scrub
- Skip-unchanged guard: don't re-render if scrub position hasn't meaningfully changed
- `touch-action: pan-y` default, switched to `none` during horizontal scrub
- `overflow: clip` on the dance floor container

---

## Sharing

### URL State

The dance floor state is encoded in URL query parameters:

```
?song=3&dancer=김철수
```

- `song`: song number (1-indexed from the hour of the first signup) — which arrangement to show. Defaults to the current song if omitted.
- `dancer`: name of the selected dancer — activates that dancer/pair on load. If the named dancer is part of a pair, the entire pair is activated (either member's name works as the param value).

When a user selects a dancer, the URL updates with both params. Sharing that URL deep-links to that exact state.

**Pair handling**: `?dancer=김철수` activates the pair containing 김철수 — there's no need for a compound `dancer=김철수+이영희` format. Either member's name resolves to the same pair. The speech bubble shows both names regardless of which was in the URL.

### Image Capture

A share button (or long-press/context menu on mobile) captures the current dance floor state as an image:

- **Desktop**: "Copy image" button → writes PNG to clipboard via `ClipboardItem` API
- **Mobile**: Share button → uses `navigator.share()` with the image file (Web Share API), falling back to download

The captured image includes:

- The dance floor with current magnification state
- The speech bubble(s) with selected dancer's name + message
- The signup count header

Implementation: `html2canvas` or similar library, or Canvas API rendering of the positioned sprites.

---

## Dev Tuning UI

During development, a floating panel provides real-time control over key parameters. Enabled via a dev flag (e.g., `?dev=1` or a build-time constant). The panel is hidden in production.

### Tunable Parameters

| Group        | Parameter            | Control      | Default   | Range             |
| ------------ | -------------------- | ------------ | --------- | ----------------- |
| **Priority** | `hasMessage` weight  | slider       | 3         | 0–10              |
| **Priority** | `hasPaid` weight     | slider       | 2         | 0–10              |
| **Priority** | `earlySignup` weight | slider       | 1         | 0–10              |
| **Priority** | `jitterWeight`       | slider       | 2.0       | 0–5               |
| **Priority** | `centerBias` max     | slider       | 0.8       | 0–1               |
| **Pairing**  | `messageBalanceRate` | slider       | 0.5       | 0–1               |
| **Dock**     | `maxScale`           | slider       | 2.75      | 1–5               |
| **Dock**     | `neighborCount`      | slider       | 3         | 1–6               |
| **Dock**     | `baseIconHeight`     | slider       | 32        | 16–64             |
| **Dock**     | `magnifiedSpacing`   | slider       | 4         | 0–16              |
| **Dock**     | `falloffFn`          | toggle       | cosine    | cosine / gaussian |
| **Layout**   | `verticalJitter`     | slider       | 4         | 0–16              |
| **Layout**   | `overlapTolerance`   | slider       | 0.3       | 0–1               |
| **Layout**   | `soloAffinity`       | slider       | 0.3       | 0–1               |
| **Song**     | song number override | number input | (current) | 1–N               |

Changes take effect immediately (no reload). Values are stored in `sessionStorage` so they persist across hot reloads during development.

---

## Component Architecture

### New Files

| File                                   | Role                                                                                                                                                                  |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/components/DanceParty.svelte` | Top-level component. Receives dancer data + form title. Computes pairing, placement, song seed. Renders `DanceFloor` + speech bubble overlay. Can be used standalone. |
| `src/lib/components/DanceFloor.svelte` | The interactive strip. Manages scrub state, renders positioned dancer icons, applies dock magnification. Uses `trackable` action.                                     |
| `src/lib/dance-party.ts`               | Pure functions: pairing algorithm, placement algorithm, priority scoring, hash utilities, dock scale computation, image metadata. Fully testable without DOM.         |
| `src/lib/trackable.ts`                 | Ported from weather-sense. Svelte `use:trackable` action for pointer/touch gesture detection.                                                                         |

### Modified Files

| File                                   | Change                                                                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/components/Sheet.svelte`      | Import `DanceParty`, render it inside the `<gh>` header (dance-event mode). Extend header height.                          |
| `src/lib/components/DancerIcon.svelte` | Add optional `glow` prop (default `true` to preserve current behavior). Add optional `flipped` prop for horizontal mirror. |
| `src/lib/util.ts`                      | `hashString` already exported — may add additional hash utilities to `dance-party.ts` instead.                             |

### Data Flow

```
Sheet.svelte
  ├── derives dancers[] and imageNums[] from sheet data (existing)
  ├── passes to DanceParty:
  │     dancers: DancerRow[]  (with wish/paid data)
  │     formTitle: string
  │     extra: { count, ci }
  │     rows: any[]  (for wish/paid data access)
  │     firstSignupTs: number  (for song numbering)
  │
  └── DanceParty.svelte
        ├── computes songNumber, pairings, placements (via dance-party.ts)
        ├── renders DanceFloor.svelte
        │     ├── use:trackable for scrub input
        │     ├── renders DancerIcon instances via absolute positioning + CSS transforms
        │     ├── applies dock magnification via direct DOM manipulation during scrub
        │     └── emits activeUnit changes
        ├── renders speech bubble overlay (positioned relative to active dancer)
        └── manages URL state (?song=&dancer=)
```

### Standalone Usage

`DanceParty.svelte` is self-contained — it receives data as props and handles all internal state. To display standalone (without the dancer list below):

```svelte
<DanceParty {dancers} {formTitle} {extra} {rows} {firstSignupTs} standalone />
```

The `standalone` prop (or absence of a parent `Sheet`) controls whether the component renders its own count header or assumes one exists above it.

---

## Interaction with Existing Dancer List

The dance party is a **complementary** visualization, not a replacement. The full dancer list remains below it. Interactions between them:

- **Clicking a dancer in the list** could scroll the dance floor to center that dancer and activate them (future enhancement)
- **Selecting a dancer via scrub** could highlight the corresponding row in the list below (future enhancement)
- For v1, they are independent views of the same data

---

## Edge Cases

| Scenario                            | Behavior                                                                   |
| ----------------------------------- | -------------------------------------------------------------------------- |
| 0 dancers                           | Dance floor hidden entirely                                                |
| 1 dancer                            | Single dancer centered, no scrub interaction needed                        |
| 2 dancers (1 pair)                  | Single pair centered, speech bubble shown on tap/hover                     |
| All leaders, no followers           | All solos (no pairing possible without flex members)                       |
| 50+ dancers                         | Icons at minimum size, dense packing, scrub becomes essential for browsing |
| Very long name/message              | Speech bubble truncates with ellipsis, max-width constraint                |
| Same name, different signups        | `unitKey` includes index suffix to disambiguate (e.g., `김철수#2`)         |
| Page load with `?dancer=` param     | Auto-activate that dancer/pair, magnify                                    |
| `?dancer=` names someone in a pair  | Entire pair activated, both names shown                                    |
| `?song=` exceeds current song count | Clamp to current song                                                      |
| `?song=0` or negative               | Clamp to song 1                                                            |
| No timestamp on first signup        | Fall back to song=1 always (no song progression)                           |

---

## Open Questions

1. **Image capture quality**: `html2canvas` can be unreliable with CSS transforms and scaled images. May need to render to a real `<canvas>` using pre-loaded image sprites for reliable sharing.

2. **Past song review**: We may add an interaction to browse past songs. This could be a small song selector (dots or mini timeline) above or below the dance floor. Deferred to a future spec.

3. **Mobile performance**: With 50+ dancers, applying per-frame transforms to 50 DOM elements could be costly on low-end phones. May need to only update transforms for the ~7 visible magnified dancers and skip the rest.

4. **Accessibility**: Scrub-only interaction is not keyboard-accessible. Need left/right arrow key support to step through dancers, and a way to show the speech bubble without pointer interaction.

5. **Solo grouping tuning**: The `soloAffinity` parameter needs real-world testing — too strong and solos clump unnaturally, too weak and they're indistinguishable from pairs in placement pattern.
