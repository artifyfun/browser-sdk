let { browserConfigurations } = require('../browsers.conf')
const { extensionBrowserConfigurations } = require('../browsers.developer-extension.conf')
const { getBuildInfos } = require('../envUtils')
const karmaBaseConfig = require('./karma.base.conf')

const testFiles = ['packages/*/+(src|test)/**/*.spec.ts']
const isExtension = process.argv.includes('--ext')

if (isExtension) {
  testFiles.push('developer-extension/src/**/*.spec.ts')
  browserConfigurations = extensionBrowserConfigurations
}

const karmaBaseConf = karmaBaseConfig(testFiles)

module.exports = function (config) {
  config.set({
    ...karmaBaseConf,
    plugins: [...karmaBaseConf.plugins, 'karma-browserstack-launcher'],
    reporters: [...karmaBaseConf.reporters, 'BrowserStack'],
    browsers: browserConfigurations.map((configuration) => configuration.sessionName),
    concurrency: 5,
    browserDisconnectTolerance: 3,
    captureTimeout: 2 * 60 * 1000,
    browserStack: {
      username: process.env.BS_USERNAME,
      accessKey: process.env.BS_ACCESS_KEY,
      project: 'browser sdk unit',
      build: getBuildInfos(),
      video: false,
    },
    customLaunchers: Object.fromEntries(
      browserConfigurations.map((configuration) => [
        configuration.sessionName,
        // See https://github.com/karma-runner/karma-browserstack-launcher#per-browser-options
        {
          base: 'BrowserStack',
          os: configuration.os,
          os_version: configuration.osVersion,
          browser: configuration.name,
          browser_version: configuration.version,
          device: configuration.device,
          name: configuration.sessionName,
        },
      ])
    ),
  })
}
