const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const webpack = require("webpack");

/**
 * Base configuration for all modes and targets.
 */
const baseConfig = {
    target: "web",
    // WEBPACK_CACHE_DIR pins the cache to a stable path CI can persist across runs;
    // without it, fall back to webpack's normal node_modules/.cache/webpack default
    cache: {
        type: "filesystem",
        ...(process.env.WEBPACK_CACHE_DIR
            ? { cacheDirectory: path.resolve(process.env.WEBPACK_CACHE_DIR, "jcc-jed") }
            : {}),
    },
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
                excludeChunks: ["customLayerWorker"],
                inject: true,
            }),
            new CopyWebpackPlugin({
                patterns: [
                    path.resolve(__dirname, "jcc/public/favicon.png"),
                    path.resolve(__dirname, "jcc/public/manifest.json"),
                    path.resolve(__dirname, "jcc/public/loading.css"),
                    path.resolve(__dirname, "jcc/public/loading-logo.svg"),
                ],
                options: {},
            }),
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
