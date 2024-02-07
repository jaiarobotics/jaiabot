#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

set -e

pushd "$DIR"

output_path='dist'
[[ ! -z "$1" ]] && output_path="$1"

echo "🟢 Building app package"

npx webpack --mode development --config ./release.webpack.config.js --output-path $output_path # --display errors-only

echo "✅ Done"
