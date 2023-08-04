#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

set -e

pushd "$DIR"

output_path='dist'
[[ ! -z "$1" ]] && output_path="$1"

pushd ../../
    ./install_dependencies.sh
popd

echo "🟢 Building app package"

webpack --mode development --config ./release.webpack.config.js --output-path $output_path # --display errors-only

echo "✅ Done"
