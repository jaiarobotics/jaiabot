# Jaia Web Applications

## Jaia Command and Control (JCC)

This mission planning and control application allows you to create mission plans and monitor your JaiaBots and JaiaHubs as they perform their missions.

## Jaia Engineering and Debugging (JED)

This application allows you to send lower-level engineering commands directly to JaiaBots, such as adjusting motor and rudder values.

## Jaia Data Vision (JDV)

This data analysis application views logs from JaiaHubs and JaiaBots, presenting you with maps and allows you to chart any of the recorded data from past missions.

## Running

The Jaia web source code is located in the `src/web` directory. In this directory is a script called `run.sh`, which will build and launch JCC and JED. Both apps will then be accessible from your browser.

When using the `run.sh` script, JCC and JED will be built and run using the `Development` build mode. This means that the code will not be minified, and the source directories will be watched (monitored for any changes). If any changes are detected, the apps will be rebuilt so that you may refresh your browser and see the code changes.

There is also a `run.sh` script in the `src/web/jdv` directory, which will build and run `JDV` in the same way.

## Project Structure

### Webpack

`JCC` and `JED` are built using the `webpack` package. Configuration for `webpack` can be found in the `src/web/webpack.config.js` file. Using this file, `webpack` will build both `JCC` and `JED` using either the `development` or `production` mode.

A build can be done directly via command-line. For example:

```
jaiabot/src/web$ webpack --mode development --env OUTPUT_DIR=${HOME}/temp
```

The `webpack.config.js` file contains five different webpack configuration objects:

- `baseConfig`, which contains the configuration options to be used for all apps, in both build modes (`development` and `production`)
- `developmentConfig`, which contains development options
- `productionConfig`, which contains production options
- `jedConfig`, which contains build options specific to JED
- `jccConfig`, which contains build options specific to JCC

When invoked, the correct options are chosen depending on the build mode provided, and both `JCC` and `JED` are built.

### TypeScript

Most code is written in the TypeScript language, which is essentially JavaScript with type hints. The `ts-loader` module for webpack is used to transpile .tsx and .ts files into JavaScript. Options for this transpilation can be found in the `src/web/tsconfig.json` file.

### Protobuf types

The TypeScript definitions for the Protobuf messages are generated from the `.proto` files in
`src/lib/messages` by `gen_protobuf_types.sh`, and are not checked in. `run.sh` and the CMake
build both generate them, so most of the time this happens on its own. On a fresh clone, run
them once by hand before invoking `tsc` or `jest` directly:

```
jaiabot/src/web$ npm install && npm run gen:proto
```

This needs `protoc` and the goby and DCCL `.proto` files, which `jaia dev setup` installs (or
`source init.sh` on a fresh machine). Set `JAIA_PROTO_INCLUDE_DIRS` if they are not under
`/usr/include`. No C++ build is required — the web targets do not depend on the C++ graph.

### Babel

For all JavaScript and JSX files (`.js` and `.jsx`), Babel is used to transpile to the target version of ECMAScript. This is done using the `babel-loader` module specified in `webpack.config.js`.

> NOTE: Although one can specify Babel settings within the `webpack.config.js` file, we keep all Babel settings in the `babel.config.js` file.
>
> This way, `webpack` and `jest` will both use the same Babel settings.

### Jest

Tests are written using the `jest` module. Options for `jest` are found in the `src/web/jest.config.js` file.

- The `ts_jest` module is used to transpile `.tsx` and `.ts` files into JavaScript for `jest`.
- The `babel_jest` module is used to transpile `.jsx` and `.js` files.

To run all of the tests:

```
npm test
```

To run a specific test:

```
npm test <path to test file>
```

```
npm test jcc/client/components/CommandControl/__tests__/CommandControl.test.tsx
```

### Dependencies

`package.json` is **generated** and is not checked in. The source is `package.json.in`, which
CMake expands into `package.json`:

```
jaiabot$ cmake -P cmake/ConfigurePackageJSON.cmake
```

Edit `package.json.in` and regenerate — edits made directly to `package.json` are lost the next
time anything builds. `package-lock.json` _is_ checked in, so regenerate it with `npm install`
and commit it alongside the `package.json.in` change.

The `webpack` and `webpack-cli` versions are substituted from `scripts/common-versions.env`
rather than written in `package.json.in`, because `setup-tools-build.sh` installs those same
versions globally. Changing them means changing that file and re-running the setup script.

The `jaia_version_nodejs` and `jaia_version_npm` pins in that same file set the Node and npm
versions `setup-tools-build.sh` installs through nvm. `build.sh` only sources nvm, so it keeps
using whatever version is already aliased — changing those pins means re-running the setup
script.

#### Install scripts

A package can declare a script that npm runs automatically during `npm install`. Those scripts
run with your permissions and can read anything you can read, which makes them the most direct
way to attack a developer machine: a single compromised package anywhere in the dependency tree
gets code execution on every machine that installs it. npm therefore refuses to run them unless
the package is listed in the `allowScripts` field.

That field lives in `package.json.in` like everything else — npm's own `npm install-scripts`
command writes to the generated `package.json`, where the next build overwrites it.

Deny by default. Only allow a package when something demonstrably breaks without its script,
and say in the commit message what broke. If `npm install` reports a package whose script was
skipped, add it as `false`:

```json
"allowScripts": {
    "@parcel/watcher": false,
    "unrs-resolver": false
}
```

> NOTE: Do not silence the warning with `npm install-scripts approve --all`. That allows every
> install script in the tree, which is the outcome the check exists to prevent.
