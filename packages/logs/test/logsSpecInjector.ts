import { stubEndpointBuilder, registerCleanupTask } from '@datadog/browser-core/test'
import type { Component, Injector } from '@datadog/browser-core'
import { createLogsInjector } from '../src/boot/logsInjector'
import type { LogsConfiguration } from '../src/domain/configuration'
import { getLogsConfiguration, validateAndBuildLogsConfiguration } from '../src/domain/configuration'
import type { RawLogsEventCollectedData, LifeCycle } from '../src/domain/lifeCycle'
import { LifeCycleEventType, startLogsLifeCycle } from '../src/domain/lifeCycle'

export interface LogsSpecInjector extends Injector {
  withConfiguration(configuration: Partial<LogsConfiguration>): void
}

export function createLogsSpecInjector(): LogsSpecInjector {
  const initConfiguration = { clientToken: 'xxx', service: 'service', telemetrySampleRate: 0 }
  const baseConfiguration = {
    ...validateAndBuildLogsConfiguration(initConfiguration)!,
    logsEndpointBuilder: stubEndpointBuilder('https://localhost/v1/input/log'),
    batchMessagesLimit: 1,
  }
  const commonContext = {
    view: { referrer: 'common_referrer', url: 'common_url' },
    context: {},
    user: {},
  }
  const injector = createLogsInjector(initConfiguration, baseConfiguration, () => commonContext)
  registerCleanupTask(() => injector.stop())

  return {
    ...injector,
    withConfiguration: (configuration: Partial<LogsConfiguration>) =>
      injector.override(getLogsConfiguration, () => ({ ...baseConfiguration, ...configuration })),
  }
}

export const startRawLogEvents: Component<RawLogsEventCollectedData[], [LifeCycle]> = (lifeCycle) => {
  const rawLogsEvents: RawLogsEventCollectedData[] = []
  lifeCycle.subscribe(LifeCycleEventType.RAW_LOG_COLLECTED, (rawLogsEvent) => rawLogsEvents.push(rawLogsEvent))
  return rawLogsEvents
}
/* eslint-disable local-rules/disallow-side-effects */
startRawLogEvents.$deps = [startLogsLifeCycle]
/* eslint-enable local-rules/disallow-side-effects */
