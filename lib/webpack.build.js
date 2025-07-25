
const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");

const version = require('../lerna.json').version

module.exports = {
  mode: "production",
  devtool: false,
  entry: './lib/index.js',
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
      new TerserPlugin({ extractComments: false }),
      new CssMinimizerPlugin()
    ]
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader'
        }
      },
      {
        test: /\.(sa|sc|c)ss$/,
        use: [
          MiniCssExtractPlugin.loader,
          { loader: "css-loader", options: { sourceMap: true } },
        ]
      }
    ]
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'css/index.css'
    }),
  ]
};
