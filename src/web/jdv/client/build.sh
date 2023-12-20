#!/bin/bash

set -e

TARGET_DIR=$1

echo "🟢 Building jdv into ${TARGET_DIR}"

webpack --mode production --config ./release.webpack.config.js --env TARGET_DIR=${TARGET_DIR}
