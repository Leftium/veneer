<script lang="ts">
	import { linkifyRelative, makeTagFunctionMd } from '$lib/tag-functions/markdown.js'
	const md = makeTagFunctionMd({ html: true, linkify: true }, [[linkifyRelative]])
</script>

{@html md`
	- 9월 14일 소셜 [DEV] /15/g.zUuXZZuvobvnU1ja7
	- 9월 14일 소셜 [DEV] /15/f.1FAIpQLSesCAm6R0BOW8sKVBZJPW6ySaDIvcYujg9lfsW36rDiD2MF0w
	- 8월 10일 일요일 /15/g.r6eRUz2U9uf5oVFn6/s.13E_wsbrKLEsuV-eDaTKl0a967EdpYgcZrXH0Gq_KK3g
	- Midnight Bubbles(응답) /12/s.1_bZqtj2UoVjNLm1GRqbAI-QjNSoyOa2veWAfvyhFQQo
	- open sheet test /12/s.1o5t26He2DzTweYeleXOGiDjlU4Jkx896f95VUHVgS8U
	- 레드홍 & 송송이 Blues Dance Class /15/g.D2eJ3WGKQsc6rX329
	- Pineapple Blues /15/g.tBMa9PThhCkkF72X9
	- 블루스 연습모임 시즌9 /15/g.7nGG9LPxJerC6SGN9
	- 광복의 리듬\_blues Workshop+party /15/f.1FAIpQLSflW7re7OGx3mrvT9r1cIUi6pZ_qm9ctMdy2lyEwh5JIfAHSA/s.1RuSJp1r5fi96zMwR28sdFvvTuMSl5eClYTOPoJIIX4Q
	  - form /15/f.1FAIpQLSflW7re7OGx3mrvT9r1cIUi6pZ_qm9ctMdy2lyEwh5JIfAHSA
	  - list /15/s.1RuSJp1r5fi96zMwR28sdFvvTuMSl5eClYTOPoJIIX4Q
	- Summer Night Blues 3 /15/f.1FAIpQLSd_7BPbEDHD8snbAy0ijLU-cYrg-yxTjdH6_sRJt8u26TJsbw
`}
