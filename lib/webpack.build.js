
const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

const version = require('../lerna.json').version

module.exports = {
  mode: "production",
  devtool: false,
  entry: './lib/index.js',
  target: ['web', 'es5'],
  output: {
    filename: `browser-sdk@${version}.min.js`,
    path: path.resolve(__dirname, '../dist'),
    library: 'browserSdk',
    libraryTarget: 'umd',
    umdNamedDefine: true,
    clean: true
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({ extractComments: false })
    ]
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: {
                  browsers: ['> 1%', 'last 2 versions', 'ie >= 8']
                },
                useBuiltIns: 'entry',
                corejs: false
              }]
            ]
          }
        }
      }
    ]
  },
  plugins: []
};
