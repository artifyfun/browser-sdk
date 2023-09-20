import type { RelativeTime, Duration } from '@datadog/browser-core'
import { addDuration, clocksNow } from '@datadog/browser-core'
import { ViewLoadingType } from '../../../rawRumEvent.types'
import type { TestSetupBuilder } from '../../../../test'
import { createPerformanceEntry, setup } from '../../../../test'
import { RumPerformanceEntryType } from '../../../browser/performanceCollection'
import { PAGE_ACTIVITY_END_DELAY, PAGE_ACTIVITY_VALIDATION_DELAY } from '../../waitPageActivityEnd'
import { THROTTLE_VIEW_UPDATE_PERIOD } from '../trackViews'
import { LifeCycleEventType } from '../../lifeCycle'
import { trackLoadingTime } from './trackLoadingTime'

const BEFORE_PAGE_ACTIVITY_VALIDATION_DELAY = (PAGE_ACTIVITY_VALIDATION_DELAY * 0.8) as Duration

const AFTER_PAGE_ACTIVITY_END_DELAY = PAGE_ACTIVITY_END_DELAY * 1.1

const LOAD_EVENT_BEFORE_ACTIVITY_TIMING = (BEFORE_PAGE_ACTIVITY_VALIDATION_DELAY * 0.8) as RelativeTime

const LOAD_EVENT_AFTER_ACTIVITY_TIMING = (BEFORE_PAGE_ACTIVITY_VALIDATION_DELAY * 1.2) as RelativeTime

describe('trackLoadingTime', () => {
  let setupBuilder: TestSetupBuilder
  let loadingTimeCallback: jasmine.Spy<(loadingTime: Duration) => void>
  let loadType: ViewLoadingType
  let setLoadEvent: (loadEvent: Duration) => void

  beforeEach(() => {
    loadType = ViewLoadingType.ROUTE_CHANGE
    loadingTimeCallback = jasmine.createSpy('loadingTimeCallback')
    setupBuilder = setup()
      .beforeBuild(({ lifeCycle, domMutationObservable, configuration }) => {
        const loadingTimeTracking = trackLoadingTime(
          lifeCycle,
          domMutationObservable,
          configuration,
          loadType,
          clocksNow(),
          loadingTimeCallback
        )
        setLoadEvent = loadingTimeTracking.setLoadEvent
        return loadingTimeTracking
      })
      .withFakeClock()
  })

  afterEach(() => {
    setupBuilder.cleanup()
  })

  it('should have an undefined loading time if there is no activity on a route change', () => {
    setupBuilder.build()

    expect(loadingTimeCallback).not.toHaveBeenCalled()
  })

  it('should have a loading time equal to the activity time if there is a unique activity on a route change', () => {
    const { domMutationObservable, clock } = setupBuilder.build()

    clock.tick(BEFORE_PAGE_ACTIVITY_VALIDATION_DELAY)
    domMutationObservable.notify()
    clock.tick(AFTER_PAGE_ACTIVITY_END_DELAY)

    expect(loadingTimeCallback).toHaveBeenCalledTimes(1)
    expect(loadingTimeCallback).toHaveBeenCalledWith(BEFORE_PAGE_ACTIVITY_VALIDATION_DELAY)
  })

  it('should use loadEventEnd for initial view when having no activity', () => {
    loadType = ViewLoadingType.INITIAL_LOAD
    const { clock, lifeCycle } = setupBuilder.build()

    const entry = createPerformanceEntry(RumPerformanceEntryType.NAVIGATION)
    lifeCycle.notify(LifeCycleEventType.PERFORMANCE_ENTRIES_COLLECTED, [entry])
    clock.tick(PAGE_ACTIVITY_END_DELAY)

    expect(loadingTimeCallback).toHaveBeenCalledOnceWith(entry.loadEventEnd)
  })

  it('should use loadEventEnd for initial view when load event is bigger than computed loading time', () => {
    loadType = ViewLoadingType.INITIAL_LOAD
    const { domMutationObservable, clock } = setupBuilder.build()

    clock.tick(BEFORE_PAGE_ACTIVITY_VALIDATION_DELAY)
    setLoadEvent(LOAD_EVENT_AFTER_ACTIVITY_TIMING)
    domMutationObservable.notify()
    clock.tick(AFTER_PAGE_ACTIVITY_END_DELAY)

    expect(loadingTimeCallback).toHaveBeenCalledTimes(1)
    expect(loadingTimeCallback).toHaveBeenCalledWith(LOAD_EVENT_AFTER_ACTIVITY_TIMING)
  })

  it('should use computed loading time for initial view when load event is smaller than computed loading time', () => {
    loadType = ViewLoadingType.INITIAL_LOAD
    const { domMutationObservable, clock } = setupBuilder.build()

    clock.tick(BEFORE_PAGE_ACTIVITY_VALIDATION_DELAY)
    setLoadEvent(LOAD_EVENT_BEFORE_ACTIVITY_TIMING)
    domMutationObservable.notify()
    clock.tick(AFTER_PAGE_ACTIVITY_END_DELAY)

    expect(loadingTimeCallback).toHaveBeenCalledTimes(1)
    expect(loadingTimeCallback).toHaveBeenCalledWith(BEFORE_PAGE_ACTIVITY_VALIDATION_DELAY)
  })

  it('should use computed loading time from time origin for initial view', () => {
    loadType = ViewLoadingType.INITIAL_LOAD
    const { domMutationObservable, clock } = setupBuilder.build()

    // introduce a gap between time origin and tracking start
    // ensure that `load event > activity delay` and `load event < activity delay + clock gap`
    // to make the test fail if the clock gap is not correctly taken into account
    const CLOCK_GAP = (LOAD_EVENT_AFTER_ACTIVITY_TIMING - BEFORE_PAGE_ACTIVITY_VALIDATION_DELAY + 1) as Duration

    clock.tick(CLOCK_GAP)

    clock.tick(BEFORE_PAGE_ACTIVITY_VALIDATION_DELAY)

    setLoadEvent(LOAD_EVENT_BEFORE_ACTIVITY_TIMING)

    domMutationObservable.notify()
    clock.tick(AFTER_PAGE_ACTIVITY_END_DELAY)
    clock.tick(THROTTLE_VIEW_UPDATE_PERIOD)

    expect(loadingTimeCallback).toHaveBeenCalledTimes(1)
    expect(loadingTimeCallback).toHaveBeenCalledWith(addDuration(BEFORE_PAGE_ACTIVITY_VALIDATION_DELAY, CLOCK_GAP))
  })
})
