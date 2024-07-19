const path = require('path')
const fs = require('fs')
const webpack = require('webpack')
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const { buildEnvKeys, getBuildEnvValue } = require('./scripts/lib/build-env')

const tsconfigPath = path.join(__dirname, 'tsconfig.webpack.json')
// const cacheFileName = path.join(__dirname, 'cache.json');
const TERSER_CACHE = {};

module.exports = ({ entry, mode, filename, types, keepBuildEnvVariables, plugins }) => ({
  entry,
  mode,
  output: {
    filename,
    path: path.resolve('./bundle'),
  },
  target: ['web', 'es2018'],
  devtool: false,
  module: {
    rules: [
      {
        test: /\.(ts|tsx|js)$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
        options: {
          configFile: tsconfigPath,
          onlyCompileBundledFiles: true,
          compilerOptions: {
            module: 'es6',
            allowJs: true,
            types: types || [],
          },
        },
      },
    ],
  },

  resolve: {
    extensions: ['.ts', '.js'],
    plugins: [new TsconfigPathsPlugin({ configFile: tsconfigPath })],
    alias: {
      // The default "pako.esm.js" build is not transpiled to es5
      pako: 'pako/dist/pako.es5.js',
    },
  },

  optimization: {
    minimizer: [
      new TerserPlugin({
        extractComments: false,
        terserOptions: {
          mangle: {
            properties: true,
          },
          compress: {
            drop_console: true,
            expression: true,
            hoist_funs: true,
            module: true,
            unsafe_arrows: true,
            unsafe_Function: true,
            unsafe_math: true,
            unsafe_proto: true,
            unsafe_regexp: true,
            unsafe_undefined: true,
          },
          nameCache: TERSER_CACHE,
        },
      }),
    ],
  },

  plugins: [
    new webpack.SourceMapDevToolPlugin(
      mode === 'development'
        ? // Use an inline source map during development (default options)
          {}
        : // When bundling for release, produce a source map file so it can be used for source code integration,
          // but don't append the source map comment to bundles as we don't upload the source map to
          // the CDN (yet).
          {
            filename: '[file].map',
            append: false,
          }
    ),
    createDefinePlugin({ keepBuildEnvVariables }),
    ...(plugins || []),
  ],
})

function createDefinePlugin({ keepBuildEnvVariables } = {}) {
  return new webpack.DefinePlugin(
    Object.fromEntries(
      buildEnvKeys
        .filter((key) => !keepBuildEnvVariables?.includes(key))
        .map((key) => [
          `__BUILD_ENV__${key}__`,
          webpack.DefinePlugin.runtimeValue(() => JSON.stringify(getBuildEnvValue(key))),
        ])
    )
  )
}

module.exports.createDefinePlugin = createDefinePlugin
