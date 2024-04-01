const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  return {
    mode : "production",
    entry : path.resolve(__dirname, './src/index.tsx'),
    module : {
      rules : [
        {test : /\.(js)$/, exclude : /node_modules/, use : [ 'babel-loader' ]},
        {test : /\.css$/, use : [ 'style-loader', 'css-loader' ]}, {
          test : /\.(png|svg|jpg|jpeg|gif)$/,
          type : 'asset/resource',
        },
        {test : /\.tsx?$/, exclude : [ /node_modules/], use : [ 'ts-loader' ]}
      ]
    },
    resolve : {extensions : [ '*', '.js', '.ts', '.tsx', '.css', '.gif' ]},
    plugins : [
      new HtmlWebpackPlugin({
        template : path.resolve(__dirname, 'dist/index.html'),
        favicon : path.resolve(__dirname, 'dist/favicon.png')
      }),
      new CopyWebpackPlugin({
        patterns : [
          path.resolve(__dirname, 'dist/favicon.png'),
          path.resolve(__dirname, 'dist/courseOverGroundIcon.svg'),
          path.resolve(__dirname, 'dist/headingIcon.svg')
        ],
        options : {}
      })
    ],
    output : {
      path : env.TARGET_DIR,
      filename : 'bundle.js',
    }
  };
}
