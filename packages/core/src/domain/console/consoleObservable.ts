import { computeStackTrace } from '../tracekit'
import { createHandlingStack, formatErrorMessage, toStackTraceString, tryToGetFingerprint } from '../error/error'
import { mergeObservables, Observable } from '../../tools/observable'
import { ConsoleApiName, globalConsole } from '../../tools/display'
import { callMonitored } from '../../tools/monitor'
import { sanitize } from '../../tools/serialisation/sanitize'
import { find } from '../../tools/utils/polyfills'
import { jsonStringify } from '../../tools/serialisation/jsonStringify'
import { instrumentMethod } from '../../tools/instrumentMethod'

export interface ConsoleLog {
  message: string
  api: ConsoleApiName
  stack?: string
  handlingStack?: string
  fingerprint?: string
}

let consoleObservablesByApi: { [k in ConsoleApiName]?: Observable<ConsoleLog> } = {}

export function initConsoleObservable(apis: ConsoleApiName[]) {
  const consoleObservables = apis.map((api) => {
    if (!consoleObservablesByApi[api]) {
      consoleObservablesByApi[api] = createConsoleObservable(api)
    }
    return consoleObservablesByApi[api]!
  })

  return mergeObservables<ConsoleLog>(...consoleObservables)
}

export function resetConsoleObservable() {
  consoleObservablesByApi = {}
}

function createConsoleObservable(api: ConsoleApiName) {
  const observable = new Observable<ConsoleLog>(() => {
    const { stop: stopInstrumentingConsoleApi } = instrumentMethod(
      globalConsole,
      api,
      (originalConsoleApi) =>
        (...params: unknown[]) => {
          originalConsoleApi.apply(console, params)
          const handlingStack = createHandlingStack(1)

          callMonitored(() => {
            observable.notify(buildConsoleLog(params, api, handlingStack))
          })
        }
    )

    return stopInstrumentingConsoleApi
  })

  return observable
}

function buildConsoleLog(params: unknown[], api: ConsoleApiName, handlingStack: string): ConsoleLog {
  const message = params.map((param) => formatConsoleParameters(param)).join(' ')
  let stack
  let fingerprint

  if (api === ConsoleApiName.error) {
    const firstErrorParam = find(params, (param: unknown): param is Error => param instanceof Error)
    stack = firstErrorParam ? toStackTraceString(computeStackTrace(firstErrorParam)) : undefined
    fingerprint = tryToGetFingerprint(firstErrorParam)
  }

  return {
    api,
    message,
    stack,
    handlingStack,
    fingerprint,
  }
}

function formatConsoleParameters(param: unknown) {
  if (typeof param === 'string') {
    return sanitize(param)
  }
  if (param instanceof Error) {
    return formatErrorMessage(computeStackTrace(param))
  }
  return jsonStringify(sanitize(param), undefined, 2)
}
