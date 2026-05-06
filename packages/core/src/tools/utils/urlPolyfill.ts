import { jsonStringify } from '../serialisation/jsonStringify'

var cachedAnchorElement: HTMLAnchorElement | undefined

function getAnchorElement(): HTMLAnchorElement {
  if (!cachedAnchorElement) {
    cachedAnchorElement = document.createElement('a')
  }
  return cachedAnchorElement
}

export function normalizeUrl(url: string) {
  return buildUrl(url, location.href).href
}

export function isValidUrl(url: string) {
  try {
    return !!buildUrl(url)
  } catch {
    return false
  }
}

export function getPathName(url: string) {
  const pathname = buildUrl(url).pathname
  return pathname[0] === '/' ? pathname : `/${pathname}`
}

export function buildUrl(url: string, base?: string) {
  const supportedURL = getSupportedUrl()
  if (supportedURL) {
    try {
      return base !== undefined ? new supportedURL(url, base) : new supportedURL(url)
    } catch (error) {
      throw new Error(`Failed to construct URL: ${String(error)} ${jsonStringify({ url, base })!}`)
    }
  }
  if (base === undefined && !/:/.test(url)) {
    throw new Error(`Invalid URL: '${url}'`)
  }
  if (base !== undefined) {
    // base-resolved parsing needs an isolated document, can't reuse cached anchor
    let doc = document.implementation.createHTMLDocument('')
    const baseElement = doc.createElement('base')
    baseElement.href = base
    const anchorElement = doc.createElement('a')
    doc.head.appendChild(baseElement)
    doc.body.appendChild(anchorElement)
    anchorElement.href = url
    return anchorElement
  }
  // No base: reuse cached anchor element to avoid repeated createElement
  const anchorElement = getAnchorElement()
  anchorElement.href = url
  return anchorElement
}

const originalURL = URL
let isURLSupported: boolean | undefined
function getSupportedUrl(): typeof URL | undefined {
  if (isURLSupported === undefined) {
    try {
      const url = new originalURL('http://test/path')
      isURLSupported = url.href === 'http://test/path'
    } catch {
      isURLSupported = false
    }
  }
  return isURLSupported ? originalURL : undefined
}
