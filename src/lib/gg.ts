import type { CallSite } from 'callsite'

import * as dotenv from 'dotenv'

import debugFactory from 'debug'

import { browser } from '$app/environment'

const GG_ENABLED = true

function callSiteCommonPathPrefixMatches(callSite: CallSite | string) {
	return String(callSite).match(/[@(](?<prefix>.*?\/)(?:lib|chunks)\//i)
}

/** console.log('Check prefix for callSites on different platforms/environments:')
const callSites: Record<string, Record<string, string>> = {
	localhost: {
		node: 'getStack (S:/p/bangtastic/src/lib/util.ts:21:17)',
		chrome: 'getStack (http://192.168.0.5:5173/src/lib/util.ts?t=1707273649942:18:17)',
		safari: 'getStack@http://192.168.0.5:5173/src/lib/util.ts:18:26',
	},
	vercel: {
		node: 'getStack (file:///var/task/.svelte-kit/output/server/chunks/util.js:18:17)',
		chrome: 'y (https://bangtastic.vercel.app/_app/immutable/chunks/util.pMXJCmiz.js:1:6712)',
		safari: 'y@https://bangtastic.vercel.app/_app/immutable/chunks/util.pMXJCmiz.js:1:6721',
	},
}

console.table(
	Object.entries(callSites)
		.map(([platform, environments]) =>
			Object.entries(environments).map(([environment, callSite]) => ({
				platform,
				environment,
				prefix: callSiteCommonPathPrefixMatches(callSite)?.groups?.prefix,
				callSite,
			})),
		)
		.flat(),
)

/**/

// Show some info about gg
let ggMessage = `Loaded gg module. To enable logger/debugger output:
${GG_ENABLED ? '✅' : '❌'} In code:    GG_ENABLED = true`

const ggInfo: Record<string, unknown> = {
	GG_ENABLED,
}

if (browser) {
	const debug = (ggInfo['localStorage.debug'] = localStorage?.getItem('debug'))
	ggMessage += `\n${debug ? '✅' : '❌'} In browser: localStorage.debug = '*'`
} else {
	dotenv.config() // Load the environment variables
	const debug = (ggInfo['process.env.DEBUG'] = process?.env?.DEBUG)
	ggMessage += `\n${debug ? '✅' : '❌'} On server:  DEBUG=*'`
}
console.log(ggMessage)

function getStack() {
	// Get stack array
	const savedPrepareStackTrace = Error.prepareStackTrace
	Error.prepareStackTrace = (error, stack) => stack
	const error = new Error()
	let stack = error.stack as unknown as string | CallSite[] | string[]

	if (typeof stack === 'string') {
		stack = stack.split('\n')
	}

	Error.prepareStackTrace = savedPrepareStackTrace
	return stack || []
}

const timestampColumnNumberRegex = /(\?t=\d+)?(:\d+):\d+\)?$/
const swapPathFunctionNameRegex = /([ \][_.\S]+) \((.*)/
const swapPathFunctionNameRegexSafari = /([^@]+)@(.*)/
const lineNumberRegex = /:\d+ ?/

const callSiteCommonPathPrefix =
	callSiteCommonPathPrefixMatches(getStack()[0])?.groups?.prefix || ''

const ggLog = debugFactory('gg')

export function gg(...args: [...unknown[]]) {
	if (!GG_ENABLED) {
		return args[0]
	}

	// Ignore first two stack frames, which are always calls to getstack() and gg().
	const stack = getStack().splice(2)

	const callSite = stack[0].toString() || ''

	const callerCleaned = callSite.replace(timestampColumnNumberRegex, '$2') // Strip timestamp and/or column number.
	const callerSwapped = callerCleaned.includes('@')
		? callerCleaned.replace(swapPathFunctionNameRegexSafari, '$2 $1') // Put path in front of function name.
		: callerCleaned.replace(swapPathFunctionNameRegex, '$2 $1')
	const caller = callerSwapped.replace(callSiteCommonPathPrefix, '').replace(lineNumberRegex, '| ') // Remove base path and line number.

	// console.table({ caller, callerClean, callerSwapped, caller })

	const ggLogCaller = ggLog.extend(caller + ':')
	if (args.length === 0) {
		ggLogCaller(callSite)
		return { caller: callSite, stack }
	}

	ggLogCaller(...(args as [formatter: unknown, ...args: unknown[]]))
	return args[0]
}
