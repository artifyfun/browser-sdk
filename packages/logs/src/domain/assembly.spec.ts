import type { Context, RelativeTime, TimeStamp } from '@datadog/browser-core'
import {
  Observable,
  ErrorSource,
  ONE_MINUTE,
  getTimeStamp,
  noop,
  createCustomerDataTracker,
} from '@datadog/browser-core'
import type { Clock } from '@datadog/browser-core/test'
import { mockClock } from '@datadog/browser-core/test'
import type { LogsEvent } from '../logsEvent.types'
import type { CommonContext } from '../rawLogsEvent.types'
import { startLogsAssembly } from './assembly'
import type { LogsConfiguration } from './configuration'
import { validateAndBuildLogsConfiguration } from './configuration'
import { Logger } from './logger'
import { StatusType } from './logger/isAuthorized'
import type { LogsSessionManager } from './logsSessionManager'
import { LifeCycle, LifeCycleEventType } from './lifeCycle'

const initConfiguration = { clientToken: 'xxx', service: 'service' }
const SESSION_ID = 'session-id'
const DEFAULT_MESSAGE = {
  status: StatusType.info,
  message: 'message',
  origin: ErrorSource.LOGGER,
  date: 123456 as TimeStamp,
}
const COMMON_CONTEXT: CommonContext = {
  view: {
    referrer: 'referrer_from_common_context',
    url: 'url_from_common_context',
  },
  context: { common_context_key: 'common_context_value' },
  user: {},
}

const COMMON_CONTEXT_WITH_USER: CommonContext = {
  ...COMMON_CONTEXT,
  user: { id: 'id', name: 'name', email: 'test@test.com' },
}

