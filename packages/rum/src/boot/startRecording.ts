import type { RawError, HttpRequest, DeflateEncoder } from '@datadog/browser-core'
import { createHttpRequest, addTelemetryDebug, canUseEventBridge } from '@datadog/browser-core'
import type { LifeCycle, ViewHistory, RumConfiguration, RumSessionManager } from '@datadog/browser-rum-core'
import { LifeCycleEventType } from '@datadog/browser-rum-core'

import { record as defaultRecorder } from '../domain/record'
import { record as rrwebRecorder } from '@rrweb/all'
import { startSegmentCollection, SEGMENT_BYTES_LIMIT } from '../domain/segmentCollection'
import type { BrowserRecord } from '../types'
import { startRecordBridge } from '../domain/startRecordBridge'

export function startRecording(
  lifeCycle: LifeCycle,
  configuration: RumConfiguration,
  sessionManager: RumSessionManager,
  viewHistory: ViewHistory,
  encoder: DeflateEncoder,
  httpRequest?: HttpRequest
) {
  const cleanupTasks: Array<() => void> = []

  const reportError = (error: RawError) => {
    lifeCycle.notify(LifeCycleEventType.RAW_ERROR_COLLECTED, { error })
    addTelemetryDebug('Error reported to customer', { 'error.message': error.message })
  }

  const replayRequest =
    httpRequest || createHttpRequest(configuration.sessionReplayEndpointBuilder, SEGMENT_BYTES_LIMIT, reportError)

  let addRecord: (record: BrowserRecord) => void

  if (!canUseEventBridge()) {
    const segmentCollection = startSegmentCollection(
      lifeCycle,
      configuration,
      sessionManager,
      viewHistory,
      replayRequest,
      encoder
    )
    addRecord = segmentCollection.addRecord
    cleanupTasks.push(segmentCollection.stop)
  } else {
    ;({ addRecord } = startRecordBridge(viewHistory))
  }

  let stopRecording: any

  if (configuration.sessionReplayRecorder === 'rrweb') {
    stopRecording = rrwebRecorder({
      recordCanvas: true, // 是否记录 canvas 内容
      recordCrossOriginIframes: true, //	是否记录 cross origin iframes。 必须在每个子 iframe 中注入 rrweb 才能使其工作
      inlineStylesheet: false, // 是否将样式表内联, 默认为 true, 开启可能会导致页面卡死（样式表过多）
      ...configuration.rrwebOptions,
      // checkoutEveryNth: undefined, // 每 N 次事件重新制作一次全量快照
      // checkoutEveryNms: undefined, // 每 N 毫秒重新制作一次全量快照
      // blockClass: 'rr-block', // 字符串或正则表达式，可用于自定义屏蔽元素的类名
      // blockSelector: undefined, // 所有 element.matches(blockSelector)为 true 的元素都不会被录制，回放时取而代之的是一个同等宽高的占位元素
      // ignoreClass: 'rr-ignore',	// 字符串或正则表达式，可用于自定义忽略元素的类名
      // ignoreCSSAttributes: undefined, //	应该被忽略的 CSS 属性数组
      // maskTextClass:'rr-mask', //	字符串或正则表达式，可用于自定义忽略元素 text 内容的类名
      // maskTextSelector:	undefined, //所有 element.matches(maskTextSelector)为 true 的元素及其子元素的 text 内容将会被屏蔽
      maskAllInputs: ['mask-user-input', 'mask'].includes(configuration.defaultPrivacyLevel), // 将所有输入内容记录为 *
      // maskInputOptions:	{ password: true }, // 选择将特定类型的输入框内容记录为 *
      // maskInputFn: undefined,	// 自定义特定类型的输入框内容记录逻辑
      // maskTextFn: undefined, // 自定义文字内容的记录逻辑
      // slimDOMOptions:	{}, // 去除 DOM 中不必要的部分
      // hooks: {}, //	各类事件的回调
      // packFn: undefined, // 数据压缩函数
      // sampling: undefined, //	数据抽样策略
      // dataURLOptions: {},	// Canvas 图像快照的格式和质量, 这个参数将传递给 OffscreenCanvas.convertToBlob()，使用这个参数能有效减小录制数据的大小
      // recordAfter: 'load', // 如果 document 还没有加载完成，recorder 将会在指定的事件触发后开始录制。可用选项： DOMContentLoaded, load
      // inlineImages:	false, //	是否将图片内容记内联录制
      // collectFonts:	false, //	是否记录页面中的字体文件
      // userTriggeredOnInput: false, // userTriggeredOnInput
      // plugins: [], //	加载插件以获得额外的录制功能
      // errorHandler: undefined, // - 一个可以定制化处理错误的回调函数，它的参数是错误对象。如果 rrweb recorder 内部的某些内容抛出错误，则会调用该回调。
      emit: addRecord, // emit 不能被覆盖
    });
  } else {
    ; ({ stop: stopRecording } = defaultRecorder({
      emit: addRecord,
      configuration,
      lifeCycle,
      viewHistory,
    }))
  }
  
  cleanupTasks.push(stopRecording as () => void)

  return {
    stop: () => {
      cleanupTasks.forEach((task) => task())
    },
  }
}
