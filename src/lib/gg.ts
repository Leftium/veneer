import * as dotenv from 'dotenv'

import debugFactory from 'debug'
import StackTrace from 'stacktrace-js'

import { browser } from '$app/environment'

const ggConfig = {
	enabled: true,
	showPrefixTest: false,
	showStatusAndTroubleShootingMessageOnLoad: true,
	sourceRootMatcher: /.*?(\/(?<name>src|chunks)\/)/i,
	openInEditorUrl: function (fileName: string) {
		return `http://localhost:5173/__open?file=${encodeURIComponent(fileName)}`
		// return `http://localhost:5173/__open-in-editor?file=${encodeURIComponent(fileName)}`
	},
}

const ggLog = debugFactory('gg')

if (ggConfig.showStatusAndTroubleShootingMessageOnLoad) {
	const ggLogTest = ggLog.extend('TEST')

	let ggMessage =
		`Loaded gg module. To enable logger/debugger output:\n` +
		`${ggConfig.enabled ? '✅' : '❌'} ggConfig.enabled: ${ggConfig.enabled}`

	if (!ggConfig.enabled) {
		ggMessage += ' (Update value in gg.ts file.)'
	}

	const suggestedValue = ggLogTest.enabled ? '' : ` (Try setting to 'gg:*')`

	if (browser) {
		ggMessage += `\n${ggLogTest.enabled ? '✅' : '❌'} localStorage.debug: ${localStorage?.debug}${suggestedValue}`
		ggMessage += `\nℹ️ "Verbose" log level must be enabled (in the devtools JS console).`
	} else {
		dotenv.config() // Load the environment variables
		ggMessage += `\n${ggLogTest.enabled ? '✅' : '❌'} DEBUG env variable: ${process?.env?.DEBUG}${suggestedValue}`
	}
	console.log(ggMessage)
}

const callerToLogger = new Map()

const timestampRegex = /(\?t=\d+)?$/

export function gg(...args: [...unknown[]]) {
	if (!ggConfig.enabled) {
		return args[0]
	}

	// Ignore first stack frame, which is always call to gg().
	const stack = StackTrace.getSync().splice(1)

	const stackframe = stack[0]
	const fileNameTimeStampStripped = stackframe.fileName?.replace(timestampRegex, '') || ''
	const fileNameWithRoot = fileNameTimeStampStripped.replace(ggConfig.sourceRootMatcher, '$<name>/')
	const fileNameShort = fileNameWithRoot.replace(ggConfig.sourceRootMatcher, '')

	const caller = `${fileNameShort}@${stackframe.functionName}`
	const ggLogCaller =
		callerToLogger.get(caller) || callerToLogger.set(caller, ggLog.extend(caller)).get(caller)

	if (args.length === 0) {
		ggLogCaller(ggConfig.openInEditorUrl(fileNameWithRoot))
		return stack
	}

	ggLogCaller(...(args as [formatter: unknown, ...args: unknown[]]))
	return args[0]
}

gg.disable = debugFactory.disable
gg.enable = debugFactory.enable
