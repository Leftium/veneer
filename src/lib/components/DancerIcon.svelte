<script lang="ts">
	interface Props {
		role: 'lead' | 'follow' | 'unknown'
		representative?: boolean
		imageNum?: number
	}

	let { role, representative = false, imageNum }: Props = $props()

	const fallbackNum = Math.ceil(Math.random() * 6)
	const num = $derived(representative ? 6 : (imageNum ?? fallbackNum))
	const padded = $derived(String(num).padStart(2, '0'))

	const glowMap = {
		follow:
			'radial-gradient(circle, rgba(255, 105, 180, 0.55) 0%, rgba(255, 105, 180, 0.15) 55%, transparent 70%)',
		lead: 'radial-gradient(circle, rgba(65, 135, 255, 0.55) 0%, rgba(65, 135, 255, 0.15) 55%, transparent 70%)',
		unknown:
			'radial-gradient(circle, rgba(160, 160, 160, 0.45) 0%, rgba(160, 160, 160, 0.12) 55%, transparent 70%)',
	} as const

	const suffixMap = { lead: 'L', follow: 'F' } as const

	const glow = $derived(glowMap[role])
	const src = $derived(
		role !== 'unknown'
			? `/dancers/${role === 'lead' ? 'leads' : 'follows'}/${padded}-${suffixMap[role]}.png`
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
	}
</style>
