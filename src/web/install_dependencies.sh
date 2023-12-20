#!/bin/bash

# Where is your package.json?
PACKAGE_JSON_DIR=$1

echo 🟢 Installing npm dependencies in $(pwd) \(sorry, ts-loader needs them there\)

pushd ${PACKAGE_JSON_DIR} > /dev/null
    # Shut up unless there's an error!
    npm install --no-audit --no-progress --silent || npm install --no-audit --no-progress --quiet
popd > /dev/null
