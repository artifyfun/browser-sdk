import {
  noop,
  type Duration,
  type RelativeTime,
  resetExperimentalFeatures,
  ExperimentalFeature,
  addExperimentalFeatures,
} from '@datadog/browser-core'
import { restorePageVisibility, setPageVisibility } from '@datadog/browser-core/test'
import type { RumFirstInputTiming } from '../../../../browser/performanceCollection'
import type { TestSetupBuilder } from '../../../../../test'
import { setup } from '../../../../../test'
import type { LifeCycle } from '../../../lifeCycle'
import { LifeCycleEventType } from '../../../lifeCycle'
import type { RumConfiguration } from '../../../configuration'
import { resetFirstHidden } from './trackFirstHidden'
import { trackFirstInputTimings } from './trackFirstInputTimings'

describe('firstInputTimings', () => {
  let setupBuilder: TestSetupBuilder
  let fitCallback: jasmine.Spy<
    ({
      firstInputDelay,
      firstInputTime,
      firstInputTargetSelector,
    }: {
      firstInputDelay: number
      firstInputTime: number
      firstInputTargetSelector?: string
    }) => void
  >
  let configuration: RumConfiguration
  let target: HTMLButtonElement

  function newFirstInput(lifeCycle: LifeCycle, overrides?: Partial<RumFirstInputTiming>) {
    lifeCycle.notify(LifeCycleEventType.PERFORMANCE_ENTRIES_COLLECTED, [
      {
        entryType: 'first-input',
        processingStart: 1100 as RelativeTime,
        startTime: 1000 as RelativeTime,
        duration: 0 as Duration,
        target,
        ...overrides,
      },
    ])
  }

  beforeEach(() => {
    configuration = {} as RumConfiguration
    fitCallback = jasmine.createSpy()

    target = document.createElement('button')
    target.setAttribute('id', 'fid-target-element')
    document.body.appendChild(target)

    setupBuilder = setup().beforeBuild(({ lifeCycle }) =>
      trackFirstInputTimings(lifeCycle, configuration, { addWebVitalTelemetryDebug: noop }, fitCallback)
    )
    resetFirstHidden()
  })

  afterEach(() => {
    setupBuilder.cleanup()
    target.parentNode!.removeChild(target)
    restorePageVisibility()
    resetFirstHidden()
    resetExperimentalFeatures()
  })

  it('should provide the first input timings', () => {
    const { lifeCycle } = setupBuilder.build()

    newFirstInput(lifeCycle)

    expect(fitCallback).toHaveBeenCalledTimes(1)
    expect(fitCallback).toHaveBeenCalledWith({
      firstInputDelay: 100,
      firstInputTime: 1000,
      firstInputTargetSelector: undefined,
    })
  })

  it('should provide the first input target selector if FF enabled', () => {
    addExperimentalFeatures([ExperimentalFeature.WEB_VITALS_ATTRIBUTION])
    const { lifeCycle } = setupBuilder.build()

    newFirstInput(lifeCycle)

    expect(fitCallback).toHaveBeenCalledTimes(1)
    expect(fitCallback).toHaveBeenCalledWith(
      jasmine.objectContaining({
        firstInputTargetSelector: '#fid-target-element',
      })
    )
  })

  it('should be discarded if the page is hidden', () => {
    setPageVisibility('hidden')
    const { lifeCycle } = setupBuilder.build()

    newFirstInput(lifeCycle)

    expect(fitCallback).not.toHaveBeenCalled()
  })

  it('should be adjusted to 0 if the computed value would be negative due to browser timings imprecisions', () => {
    const { lifeCycle } = setupBuilder.build()

    newFirstInput(lifeCycle, {
      entryType: 'first-input' as const,
      processingStart: 900 as RelativeTime,
      startTime: 1000 as RelativeTime,
      duration: 0 as Duration,
    })

    expect(fitCallback).toHaveBeenCalledTimes(1)
    expect(fitCallback).toHaveBeenCalledWith(
      jasmine.objectContaining({
        firstInputDelay: 0,
        firstInputTime: 1000,
      })
    )
  })
})
