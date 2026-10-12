const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const path = require("path");

module.exports = options => {
  return {
    entry: './index.js',
    output: {
      filename: 'bundle.js',
      publicPath: "auto",
      uniqueName: "react-example-ui",
      path: path.resolve(__dirname, './dist'),
    },
    module: {
      rules: [
        {
          test: /.js$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'babel-loader',
              options: {
                cacheDirectory: true,
                presets: ['@babel/react', '@babel/env']
              }
            },
          ],
        },
      ],
    },
    plugins: [
      new ModuleFederationPlugin({
          name: "react_example_ui",
          library: { type: "var", name: "react_example_ui" },
          filename: "remoteEntry.js",
          exposes: {
              './web-components': './app.js',
          },        
          shared: ["react", "react-dom"]
        }),
        new CopyWebpackPlugin({
          patterns: [
            {
              from: './*.html'
            }
          ]
        })
    ],
    devServer: {
      port: 4204
    }
  }
}
