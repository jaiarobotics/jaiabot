const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = (env) => {
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
              "index.html",
              "favicon.png",
              "helpPane.png",
            ],
          }),
        ],
    output: {
      filename: 'script.js',
    },
    stats: 'errors-only'
  }
}
