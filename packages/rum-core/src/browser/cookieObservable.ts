import type { Configuration, CookieStore } from '@datadog/browser-core'
import {
  setInterval,
  clearInterval,
  Observable,
  addEventListener,
  ONE_SECOND,
  findCommaSeparatedValue,
} from '@datadog/browser-core'

export interface CookieStoreWindow extends Window {
  cookieStore?: CookieStore
}

export type CookieObservable = ReturnType<typeof createCookieObservable>

export type CookieChange = { name: string; value: string | undefined }

export function createCookieObservable(configuration: Configuration, cookieName: string) {
  return new Observable<CookieChange>(
    (observable) =>
      listenToCookieStoreChange(configuration, cookieName, (event) => observable.notify(event)) ??
      watchCookieFallback(cookieName, (event) => observable.notify(event))
  )
}

function listenToCookieStoreChange(
  configuration: Configuration,
  cookieName: string,
  callback: (event: CookieChange) => void
) {
  if (!(window as CookieStoreWindow).cookieStore) {
    return
  }

  const listener = addEventListener(configuration, (window as CookieStoreWindow).cookieStore!, 'change', (event) => {
    event.changed
      .concat(event.deleted)
      .filter((change) => change.name === cookieName)
      .forEach((change) => {
        callback({
          name: change.name,
          value: change.value,
        })
      })
  })

  return listener.stop
}

export const WATCH_COOKIE_INTERVAL_DELAY = ONE_SECOND

function watchCookieFallback(
  cookieName: string,
  callback: (event: { name: string; value: string | undefined }) => void
) {
  const watchCookieIntervalId = setInterval(() => {
    callback({ name: cookieName, value: findCommaSeparatedValue(document.cookie, cookieName) })
  }, WATCH_COOKIE_INTERVAL_DELAY)

  return () => {
    clearInterval(watchCookieIntervalId)
  }
}
