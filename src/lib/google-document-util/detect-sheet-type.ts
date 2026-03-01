// Server-side sheet type detection (Phase 1)
// Lightweight duplicate of client-side detection (~5 regex tests on column titles).
// Full row transforms (ci, stats, grouping) remain client-side.

import { REGEX_DANCE_NAME, REGEX_DANCE_ROLE } from '$lib/dance-constants'
import { REGEX_PLAYLIST_TITLE, REGEX_PLAYLIST_ARTIST } from '$lib/playlist-constants'

export type SheetType = 'dance-event' | 'playlist' | null

export function detectSheetType(rows: (string | (string | number)[])[][]): SheetType {
	if (!rows.length) return null

	// Find header row: the row with the most cells (same heuristic as extractColumnHeaders)
	let headerRowIndex = 0
	for (let i = 1; i < rows.length; i++) {
		if (rows[i].length > rows[headerRowIndex].length) {
			headerRowIndex = i
		}
	}

	// Extract column titles (cell is either a string or [string, timestamp] tuple)
	const titles = rows[headerRowIndex].map((cell) =>
		typeof cell === 'string' ? cell : String(cell?.[0] ?? ''),
	)

	// Dance-event: requires both name and role columns (takes precedence over playlist)
	const hasName = titles.some((t) => REGEX_DANCE_NAME.test(t))
	const hasRole = titles.some((t) => REGEX_DANCE_ROLE.test(t))
	if (hasName && hasRole) return 'dance-event'

	// Playlist: requires both title and artist columns
	const hasTitle = titles.some((t) => REGEX_PLAYLIST_TITLE.test(t))
	const hasArtist = titles.some((t) => REGEX_PLAYLIST_ARTIST.test(t))
	if (hasTitle && hasArtist) return 'playlist'

	return null
}
