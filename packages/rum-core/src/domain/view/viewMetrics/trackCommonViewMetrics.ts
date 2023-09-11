import type { ClocksState, Duration, Observable } from '@datadog/browser-core'
import { noop } from '@datadog/browser-core'
import type { ViewLoadingType } from '../../../rawRumEvent.types'
import type { RumConfiguration } from '../../configuration'
import type { LifeCycle } from '../../lifeCycle'
import type { WebVitalTelemetryDebug } from '../startWebVitalTelemetryDebug'
import type { ScrollMetrics } from './trackScrollMetrics'
import { computeScrollValues, trackScrollMetrics } from './trackScrollMetrics'
import { trackLoadingTime } from './trackLoadingTime'
import type { CumulativeLayoutShift } from './trackCumulativeLayoutShift'
import { isLayoutShiftSupported, trackCumulativeLayoutShift } from './trackCumulativeLayoutShift'
import type { InteractionToNextPaint } from './trackInteractionToNextPaint'
import { trackInteractionToNextPaint } from './trackInteractionToNextPaint'

export interface CommonViewMetrics {
  loadingTime?: Duration
  cumulativeLayoutShift?: CumulativeLayoutShift
  interactionToNextPaint?: InteractionToNextPaint
  scroll?: ScrollMetrics
}

export function trackCommonViewMetrics(
  lifeCycle: LifeCycle,
  domMutationObservable: Observable<void>,
  configuration: RumConfiguration,
  scheduleViewUpdate: () => void,
  loadingType: ViewLoadingType,
  viewStart: ClocksState,
  webVitalTelemetryDebug: WebVitalTelemetryDebug
) {
  const commonViewMetrics: CommonViewMetrics = {}

  const { stop: stopLoadingTimeTracking, setLoadEvent } = trackLoadingTime(
    lifeCycle,
    domMutationObservable,
    configuration,
    loadingType,
    viewStart,
    (newLoadingTime) => {
      commonViewMetrics.loadingTime = newLoadingTime

      // We compute scroll metrics at loading time to ensure we have scroll data when loading the view initially
      // This is to ensure that we have the depth data even if the user didn't scroll or if the view is not scrollable.
      const { scrollHeight, scrollDepth, scrollTop } = computeScrollValues()

      commonViewMetrics.scroll = {
        maxDepth: scrollDepth,
        maxDepthScrollHeight: scrollHeight,
        maxDepthTime: newLoadingTime,
        maxDepthScrollTop: scrollTop,
      }
      scheduleViewUpdate()
    }
  )

  const { stop: stopScrollMetricsTracking } = trackScrollMetrics(
    configuration,
    viewStart,
    (newScrollMetrics) => {
      commonViewMetrics.scroll = newScrollMetrics
    },
    computeScrollValues
  )

  let stopCLSTracking: () => void
  if (isLayoutShiftSupported()) {
    commonViewMetrics.cumulativeLayoutShift = { value: 0 }
    ;({ stop: stopCLSTracking } = trackCumulativeLayoutShift(
      configuration,
      lifeCycle,
      webVitalTelemetryDebug,
      (cumulativeLayoutShift) => {
        commonViewMetrics.cumulativeLayoutShift = cumulativeLayoutShift
        scheduleViewUpdate()
      }
    ))
  } else {
    stopCLSTracking = noop
  }

  const { stop: stopINPTracking, getInteractionToNextPaint } = trackInteractionToNextPaint(
    configuration,
    loadingType,
    lifeCycle
  )

  return {
    stop: () => {
      stopLoadingTimeTracking()
      stopCLSTracking()
      stopScrollMetricsTracking()
      stopINPTracking()
    },
    setLoadEvent,
    getCommonViewMetrics: () => {
      commonViewMetrics.interactionToNextPaint = getInteractionToNextPaint()
      return commonViewMetrics
    },
  }
}
