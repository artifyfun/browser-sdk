// baseUrl -> proxy

var location = window.location || {};
var protocol = location.protocol;
var host = location.host;

function buildOptions(origin: any) {
  if (origin === void 0) { origin = {}; }
  var options = { ...origin };
  if (typeof options.baseUrl !== 'string') {
    options.baseUrl = '';
  }
  options.baseUrl = !options.baseUrl ? protocol + '//' + host : options.baseUrl;
  if (options.baseUrl.indexOf('/') === 0) {
    options.baseUrl = protocol + '//' + host + options.baseUrl;
  }
  options.proxy = function(params: { path: string, parameters: string }) {
    var path = params.path;
    var parameters = params.parameters;
    var pathAndParameters = path + '?' + encodeURIComponent(parameters);
    return options.baseUrl.slice(-1) === '/' ? options.baseUrl.slice(0, -1) + pathAndParameters : options.baseUrl + pathAndParameters;
  };
  options.site = options.site || options.baseUrl;
  options.clientToken = options.clientToken || 'snc-client-token';
  return options;
}

export function proxy(target: any) {
  var originInit = target.init;
  target.init = function(initConfiguration: any) {
    var options = buildOptions(initConfiguration);
    return originInit.call(this, options);
  };
  return target;
}