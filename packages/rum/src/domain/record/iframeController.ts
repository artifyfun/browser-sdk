import { noop } from '@datadog/browser-core'
import type { RumConfiguration } from '@datadog/browser-rum-core'
import { trackMutation } from './trackers'
import type { BrowserIncrementalSnapshotRecord } from '../../types'
import type { ElementsScrollPositions } from './elementsScrollPositions'
import { initShadowRootsController } from './shadowRootsController'

interface IframeController {
  stop: () => void
  flush: () => void
}

export type IFrameCallback = (iframeEl: HTMLIFrameElement) => void

export interface IframesController {
  addIframe: IFrameCallback
  removeIframe: IFrameCallback
  stop: () => void
  flush: () => void
}

export const initIframeController = (
  configuration: RumConfiguration,
  callback: (record: BrowserIncrementalSnapshotRecord) => void,
  elementsScrollPositions: ElementsScrollPositions
): IframesController => {
  const controllerByIframe = new Map<HTMLIFrameElement, IframeController>()

  const shadowRootsController = initShadowRootsController(configuration, callback, elementsScrollPositions)

  const iframesController: IframesController = {
    addIframe: (iframeEl: HTMLIFrameElement) => {
      if (!iframeEl.contentDocument) {
        return
      }
      const { stop: stopMutationObserver, flush } = trackMutation(
        callback,
        configuration,
        shadowRootsController,
        iframesController,
        iframeEl.contentDocument
      )
      controllerByIframe.set(iframeEl, {
        flush,
        stop: () => {
          stopMutationObserver()
        },
      })
    },
    removeIframe: (iframeEl: HTMLIFrameElement) => {
      const entry = controllerByIframe.get(iframeEl)
      if (!entry) {
        return
      }
      entry.stop()
      controllerByIframe.delete(iframeEl)
    },
    stop: () => {
      shadowRootsController.stop()
      controllerByIframe.forEach(({ stop }) => stop())
    },
    flush: () => {
      shadowRootsController.flush()
      controllerByIframe.forEach(({ flush }) => flush())
    },
  }
  return iframesController
}