describe('startLogsAssembly', () => {
  const sessionManager: LogsSessionManager = {
    findTrackedSession: (_startTime, options) =>
      (sessionIsActive && sessionIsTracked) || options?.returnInactive
        ? { id: sessionIsTracked ? SESSION_ID : undefined }
        : undefined,
    expireObservable: new Observable(),
  }

  let beforeSend: (event: LogsEvent) => void | boolean
  let sessionIsActive: boolean
  let sessionIsTracked: boolean
  let lifeCycle: LifeCycle
  let configuration: LogsConfiguration
  let serverLogs: Array<LogsEvent & Context> = []
  let mainLogger: Logger

  beforeEach(() => {
    sessionIsTracked = true
    sessionIsActive = true
    lifeCycle = new LifeCycle()
    lifeCycle.subscribe(LifeCycleEventType.LOG_COLLECTED, (serverRumEvent) => serverLogs.push(serverRumEvent))
    configuration = {
      ...validateAndBuildLogsConfiguration({ ...initConfiguration })!,
      beforeSend: (x: LogsEvent) => beforeSend(x),
    }
    beforeSend = noop
    mainLogger = new Logger(() => noop, createCustomerDataTracker(noop))
    startLogsAssembly(sessionManager, configuration, lifeCycle, () => COMMON_CONTEXT, noop)
    window.DD_RUM = {
      getInternalContext: noop,
    }
  })

  afterEach(() => {
    delete window.DD_RUM
    serverLogs = []
  })

  it('should send if beforeSend returned true', () => {
    beforeSend = () => true
    lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
      rawLogsEvent: DEFAULT_MESSAGE,
    })
    expect(serverLogs.length).toEqual(1)
  })

  it('should send if beforeSend returned undefined', () => {
    beforeSend = () => undefined
    lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
      rawLogsEvent: DEFAULT_MESSAGE,
    })
    expect(serverLogs.length).toEqual(1)
  })

  it('should not send if beforeSend returned false', () => {
    beforeSend = () => false
    lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
      rawLogsEvent: DEFAULT_MESSAGE,
    })
    expect(serverLogs.length).toEqual(0)
  })

  describe('event generation condition', () => {
    it('should not send if session is not tracked', () => {
      sessionIsTracked = false
      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
        rawLogsEvent: DEFAULT_MESSAGE,
      })
      expect(serverLogs.length).toEqual(0)
    })

    it('should send log with session id if session is active', () => {
      sessionIsTracked = true
      sessionIsActive = true
      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
        rawLogsEvent: DEFAULT_MESSAGE,
      })
      expect(serverLogs.length).toEqual(1)
      expect(serverLogs[0].session_id).toEqual(SESSION_ID)
    })

    it('should send log without session id if session has expired', () => {
      startLogsAssembly(
        sessionManager,
        { ...configuration, sendLogsAfterSessionExpiration: true },
        lifeCycle,
        () => COMMON_CONTEXT,
        noop
      )

      sessionIsTracked = true
      sessionIsActive = false

      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
        rawLogsEvent: DEFAULT_MESSAGE,
      })
      expect(serverLogs.length).toEqual(1)
      expect(serverLogs[0].session_id).toBeUndefined()
    })

    it('should enable/disable the sending when the tracking type change', () => {
      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
        rawLogsEvent: DEFAULT_MESSAGE,
      })
      expect(serverLogs.length).toEqual(1)

      sessionIsTracked = false
      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
        rawLogsEvent: DEFAULT_MESSAGE,
      })
      expect(serverLogs.length).toEqual(1)

      sessionIsTracked = true
      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
        rawLogsEvent: DEFAULT_MESSAGE,
      })
      expect(serverLogs.length).toEqual(2)
    })
  })

  describe('contexts inclusion', () => {
    it('should include message context', () => {
      spyOn(window.DD_RUM!, 'getInternalContext').and.returnValue({
        view: { url: 'http://from-rum-context.com', id: 'view-id' },
      })

      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
        rawLogsEvent: DEFAULT_MESSAGE,
        messageContext: { foo: 'from-message-context' },
      })

      expect(serverLogs[0].foo).toEqual('from-message-context')
    })

    it('should include common context', () => {
      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, { rawLogsEvent: DEFAULT_MESSAGE })

      expect(serverLogs[0]).toEqual(
        jasmine.objectContaining({
          view: COMMON_CONTEXT.view,
          ...COMMON_CONTEXT.context,
        })
      )
    })

    it('should include saved common context instead of common context when present', () => {
      const savedCommonContext = {
        view: {
          referrer: 'referrer_from_saved_common_context',
          url: 'url_from_saved_common_context',
        },
        context: { foo: 'bar' },
        user: { email: 'test@test.com' },
      }
      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, { rawLogsEvent: DEFAULT_MESSAGE, savedCommonContext })

      expect(serverLogs[0]).toEqual(
        jasmine.objectContaining({
          view: savedCommonContext.view,
          ...savedCommonContext.context,
        })
      )
      expect(serverLogs[0].common_context_key).toBeUndefined()
    })

    it('should not include main logger context', () => {
      mainLogger.setContext({ foo: 'from-main-logger' })
      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, { rawLogsEvent: DEFAULT_MESSAGE })

      expect(serverLogs[0].foo).toBeUndefined()
    })

    it('should include rum internal context related to the error time', () => {
      window.DD_RUM = {
        getInternalContext(startTime) {
          return { foo: startTime === 1234 ? 'b' : 'a' }
        },
      }

      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
        rawLogsEvent: { ...DEFAULT_MESSAGE, date: getTimeStamp(1234 as RelativeTime) },
      })

      expect(serverLogs[0].foo).toBe('b')
    })

    it('should include RUM context', () => {
      window.DD_RUM = {
        getInternalContext() {
          return { view: { url: 'http://from-rum-context.com', id: 'view-id' } }
        },
      }

      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, { rawLogsEvent: DEFAULT_MESSAGE })

      expect(serverLogs[0].view).toEqual({
        id: 'view-id',
        url: 'http://from-rum-context.com',
        referrer: 'referrer_from_common_context',
      })
    })

    it('should include raw log', () => {
      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, { rawLogsEvent: DEFAULT_MESSAGE })

      expect(serverLogs[0]).toEqual(jasmine.objectContaining(DEFAULT_MESSAGE))
    })
  })

  describe('contexts precedence', () => {
    it('common context should take precedence over service and session_id', () => {
      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
        rawLogsEvent: DEFAULT_MESSAGE,
        savedCommonContext: {
          ...COMMON_CONTEXT,
          context: { service: 'foo', session_id: 'bar' },
        },
      })

      expect(serverLogs[0].service).toBe('foo')
      expect(serverLogs[0].session_id).toBe('bar')
    })

    it('RUM context should take precedence over common context', () => {
      spyOn(window.DD_RUM!, 'getInternalContext').and.returnValue({ view: { url: 'from-rum-context' } })

      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, { rawLogsEvent: DEFAULT_MESSAGE })

      expect(serverLogs[0].view.url).toEqual('from-rum-context')
    })

    it('raw log should take precedence over RUM context', () => {
      spyOn(window.DD_RUM!, 'getInternalContext').and.returnValue({ message: 'from-rum-context' })

      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, { rawLogsEvent: DEFAULT_MESSAGE })

      expect(serverLogs[0].message).toEqual('message')
    })

    it('message context should take precedence over raw log', () => {
      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
        rawLogsEvent: DEFAULT_MESSAGE,
        messageContext: { message: 'from-message-context' },
      })

      expect(serverLogs[0].message).toEqual('from-message-context')
    })
  })

  describe('beforeSend', () => {
    it('should allow modification of existing fields', () => {
      beforeSend = (event: LogsEvent) => {
        event.message = 'modified message'
        ;(event.service as any) = 'modified service'
      }

      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
        rawLogsEvent: DEFAULT_MESSAGE,
      })

      expect(serverLogs[0].message).toBe('modified message')
      expect(serverLogs[0].service).toBe('modified service')
    })

    it('should allow adding new fields', () => {
      beforeSend = (event: LogsEvent) => {
        event.foo = 'bar'
      }

      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
        rawLogsEvent: DEFAULT_MESSAGE,
      })

      expect(serverLogs[0].foo).toBe('bar')
    })
  })
})

