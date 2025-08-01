<script lang="ts">
	import { linkifyRelative, makeTagFunctionMd } from '$lib/tag-functions/markdown.js'
	const md = makeTagFunctionMd({ html: true, linkify: true }, [[linkifyRelative]])
</script>

{@html md`
	- 9월 14일 소셜 [DEV] /15/g.zUuXZZuvobvnU1ja7
	- 8월 10일 일요일 /15/g.r6eRUz2U9uf5oVFn6/s.13E_wsbrKLEsuV-eDaTKl0a967EdpYgcZrXH0Gq_KK3g
	- Midnight Bubbles(응답) /12/s.1_bZqtj2UoVjNLm1GRqbAI-QjNSoyOa2veWAfvyhFQQo
	- open sheet test /12/s.1o5t26He2DzTweYeleXOGiDjlU4Jkx896f95VUHVgS8U
`}
