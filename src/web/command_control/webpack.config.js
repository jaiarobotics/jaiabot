const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const webpack = require('webpack');
const Dotenv = require('dotenv-webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

const outputDirectory = 'dist';

const optimizationConfig = {
        minimize: false,
	minimizer: [
		new TerserPlugin({
			terserOptions: {
				toplevel: true,
				mangle: {
					toplevel: true,
				},
				passes: 2,
				output: {
					comments: false,
				},
			},
			// cache: true,
			parallel: true,
		})
	],
	mangleWasmImports: true
};

module.exports = (env, argv) => [
    // Client ================================================================
    {
      // name: 'client',
      target : 'web',
      stats : 'errors-only',
      devtool : 'eval-source-map',
      entry : [ 'babel-polyfill', './client/index.js' ],
      output : {
        path : path.join(__dirname, outputDirectory, 'client'),
        filename : 'client.js'
      },
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
                    '@babel/preset-env', {modules : false, targets : 'defaults'}
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
      resolve : {extensions : [ '.*', '.js', '.jsx', '.ts', '.tsx' ]},
      devServer : {
        contentBase : false,  // Don't have any non-webpack content (see
                              // HtmlWebpackPlugin and CopyWebpackPlugin below)
        index : 'index.html', // I don't think this actually does anything
        host : '0.0.0.0',     // Or localhost if you have security concerns
        port : 3000,          // Can't be same port as server (4000)
        open : true,          // Open browser after server started
        openPage : 'client/index.html', // Must specify page because it's not at
                                        // the webpack output root
        overlay : true, // This is supposed to show webpack errors in the
                        // browser but I haven't seen it work.
        proxy : [ {
          // Proxy everything that needs to be handled by the actual backend to
          // the actual backend. This way the client doesn't have to talk to a
          // different port.
          context :
              [ '/geofiles', '/missionfiles', '/tiles', '/mission', '/servo' ],
          target : 'https://192.168.1.200:4000/'
        } ],
        hot : true
      },
      plugins : [
        // new CleanWebpackPlugin([outputDirectory]),
        new HtmlWebpackPlugin({
          template : './public/index.html',
          favicon : './public/favicon.png'
        }),
        new CopyWebpackPlugin({
          patterns : [ './public/favicon.png', './public/manifest.json' ],
          options : {}
        }),
        new Dotenv({path : `./${argv.mode}.env`}),
        new webpack.HotModuleReplacementPlugin()
      ],
      optimization : optimizationConfig,
      performance : {hints : false},
      stats : 'minimal'
    },
];
