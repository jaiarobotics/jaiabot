const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const webpack = require("webpack");

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
                    options: {
                        presets: [
                            ["@babel/preset-env", { modules: false, targets: "defaults" }],
                            "@babel/preset-react",
                        ],
                        plugins: [
                            "@babel/plugin-proposal-class-properties",
                            [
                                "transform-react-remove-prop-types",
                                {
                                    mode: "remove",
                                    _disabled_ignoreFilenames: ["node_modules"],
                                },
                            ],
                            "@babel/plugin-proposal-nullish-coalescing-operator",
                            "@babel/plugin-proposal-optional-chaining",
                        ],
                    },
                },
            },
            { test: /\.css$/, use: ["style-loader", "css-loader"] },
            { test: /\.(png|svg|jpg|jpeg|gif)$/, type: "asset/resource" },
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
            client: path.resolve(__dirname, "jcc/client/index.js"),
            customLayerRasterWorker: [
                path.resolve(__dirname, "jcc/client/components/CustomLayerRasterWorker.ts"),
            ],
        },
        output: {
            path: path.resolve(env.OUTPUT_DIR, "jcc/"),
            filename: "[name].js",
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: path.resolve(__dirname, "jcc/public/index.html"),
                favicon: path.resolve(__dirname, "jcc/public/favicon.png"),
                excludeChunks: ["customLayerWorker"],
            }),
            new CopyWebpackPlugin({
                patterns: [
                    path.resolve(__dirname, "jcc/public/favicon.png"),
                    path.resolve(__dirname, "jcc/public/manifest.json"),
                ],
                options: {},
            }),
            new webpack.HotModuleReplacementPlugin(),
        ],
    };

    return [
        Object.assign({}, baseConfig, modeConfig, jedConfig),
        Object.assign({}, baseConfig, modeConfig, jccConfig),
    ];
};
