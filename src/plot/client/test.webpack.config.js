const path = require('path');

module.exports = {
  mode : "development",
  devtool : 'inline-source-map',
  entry : path.resolve(__dirname, './src/index.js'),
  module : {
    rules :
    [ {test : /\.(js)$/, exclude : /node_modules/, use : [ 'babel-loader' ]} ]
  },
  resolve : {extensions : [ '*', '.js' ]},
  output : {
    path : path.resolve(__dirname, './dist'),
    filename : 'bundle.js',
  },
  devServer : {
    static : path.resolve(__dirname, './dist'),
  },
  watch : true
};
