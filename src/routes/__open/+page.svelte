<script lang="ts">
	import { browser } from '$app/environment'

	if (browser) {
		window.close()
	}
</script>

<main class="container">
	<article>
		<header>This page was only opened in order to launch VS Code.</header>
		<ul>
			<li>It is safe to close this window.</li>
			<li>This page should automatically close. (Requires JS.)</li>
		</ul>
	</article>
</main>

<style>
	:global(html),
	:global(body),
	main {
		height: 100%;
	}

	main {
		align-content: center;
		max-width: fit-content;
	}
</style>
