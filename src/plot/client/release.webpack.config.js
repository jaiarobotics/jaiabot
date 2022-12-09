const path = require('path');

module.exports = {
  mode : "production",
  entry : path.resolve(__dirname, './src/index.ts'),
  module : {
    rules :
    [
      {test : /\.(js)$/, exclude : /node_modules/, use : [ 'babel-loader' ]},
      {test : /\.css$/, use : [ 'style-loader', 'css-loader' ]}, {
        test : /\.(png|svg|jpg|jpeg|gif)$/,
        type : 'asset/resource',
      },
      {test : /\.ts$/, exclude : [ /node_modules/], loader : 'ts-loader'}
    ]
  },
  resolve : {extensions : [ '*', '.js', '.ts' ]},
  output : {
    path : path.resolve(__dirname, './dist'),
    filename : 'bundle.js',
  },
  devServer : {
    static : path.resolve(__dirname, './dist'),
  }
};
