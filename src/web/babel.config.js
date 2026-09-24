module.exports = {
    presets: [
        ["@babel/preset-env", { modules: "auto", targets: "defaults" }],
        "@babel/preset-react",
    ],
    plugins: [
        "@babel/plugin-transform-class-properties",
        "@babel/plugin-transform-nullish-coalescing-operator",
        "@babel/plugin-transform-private-methods",
        "@babel/plugin-transform-optional-chaining",
    ],
};
