<script lang="ts">
	import { linkifyRelative, makeTagFunctionMd } from '$lib/tag-functions/markdown.js'
	const md = makeTagFunctionMd({ html: true, linkify: true }, [[linkifyRelative]])
</script>

{@html md`
	- /15/g.zUuXZZuvobvnU1ja7
	- /15/g.r6eRUz2U9uf5oVFn6/s.13E_wsbrKLEsuV-eDaTKl0a967EdpYgcZrXH0Gq_KK3g
`}
