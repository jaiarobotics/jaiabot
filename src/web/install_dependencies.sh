#!/bin/bash

# This directory will contain intermediate build artifacts
INTERMEDIATE_BUILD_DIR="../../build/intermediate/"

echo 🟢 Installing npm dependencies to: $INTERMEDIATE_BUILD_DIR

# Create build directory, if necessary
mkdir -p ${INTERMEDIATE_BUILD_DIR}

# Copy our package.json file there, because npm doesn't allow building to arbitrary locations
cp -f ./package.json ${INTERMEDIATE_BUILD_DIR}/

pushd ${INTERMEDIATE_BUILD_DIR} > /dev/null
    npm install --no-audit --silent
popd > /dev/null
