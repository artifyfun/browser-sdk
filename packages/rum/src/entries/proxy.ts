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
    console.log('--------rum init--------[initConfiguration]', initConfiguration)
    setTimeout(() => {
      try {
        (globalThis as any).DD_RUM.getInitConfiguration()
        console.log('--------rum init--------[DD_RUM]', (globalThis as any).DD_RUM)
        console.log('--------rum init--------[DD_RUM.getInitConfiguration()]', (globalThis as any).DD_RUM.getInitConfiguration())
        console.log('--------rum init--------[DD_RUM.getInternalContext()]', (globalThis as any).DD_RUM.getInternalContext())
      } catch (e) {
        console.log('--------rum init--------[error]', e)
      }
    }, 1000)
    return originInit.call(this, options)
  }
  return target
}