<script lang="ts">
	interface Props {
		role: 'lead' | 'follow' | 'both' | 'unknown'
		representative?: boolean
		imageNum?: number
	}

	let { role, representative = false, imageNum }: Props = $props()

	const bothPool = [7, 9, 10, 11, 12, 13, 15, 16, 17, 20, 21, 22, 23, 24, 25, 27, 30, 32] as const
	const fallbackNum = Math.ceil(Math.random() * 6)
	const fallbackBothNum = bothPool[Math.floor(Math.random() * bothPool.length)]

	const glowMap = {
		follow:
			'radial-gradient(circle, rgba(255, 105, 180, 0.55) 0%, rgba(255, 105, 180, 0.15) 55%, transparent 70%)',
		lead: 'radial-gradient(circle, rgba(65, 135, 255, 0.55) 0%, rgba(65, 135, 255, 0.15) 55%, transparent 70%)',
		both: 'radial-gradient(circle at 20% 50%, rgba(255, 105, 180, 0.6) 0%, rgba(255, 105, 180, 0.1) 35%, transparent 55%), radial-gradient(circle at 80% 50%, rgba(65, 135, 255, 0.6) 0%, rgba(65, 135, 255, 0.1) 35%, transparent 55%)',
		unknown:
			'radial-gradient(circle, rgba(160, 160, 160, 0.45) 0%, rgba(160, 160, 160, 0.12) 55%, transparent 70%)',
	} as const

	const dirMap = { lead: 'leads', follow: 'follows', both: 'both' } as const
	const suffixMap = { lead: 'L', follow: 'F', both: 'B' } as const
	const representativeMap = { lead: 6, follow: 6, both: 20 } as const

	const numForRole = $derived(
		representative
			? (representativeMap[role as keyof typeof representativeMap] ?? 6)
			: role === 'both'
				? fallbackBothNum
				: (imageNum ?? fallbackNum),
	)
	const paddedForRole = $derived(String(numForRole).padStart(2, '0'))

	const glow = $derived(glowMap[role])
	const src = $derived(
		role !== 'unknown'
			? `/dancers/${dirMap[role as keyof typeof dirMap]}/${paddedForRole}-${suffixMap[role as keyof typeof suffixMap]}.png`
			: null,
	)
</script>

<span class="dancer-icon" style:--dancer-glow={glow}>
	{#if src}
		<img {src} alt="{role} dancer" />
	{:else}
		<span class="unknown">❓</span>
	{/if}
</span>

<style>
	.dancer-icon {
		display: inline-flex;
		align-items: flex-end;
		justify-content: center;
		position: relative;
		width: var(--dancer-glow-size, 60px);
		height: var(--dancer-glow-size, 60px);
		vertical-align: middle;
		overflow: visible;
	}

	.dancer-icon::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: var(--dancer-glow);
		mask-image: radial-gradient(circle, black 40%, transparent 70%);
	}

	.dancer-icon img {
		position: relative;
		height: var(--dancer-icon-size, 70px);
		width: auto;
		object-fit: contain;
		object-position: bottom;
		filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.3)) drop-shadow(0 0 3px rgba(0, 0, 0, 0.15));
	}

	.unknown {
		position: relative;
		font-size: calc(var(--dancer-glow-size, 60px) * 0.65);
		line-height: 1;
		align-self: center;
	}
</style>
