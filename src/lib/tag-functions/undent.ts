export function undent(strings: TemplateStringsArray, ...values: unknown[]) {
	// Rebuild full string with interpolated values
	let raw = strings.reduce((acc, str, i) => acc + str + (values[i] ?? ''), '')

	// Normalize line endings
	raw = raw.replace(/\r\n?/g, '\n')

	// Split into lines and remove leading/trailing empty lines
	const lines = raw.split('\n').filter((line, i, arr) => {
		if (i === 0 || i === arr.length - 1) return line.trim() !== ''
		return true
	})

	// Compute minimal indentation across all non-empty lines
	const indent = lines.reduce((min, line) => {
		if (!line.trim()) return min
		const match = line.match(/^(\s*)/)
		const length = match?.[1]?.length ?? 0
		return Math.min(min, length)
	}, Infinity)

	// Remove that indent from each line
	const undented = lines.map((line) => line.slice(indent)).join('\n')

	return undented.trim()
}
