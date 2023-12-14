import type { RelativeTime, ContextValue, Context, CustomerDataTracker } from '@datadog/browser-core'
import {
  noop,
  isExperimentalFeatureEnabled,
  SESSION_TIME_OUT_DELAY,
  ValueHistory,
  ExperimentalFeature,
} from '@datadog/browser-core'
import type { LifeCycle } from '../lifeCycle'
import { LifeCycleEventType } from '../lifeCycle'

export const FEATURE_FLAG_CONTEXT_TIME_OUT_DELAY = SESSION_TIME_OUT_DELAY
export const BYTES_COMPUTATION_THROTTLING_DELAY = 200

export type FeatureFlagContext = Context

export interface FeatureFlagContexts {
  findFeatureFlagEvaluations: (startTime?: RelativeTime) => FeatureFlagContext | undefined
  getFeatureFlagBytesCount: () => number
  addFeatureFlagEvaluation: (key: string, value: ContextValue) => void
  stop: () => void
}

/**
 * Start feature flag contexts
 *
 * Feature flag contexts follow the life of views.
 * A new context is added when a view is created and ended when the view is ended
 *
 * Note: we choose not to add a new context at each evaluation to save memory
 */
export function startFeatureFlagContexts(
  lifeCycle: LifeCycle,
  customerDataTracker: CustomerDataTracker
): FeatureFlagContexts {
  if (!isExperimentalFeatureEnabled(ExperimentalFeature.FEATURE_FLAGS)) {
    return {
      findFeatureFlagEvaluations: () => undefined,
      getFeatureFlagBytesCount: () => 0,
      addFeatureFlagEvaluation: noop,
      stop: noop,
    }
  }

  const featureFlagContexts = new ValueHistory<FeatureFlagContext>(FEATURE_FLAG_CONTEXT_TIME_OUT_DELAY)

  lifeCycle.subscribe(LifeCycleEventType.VIEW_ENDED, ({ endClocks }) => {
    featureFlagContexts.closeActive(endClocks.relative)
  })

  lifeCycle.subscribe(LifeCycleEventType.VIEW_CREATED, ({ startClocks }) => {
    featureFlagContexts.add({}, startClocks.relative)
    customerDataTracker.resetCustomerData()
  })

  return {
    findFeatureFlagEvaluations: (startTime?: RelativeTime) => featureFlagContexts.find(startTime),
    getFeatureFlagBytesCount: () => {
      const currentContext = featureFlagContexts.find()
      if (!currentContext) {
        return 0
      }

      return customerDataTracker.getBytesCount()
    },
    addFeatureFlagEvaluation: (key: string, value: ContextValue) => {
      const currentContext = featureFlagContexts.find()
      if (currentContext) {
        currentContext[key] = value
        customerDataTracker.updateCustomerData(currentContext)
      }
    },
    stop: () => customerDataTracker.stop(),
  }
}
