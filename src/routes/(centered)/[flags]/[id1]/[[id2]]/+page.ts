export const load = async ({ params }) => {
	const TAB_BIT_INFO = 0b001
	const TAB_BIT_FORM = 0b010
	const TAB_BIT_RESPONSES = 0b100

	const flags = Number(params.flags)

	const visibleTabs = {
		info: (flags & TAB_BIT_INFO) > 0,
		form: (flags & TAB_BIT_FORM) > 0,
		responses: (flags & TAB_BIT_RESPONSES) > 0,
	}

	const numTabs = flags.toString(2).replace(/0/g, '').length

	return { numTabs, visibleTabs }
}
