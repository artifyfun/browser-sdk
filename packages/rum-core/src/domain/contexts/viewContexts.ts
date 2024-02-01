import type { RelativeTime, ClocksState, ValueHistoryEntry } from '@datadog/browser-core'
import { SESSION_TIME_OUT_DELAY, ValueHistory } from '@datadog/browser-core'
import type { LifeCycle } from '../lifeCycle'
import { LifeCycleEventType } from '../lifeCycle'
import type { ViewCreatedEvent } from '../view/trackViews'

export const VIEW_CONTEXT_TIME_OUT_DELAY = SESSION_TIME_OUT_DELAY

export interface ViewContext {
  service?: string
  version?: string
  id: string
  name?: string
  startClocks: ClocksState
}

export interface ViewContexts {
  findView: (startTime?: RelativeTime) => ViewContext | undefined
  stop: () => void
}

export function startViewContexts(lifeCycle: LifeCycle): ViewContexts {
  const viewContextHistory = new ValueHistory<ViewContext>(VIEW_CONTEXT_TIME_OUT_DELAY)

  let currentViewEntry: ValueHistoryEntry<ViewContext> | undefined
  lifeCycle.subscribe(LifeCycleEventType.VIEW_CREATED, (view) => {
    if (currentViewEntry) {
      currentViewEntry.close(view.startClocks.relative)
    }
    currentViewEntry = viewContextHistory.add(buildViewContext(view), view.startClocks.relative)
  })

  lifeCycle.subscribe(LifeCycleEventType.SESSION_RENEWED, () => {
    viewContextHistory.reset()
  })

  function buildViewContext(view: ViewCreatedEvent) {
    return {
      service: view.service,
      version: view.version,
      id: view.id,
      name: view.name,
      startClocks: view.startClocks,
    }
  }

  return {
    findView: (startTime) => viewContextHistory.find(startTime),
    stop: () => {
      viewContextHistory.stop()
    },
  }
}
