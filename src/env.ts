import { defineEnvVars } from '@sveltejs/kit/env'

export const variables = defineEnvVars({
	GCP_API_KEY: { static: true },
})
