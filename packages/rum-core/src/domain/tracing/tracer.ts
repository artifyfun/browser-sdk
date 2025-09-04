import {
  objectEntries,
  shallowClone,
  performDraw,
  isNumber,
  assign,
  find,
  getType,
  isMatchOption,
  matchList,
  TraceContextInjection,
} from '@datadog/browser-core'
import type { RumConfiguration } from '../configuration'
import type {
  RumFetchResolveContext,
  RumFetchStartContext,
  RumXhrCompleteContext,
  RumXhrStartContext,
} from '../requestCollection'
import type { RumSessionManager } from '../rumSessionManager'
import type { PropagatorType, TracingOption } from './tracer.types'

// 兼容IE的URL解析函数
function parseURL(url: string) {
  // 创建一个锚元素来解析URL
  var parser = document.createElement('a');

  if (url.indexOf('http://') === 0 || url.indexOf('https://') === 0) {
    parser.href = url;
  } else if (url.indexOf('//') === 0) {
    parser.href = window.location.protocol + url;
  } else {
    parser.href = window.location.href;
    // 处理路径名
    var basePath = window.location.pathname;
    var lastSlashIndex = basePath.lastIndexOf('/');
    if (lastSlashIndex >= 0) {
      basePath = basePath.substring(0, lastSlashIndex + 1);
    }
    parser.href = window.location.origin + basePath + url;
  }

  return {
    protocol: parser.protocol,
    host: parser.host,
    hostname: parser.hostname,
    port: parser.port,
    pathname: parser.pathname,
    search: parser.search,
    hash: parser.hash
  };
}

export interface Tracer {
  traceFetch: (context: Partial<RumFetchStartContext>) => void
  traceXhr: (context: Partial<RumXhrStartContext>, xhr: XMLHttpRequest) => void
  clearTracingIfNeeded: (context: RumFetchResolveContext | RumXhrCompleteContext) => void
}

interface TracingHeaders {
  [key: string]: string
}

export function isTracingOption(item: unknown): item is TracingOption {
  const expectedItem = item as TracingOption
  return (
    getType(expectedItem) === 'object' &&
    isMatchOption(expectedItem.match) &&
    Array.isArray(expectedItem.propagatorTypes)
  )
}

/**
 * Clear tracing information to avoid incomplete traces. Ideally, we should do it when the
 * request did not reach the server, but the browser does not expose this. So, we clear tracing
 * information if the request ended with status 0 without being aborted by the application.
 *
 * Reasoning:
 *
 * * Applications are usually aborting requests after a bit of time, for example when the user is
 * typing (autocompletion) or navigating away (in a SPA). With a performant device and good
 * network conditions, the request is likely to reach the server before being canceled.
 *
 * * Requests aborted otherwise (ex: lack of internet, CORS issue, blocked by a privacy extension)
 * are likely to finish quickly and without reaching the server.
 *
 * Of course, it might not be the case every time, but it should limit having incomplete traces a
 * bit.
 * */
export function clearTracingIfNeeded(context: RumFetchResolveContext | RumXhrCompleteContext) {
  if (context.status === 0 && !context.isAborted) {
    context.traceId = undefined
    context.spanId = undefined
    context.traceSampled = undefined
  }
}

export function startTracer(configuration: RumConfiguration, sessionManager: RumSessionManager): Tracer {
  return {
    clearTracingIfNeeded,
    traceFetch: (context) =>
      injectHeadersIfTracingAllowed(configuration, context, sessionManager, (tracingHeaders: TracingHeaders) => {
        if (context.input instanceof Request && !context.init?.headers) {
          context.input = new Request(context.input)
          Object.keys(tracingHeaders).forEach((key) => {
            ;(context.input as Request).headers.append(key, tracingHeaders[key])
          })
        } else {
          context.init = shallowClone(context.init)
          const headers: Array<[string, string]> = []
          if (context.init.headers instanceof Headers) {
            context.init.headers.forEach((value, key) => {
              headers.push([key, value])
            })
          } else if (Array.isArray(context.init.headers)) {
            context.init.headers.forEach((header) => {
              headers.push(header)
            })
          } else if (context.init.headers) {
            Object.keys(context.init.headers).forEach((key) => {
              headers.push([key, (context.init!.headers as Record<string, string>)[key]])
            })
          }
          context.init.headers = headers.concat(objectEntries(tracingHeaders))
        }
      }),
    traceXhr: (context, xhr) =>
      injectHeadersIfTracingAllowed(configuration, context, sessionManager, (tracingHeaders: TracingHeaders) => {
        Object.keys(tracingHeaders).forEach((name) => {
          xhr.setRequestHeader(name, tracingHeaders[name])
        })
      }),
  }
}

function injectHeadersIfTracingAllowed(
  configuration: RumConfiguration,
  context: Partial<RumFetchStartContext | RumXhrStartContext>,
  sessionManager: RumSessionManager,
  inject: (tracingHeaders: TracingHeaders) => void
) {
  if (!isTracingSupported() || !sessionManager.findTrackedSession()) {
    return
  }

  const tracingOption = find(configuration.allowedTracingUrls, (tracingOption: TracingOption) =>
    matchList([tracingOption.match], context.url!, true)
  )
  if (!tracingOption) {
    return
  }
  context.traceSampled = !isNumber(configuration.traceSampleRate) || performDraw(configuration.traceSampleRate)

  if (!context.traceSampled && configuration.traceContextInjection !== TraceContextInjection.ALL) {
    return
  }

  context.traceId = createTraceIdentifier()
  context.spanId = createTraceIdentifier()

  inject(makeTracingHeaders(context, configuration, tracingOption.propagatorTypes))
}

