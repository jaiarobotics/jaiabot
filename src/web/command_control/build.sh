#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

set -e

pushd "$DIR"

output_path='dist/client'
[[ ! -z "$1" ]] && output_path="$1"

echo "🟢 JCC:  Building app package"
npx webpack --mode development --config ./webpack.config.js --output-path $output_path # --display errors-only
echo "✅ Done"
