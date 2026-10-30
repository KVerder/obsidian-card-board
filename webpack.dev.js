const path          = require('path');

const { merge } = require("webpack-merge");
const common    = require("./webpack.common.js");

module.exports = merge(common, {
  mode: "development",
  module: {
    rules: [
      {
        test: /\.elm$/,
        resourceQuery: /worker-source/,
        type: 'asset/source',
        use: [{ loader: 'elm-webpack-loader', options: { optimize: false } }]
      },
      {
        test: [/\.elm$/],
        resourceQuery: { not: [/worker-source/] },
        exclude: [/elm-stuff/, /node_modules/],
        use: [
          { loader: "elm-reloader" },
          {
            loader: "elm-webpack-loader",
            options: {}
          }
        ]
      },
    ]
  },
});