export function isTracingSupported() {
  return getCrypto() !== undefined
}

export function getCrypto() {
  return window.crypto || (window as any).msCrypto
}

/**
 * When trace is not sampled, set priority to '0' instead of not adding the tracing headers
 * to prepare the implementation for sampling delegation.
 */
function makeTracingHeaders(
  context: any,
  configuration: RumConfiguration,
  propagatorTypes: PropagatorType[]
): TracingHeaders {
  const {
    traceId,
    spanId,
    traceSampled,
    url
  } = context
  const tracingHeaders: TracingHeaders = {}

  propagatorTypes.forEach((propagatorType) => {
    switch (propagatorType) {
      case 'datadog':
      case 'shsnc': {
        assign(tracingHeaders, {
          'x-shsnc-origin': 'rum',
          'x-shsnc-parent-id': spanId.toDecimalString(),
          'x-shsnc-sampling-priority': traceSampled ? '1' : '0',
          'x-shsnc-trace-id': traceId.toDecimalString(),
        })
        break
      }
      // https://www.w3.org/TR/trace-context/
      case 'tracecontext': {
        assign(tracingHeaders, {
          traceparent: `00-0000000000000000${traceId.toPaddedHexadecimalString()}-${spanId.toPaddedHexadecimalString()}-0${
            traceSampled ? '1' : '0'
          }`,
        })
        break
      }
      // https://github.com/openzipkin/b3-propagation
      case 'b3': {
        assign(tracingHeaders, {
          b3: `${traceId.toPaddedHexadecimalString()}-${spanId.toPaddedHexadecimalString()}-${
            traceSampled ? '1' : '0'
          }`,
        })
        break
      }
      case 'b3multi': {
        assign(tracingHeaders, {
          'X-B3-TraceId': traceId.toPaddedHexadecimalString(),
          'X-B3-SpanId': spanId.toPaddedHexadecimalString(),
          'X-B3-Sampled': traceSampled ? '1' : '0',
        })
        break
      }
      case 'sw8': {
        let uri = {} as any;
        if (url.indexOf('http://') === 0 || url.indexOf('https://') === 0) {
          uri = parseURL(url);
        } else if (url.indexOf('//') === 0) {
          uri = parseURL(window.location.protocol + url);
        } else {
          uri = parseURL(window.location.href);
          uri.pathname = url;
        }
        const traceIdStr = String(window.btoa(traceId.toDecimalString()));
        const segmentId = String(window.btoa(spanId.toDecimalString()));
        const service = String(window.btoa(configuration.service || 'undefined'));
        const instance = String(window.btoa(configuration.version || 'undefined'));
        const endpoint = String(window.btoa(uri.pathname));
        const peer = String(window.btoa(uri.host));
        const index = 0;
        const values = (traceSampled ? '1' : '0') + '-' + traceIdStr + '-' + segmentId + '-' +
          index + '-' + service + '-' + instance + '-' + endpoint + '-' + peer;
        assign(tracingHeaders, {
          'sw8': values
        })
        break
      }
    }
  })
  return tracingHeaders
}

/* eslint-disable no-bitwise */
export interface TraceIdentifier {
  toDecimalString: () => string
  toPaddedHexadecimalString: () => string
}

export function createTraceIdentifier(): TraceIdentifier {
  var isIE = !!(window as any).MSInputMethodContext && !!(window as any).documentMode;
  const crypto = getCrypto()
  let buffer: Uint8Array | Int32Array

  // IE11兼容性处理
  if (isIE && crypto === (window as any).msCrypto) {
    // IE11只支持Int32Array
    const int32Buffer = new Int32Array(2) // 8字节 = 2个int32
    crypto.getRandomValues(int32Buffer)

    // 转换为Uint8Array格式
    buffer = new Uint8Array(8)
    const view = new DataView(int32Buffer.buffer)
    for (let i = 0; i < 8; i++) {
      buffer[i] = view.getUint8(i)
    }
  } else {
    // 现代浏览器
    buffer = new Uint8Array(8)
    crypto.getRandomValues(buffer)
  }

  buffer[0] = buffer[0] & 0x7f // force 63-bit

  function readInt32(offset: number) {
    return buffer[offset] * 16777216 + (buffer[offset + 1] << 16) + (buffer[offset + 2] << 8) + buffer[offset + 3]
  }

  function toString(radix: number) {
    let high = readInt32(0)
    let low = readInt32(4)
    let str = ''

    do {
      const mod = (high % radix) * 4294967296 + low
      high = Math.floor(high / radix)
      low = Math.floor(mod / radix)
      str = (mod % radix).toString(radix) + str
    } while (high || low)

    return str
  }

  /**
   * Format used everywhere except the trace intake
   */
  function toDecimalString() {
    return toString(10)
  }

  /**
   * Format used by OTel headers
   */
  function toPaddedHexadecimalString() {
    const traceId = toString(16)
    return Array(17 - traceId.length).join('0') + traceId
  }

  return {
    toDecimalString,
    toPaddedHexadecimalString,
  }
}
/* eslint-enable no-bitwise */