describe('user management', () => {
  const sessionManager: LogsSessionManager = {
    findTrackedSession: () => (sessionIsTracked ? { id: SESSION_ID } : undefined),
    expireObservable: new Observable<void>(),
  }

  let sessionIsTracked: boolean
  let lifeCycle: LifeCycle
  let serverLogs: Array<LogsEvent & Context> = []

  const beforeSend: (event: LogsEvent) => void | boolean = noop
  const configuration = {
    ...validateAndBuildLogsConfiguration(initConfiguration)!,
    beforeSend: (x: LogsEvent) => beforeSend(x),
  }

  beforeEach(() => {
    sessionIsTracked = true
    lifeCycle = new LifeCycle()
    lifeCycle.subscribe(LifeCycleEventType.LOG_COLLECTED, (serverRumEvent) => serverLogs.push(serverRumEvent))
  })

  afterEach(() => {
    delete window.DD_RUM
    serverLogs = []
  })

  it('should not output usr key if user is not set', () => {
    startLogsAssembly(sessionManager, configuration, lifeCycle, () => COMMON_CONTEXT, noop)

    lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, { rawLogsEvent: DEFAULT_MESSAGE })
    expect(serverLogs[0].usr).toBeUndefined()
  })

  it('should include user data when user has been set', () => {
    startLogsAssembly(sessionManager, configuration, lifeCycle, () => COMMON_CONTEXT_WITH_USER, noop)

    lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, { rawLogsEvent: DEFAULT_MESSAGE })
    expect(serverLogs[0].usr).toEqual({
      id: 'id',
      name: 'name',
      email: 'test@test.com',
    })
  })

  it('should prioritize global context over user context', () => {
    const globalContextWithUser = {
      ...COMMON_CONTEXT_WITH_USER,
      context: {
        ...COMMON_CONTEXT.context,
        usr: {
          id: 4242,
          name: 'solution',
        },
      },
    }
    startLogsAssembly(sessionManager, configuration, lifeCycle, () => globalContextWithUser, noop)

    lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, { rawLogsEvent: DEFAULT_MESSAGE })
    expect(serverLogs[0].usr).toEqual({
      id: 4242,
      name: 'solution',
      email: 'test@test.com',
    })
  })
})

