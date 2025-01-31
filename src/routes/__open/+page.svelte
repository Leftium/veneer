<script lang="ts">
	import { browser } from '$app/environment'

	if (browser) {
		window.close()
	}
</script>

<full-height>
	<article>
		<header>This page just launches an editor (like VS Code).</header>
		<ul>
			<li>You may safely close this window.</li>
			<li>This page automatically closes (if JavaScript enabled).</li>
		</ul>
	</article>
</full-height>

<style>
	full-height {
		display: grid;
		height: 100svh;

		align-content: center;
		justify-content: center;
	}
</style>
