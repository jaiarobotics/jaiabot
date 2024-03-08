const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = (env) => {
  const outputDirectory = path.resolve(__dirname, env['OUTPUT_DIR'] ?? './dist')

  return {
    mode: "production", 
    entry: path.resolve(__dirname, './script.js'), 
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
          new CopyPlugin({
            patterns : [
              {from : "index.html", to : outputDirectory},
              {from : "favicon.png", to : outputDirectory},
              {from : "helpPane.png", to : outputDirectory},
              {from : "style.css", to : outputDirectory},
            ],
          }),
        ],
    output: {
      path: outputDirectory,
      filename: 'script.js',
    },
    devServer: {
      static: outputDirectory,
    },
    stats: 'errors-only'
  }
}