describe('logs limitation', () => {
  let clock: Clock
  const sessionManager: LogsSessionManager = {
    findTrackedSession: () => ({ id: SESSION_ID }),
    expireObservable: new Observable(),
  }

  let beforeSend: (event: LogsEvent) => void | boolean
  let lifeCycle: LifeCycle
  let serverLogs: Array<LogsEvent & Context> = []
  let reportErrorSpy: jasmine.Spy<jasmine.Func>

  beforeEach(() => {
    lifeCycle = new LifeCycle()
    lifeCycle.subscribe(LifeCycleEventType.LOG_COLLECTED, (serverRumEvent) => serverLogs.push(serverRumEvent))
    const configuration = {
      ...validateAndBuildLogsConfiguration(initConfiguration)!,
      maxBatchSize: 1,
      eventRateLimiterThreshold: 1,
      beforeSend: (x: LogsEvent) => beforeSend(x),
    }
    beforeSend = noop
    reportErrorSpy = jasmine.createSpy('reportError')
    startLogsAssembly(sessionManager, configuration, lifeCycle, () => COMMON_CONTEXT, reportErrorSpy)
    clock = mockClock()
  })

  afterEach(() => {
    serverLogs = []
  })

  it('should not apply to agent logs', () => {
    lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
      rawLogsEvent: { ...DEFAULT_MESSAGE, origin: ErrorSource.AGENT, status: 'error', message: 'foo' },
    })
    lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
      rawLogsEvent: { ...DEFAULT_MESSAGE, origin: ErrorSource.AGENT, status: 'error', message: 'bar' },
    })

    expect(serverLogs.length).toEqual(2)
    expect(reportErrorSpy).not.toHaveBeenCalled()
    expect(serverLogs[0].message).toBe('foo')
    expect(serverLogs[1].message).toBe('bar')
  })
  ;[
    { status: StatusType.error, messageContext: {}, message: 'Reached max number of errors by minute: 1' },
    { status: StatusType.warn, messageContext: {}, message: 'Reached max number of warns by minute: 1' },
    { status: StatusType.info, messageContext: {}, message: 'Reached max number of infos by minute: 1' },
    { status: StatusType.debug, messageContext: {}, message: 'Reached max number of debugs by minute: 1' },
    {
      status: StatusType.debug,
      messageContext: { status: 'unknown' }, // overrides the rawLogsEvent status
      message: 'Reached max number of customs by minute: 1',
    },
  ].forEach(({ status, message, messageContext }) => {
    it(`stops sending ${status} logs when reaching the limit`, () => {
      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
        rawLogsEvent: { ...DEFAULT_MESSAGE, message: 'foo', status },
        messageContext,
      })
      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
        rawLogsEvent: { ...DEFAULT_MESSAGE, message: 'bar', status },
        messageContext,
      })

      expect(serverLogs.length).toEqual(1)
      expect(serverLogs[0].message).toBe('foo')
      expect(reportErrorSpy).toHaveBeenCalledTimes(1)
      expect(reportErrorSpy.calls.argsFor(0)[0]).toEqual(
        jasmine.objectContaining({
          message,
          source: ErrorSource.AGENT,
        })
      )
    })

    it(`does not take discarded ${status} logs into account`, () => {
      beforeSend = (event) => {
        if (event.message === 'discard me') {
          return false
        }
      }

      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
        rawLogsEvent: { ...DEFAULT_MESSAGE, message: 'discard me', status },
        messageContext,
      })
      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
        rawLogsEvent: { ...DEFAULT_MESSAGE, message: 'discard me', status },
        messageContext,
      })
      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
        rawLogsEvent: { ...DEFAULT_MESSAGE, message: 'discard me', status },
        messageContext,
      })
      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
        rawLogsEvent: { ...DEFAULT_MESSAGE, message: 'foo', status },
        messageContext,
      })

      expect(serverLogs.length).toEqual(1)
      expect(serverLogs[0].message).toBe('foo')
    })

    it(`allows to send new ${status}s after a minute`, () => {
      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
        rawLogsEvent: { ...DEFAULT_MESSAGE, message: 'foo', status },
        messageContext,
      })
      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
        rawLogsEvent: { ...DEFAULT_MESSAGE, message: 'bar', status },
        messageContext,
      })
      clock.tick(ONE_MINUTE)
      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
        rawLogsEvent: { ...DEFAULT_MESSAGE, message: 'baz', status },
        messageContext,
      })

      expect(serverLogs.length).toEqual(2)
      expect(serverLogs[0].message).toEqual('foo')
      expect(serverLogs[1].message).toEqual('baz')
      expect(reportErrorSpy).toHaveBeenCalledTimes(1)
      expect(reportErrorSpy.calls.argsFor(0)[0]).toEqual(
        jasmine.objectContaining({
          source: ErrorSource.AGENT,
        })
      )
    })

    it('allows to send logs with a different status when reaching the limit', () => {
      const otherLogStatus = status === StatusType.error ? StatusType.info : StatusType.error
      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
        rawLogsEvent: { ...DEFAULT_MESSAGE, message: 'foo', status },
        messageContext,
      })
      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
        rawLogsEvent: { ...DEFAULT_MESSAGE, message: 'bar', status },
        messageContext,
      })
      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
        rawLogsEvent: { ...DEFAULT_MESSAGE, message: 'baz', status: otherLogStatus },
        ...{ ...messageContext, status: otherLogStatus },
      })

      expect(serverLogs.length).toEqual(2)
      expect(serverLogs[0].message).toEqual('foo')
      expect(serverLogs[1].message).toEqual('baz')
      expect(reportErrorSpy).toHaveBeenCalledTimes(1)
      expect(reportErrorSpy.calls.argsFor(0)[0]).toEqual(
        jasmine.objectContaining({
          source: ErrorSource.AGENT,
        })
      )
    })
  })

  it('two different custom statuses are accounted by the same limit', () => {
    lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
      rawLogsEvent: { ...DEFAULT_MESSAGE, message: 'foo', status: StatusType.info },
      messageContext: { status: 'foo' },
    })

    lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
      rawLogsEvent: { ...DEFAULT_MESSAGE, message: 'bar', status: StatusType.info },
      messageContext: { status: 'bar' },
    })

    expect(serverLogs.length).toEqual(1)
    expect(serverLogs[0].message).toEqual('foo')
    expect(reportErrorSpy).toHaveBeenCalledTimes(1)
    expect(reportErrorSpy.calls.argsFor(0)[0]).toEqual(
      jasmine.objectContaining({
        source: ErrorSource.AGENT,
      })
    )
  })
})
