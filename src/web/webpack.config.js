const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const Dotenv = require('dotenv-webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

const optimizationConfig = {
  minimize : false,
  minimizer : [ new TerserPlugin({
    terserOptions : {
      toplevel : true,
      mangle : {
        toplevel : true,
      },
      passes : 2,
      output : {
        comments : false,
      },
    },
    // cache: true,
    parallel : true,
  }) ],
  mangleWasmImports : true
};

module.exports = (env, argv) => {

  const jedWebpackOptions = {
    mode: "production", 
    entry: path.resolve(__dirname, './jed/script.js'), 
    module: {
      rules:
          [
            {
              test : /\.(js)$/,
              exclude : /node_modules/,
              use : [ 'babel-loader' ]
            },
            {test : /\.css$/, use : [ 'style-loader', 'css-loader' ]}, {
              test : /\.(png|svg|jpg|jpeg|gif)$/,
              type : 'asset/resource',
            },
            {
              test : /\.tsx?$/,
              exclude : [ /node_modules/],
              use : [ 'ts-loader' ]
            }
          ]
    },
    resolve: {extensions: [ '*', '.js', '.ts', '.tsx', '.css' ]},
    plugins:
        [
          new CopyWebpackPlugin({
            patterns : [
              "jed/index.html",
              "jed/favicon.png",
              "jed/helpPane.png",
            ],
          }),
        ],
    output: {
      path: path.resolve(env.OUTPUT_DIR, 'jed/'),
      filename: 'script.js',
    },
    stats: 'errors-only'
  }
  
  
  
  const jccWebpackOptions = {
    target : 'web',
    stats : 'errors-only',
    devtool : 'eval-source-map',
    entry :
        [ 'babel-polyfill', path.resolve(__dirname, 'jcc/client/index.js') ],
    resolve : {
      extensions : [ '.*', '.js', '.jsx', '.ts', '.tsx' ],
    },
    output : {
      path: path.resolve(env.OUTPUT_DIR, 'jcc/'),
      filename : 'client.js'},
    module : {
      rules : [
        {
          test : /\.tsx?$/,
          exclude : [ /node_modules/],
          use : [ 'ts-loader' ]
        },
        {
          test : /\.(js|jsx)$/,
          exclude : /node_modules/,
          use : {
            loader : 'babel-loader',
            options : {
              presets : [
                [
                  '@babel/preset-env',
                  {modules : false, targets : 'defaults'}
                ],
                '@babel/preset-react'
              ],
              plugins : [
                '@babel/plugin-proposal-class-properties',
                [
                  'transform-react-remove-prop-types', {
                    mode : 'remove',
                    _disabled_ignoreFilenames : [ 'node_modules' ]
                  }
                ],
                '@babel/plugin-proposal-nullish-coalescing-operator',
                '@babel/plugin-proposal-optional-chaining'
              ]
            }
          }
        },
        {test : /\.css$/, use : [ 'style-loader', 'css-loader' ]},
        {test : /\.(png|svg|jpg|jpeg|gif)$/, type : 'asset/resource'}, {
          test : /\.less$/,
          use : [
            'style-loader', 'css-loader', {
              loader : 'less-loader',
              options : {lessOptions : {javascriptEnabled : true}}
            }
          ]
        },
        {test : /\.geojson$/, use : [ 'json-loader' ]}
      ]
    },
    plugins : [
      new HtmlWebpackPlugin({
        template : path.resolve(__dirname, 'jcc/public/index.html'),
        favicon : path.resolve(__dirname, 'jcc/public/favicon.png')
      }),
      new CopyWebpackPlugin({
        patterns : [
          path.resolve(__dirname, 'jcc/public/favicon.png'),
          path.resolve(__dirname, 'jcc/public/manifest.json')
        ],
        options : {}
      }),
      new webpack.HotModuleReplacementPlugin()
    ],
    optimization : optimizationConfig,
    performance : {hints : false},
    stats : 'minimal'
  }

  return [ jccWebpackOptions, jedWebpackOptions ]  
}
