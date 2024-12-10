// baseUrl -> proxy

const { protocol, host } = globalThis.location || {}

function buildOptions(origin: any = {}) {
  const options = Object.assign({}, origin)
  if (typeof options.baseUrl !== 'string') {
    options.baseUrl = ''
  }
  options.baseUrl = !options.baseUrl ? `${protocol}//${host}` : options.baseUrl
  if (options.baseUrl.startsWith('/')) {
    options.baseUrl = `${protocol}//${host}${options.baseUrl}`
  }
  options.proxy = ({ path, parameters }: { path: string, parameters: string }) => {
    const pathAndParameters = path + '?' + encodeURIComponent(parameters)
    return options.baseUrl.endsWith('/') ? options.baseUrl.slice(0, -1) + pathAndParameters : options.baseUrl + pathAndParameters
  }
  options.site = options.site || options.baseUrl
  options.clientToken = options.clientToken || 'snc-client-token'
  return options
}

export function proxy(target: any) {
  const originInit = target.init
  target.init = function(initConfiguration: any) {
    const options = buildOptions(initConfiguration)
    return originInit.call(this, options)
  }
  return target
}