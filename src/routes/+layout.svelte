<script lang="ts">
	import 'sanitize.css'
	import 'sanitize.css/forms.css'
	import 'sanitize.css/typography.css'
	import '../app.scss'
	import { GgConsole } from '@leftium/gg'
	let { children } = $props()
</script>

<GgConsole />
{@render children()}
