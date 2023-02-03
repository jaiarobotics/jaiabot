#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

set -e

pushd "$DIR"

output_path='dist/client'
[[ ! -z "$1" ]] && output_path="$1"

which npm
npm --version
which webpack
webpack --version

if [[ "$DIR/package.json" -nt "$DIR/node_modules" ]]
then
	echo "Installing dependencies"
	npm install --no-audit
  # Touch, in case no modules had to be installed
  touch "$DIR/node_modules"
fi

echo "🟢 Building app package"

webpack --mode development --config ./webpack.config.js --output-path $output_path # --display errors-only
echo "✅ Done"
