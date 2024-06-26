import type { RouteMatch } from 'react-router-dom'
import { display, endsWith, startsWith } from '@datadog/browser-core'
import { onReactPluginInit } from '../reactPlugin'

export function startReactRouterView(routeMatches: RouteMatch[]) {
  onReactPluginInit((configuration, rumPublicApi) => {
    if (!configuration.router) {
      display.warn('`router: true` is missing from the react plugin configuration, the view will not be tracked.')
      return
    }
    rumPublicApi.startView(computeViewName(routeMatches))
  })
}

export function computeViewName(routeMatches: RouteMatch[]) {
  if (!routeMatches || routeMatches.length === 0) {
    return ''
  }

  let viewName = '/'

  for (const routeMatch of routeMatches) {
    const path = routeMatch.route.path
    if (!path) {
      continue
    }

    if (startsWith(path, '/')) {
      viewName = path
    } else {
      if (!endsWith(viewName, '/')) {
        viewName += '/'
      }
      viewName += path
    }
  }

  return viewName
}
