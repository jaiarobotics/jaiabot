const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const webpack = require("webpack");
const { GenerateSW } = require("workbox-webpack-plugin");

/**
 * Base configuration for all modes and targets.
 */
const baseConfig = {
    target: "web",
    resolve: {
        extensions: [".*", ".js", ".jsx", ".ts", ".tsx"],
        alias: {
            geotiff: path.resolve(__dirname, "node_modules/geotiff/dist-module/geotiff.js"),
        },
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                exclude: [/node_modules/],
                use: ["ts-loader"],
            },
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader",
                },
            },
            { test: /\.css$/, use: ["style-loader", "css-loader"] },
            { test: /\.(png|jpg|jpeg|gif)$/, type: "asset/resource" },
            { test: /\.svg$/, type: "asset/inline" },
            {
                test: /\.less$/,
                use: [
                    "style-loader",
                    "css-loader",
                    {
                        loader: "less-loader",
                        options: { lessOptions: { javascriptEnabled: true } },
                    },
                ],
            },
            { test: /\.geojson$/, use: ["json-loader"] },
        ],
    },
};

/**
 * Production mode
 */
const productionConfig = {
    optimization: {
        minimize: true,
    },
    performance: { hints: false },
    stats: "errors-only",
};

/**
 * Development mode
 */
const developmentConfig = {
    stats: "minimal",
    devtool: "eval-source-map", // Makes output assets much larger, but provides better console debugging output
};

module.exports = (env, argv) => {
    const modeConfig = argv.mode == "production" ? productionConfig : developmentConfig;

    /**
     * JED config
     */
    const jedConfig = {
        entry: path.resolve(__dirname, "./jed/script.js"),
        output: {
            path: path.resolve(env.OUTPUT_DIR, "jed/"),
            filename: "script.js",
            clean: true,
        },
        plugins: [
            new CopyWebpackPlugin({
                patterns: ["jed/index.html", "jed/favicon.png", "jed/helpPane.png"],
            }),
        ],
    };

    /**
     * JCC config
     */
    const jccConfig = {
        entry: {
            client: path.resolve(__dirname, "jcc/index.tsx"),
        },
        output: {
            path: path.resolve(env.OUTPUT_DIR, "jcc/"),
            filename: "[name].js",
            clean: true,
            // Explicit relative public path so lazy chunk URLs resolve correctly
            // against the document URL even when client.js is loaded from a blob URL.
            publicPath: "./",
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: path.resolve(__dirname, "jcc/public/index.html"),
                favicon: path.resolve(__dirname, "jcc/public/favicon.png"),
                excludeChunks: ["customLayerWorker"],
                inject: false, // Script injection handled manually in template for download progress tracking
            }),
            new CopyWebpackPlugin({
                patterns: [
                    path.resolve(__dirname, "jcc/public/favicon.png"),
                    path.resolve(__dirname, "jcc/public/icon-192.png"),
                    path.resolve(__dirname, "jcc/public/icon-512.png"),
                    path.resolve(__dirname, "jcc/public/manifest.json"),
                    path.resolve(__dirname, "jcc/public/loading.css"),
                    path.resolve(__dirname, "jcc/public/loading-logo.svg"),
                ],
                options: {},
            }),
            ...(argv.mode === "production"
                ? [
                      new GenerateSW({
                          clientsClaim: true,
                          skipWaiting: true,
                          // Precaches all webpack-emitted assets (client.js, chunks, index.html, etc.)
                          // automatically. Runtime caching rules handle dynamic API and tile requests.
                          runtimeCaching: [
                              {
                                  // API calls — network first so live data is always fresh,
                                  // falling back to cache if the hub is unreachable.
                                  urlPattern: /\/jaia\/v0\/.*/,
                                  handler: "NetworkFirst",
                                  options: {
                                      cacheName: "api-cache",
                                      networkTimeoutSeconds: 10,
                                  },
                              },
                              {
                                  // Offline map tiles — cache first since tiles are static
                                  // once downloaded. Capped to avoid unbounded storage growth.
                                  urlPattern: /\/maps\/.*/,
                                  handler: "CacheFirst",
                                  options: {
                                      cacheName: "map-tiles",
                                      expiration: {
                                          maxEntries: 50000,
                                          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                                      },
                                  },
                              },
                          ],
                      }),
                  ]
                : []),
            new webpack.HotModuleReplacementPlugin(),
        ],
    };

    // This just takes a new empty object {}, and then updates it in place with the baseConfig, then the modeConfig,
    // then the config for the target app... basically fusing the three configs together.
    return [
        Object.assign({}, baseConfig, modeConfig, jedConfig),
        Object.assign({}, baseConfig, modeConfig, jccConfig),
    ];
};
