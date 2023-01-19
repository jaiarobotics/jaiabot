#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

set -e

pushd "$DIR"

output_path='dist/client'
[[ ! -z "$1" ]] && output_path="$1"

if [ ! -d "${HOME}/.nvm" ]
then
	echo "nvm not installed! Installing..."; 
  curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash

  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
  [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

  nvm install v18.12.1
  nvm use v18.12.1

  # Make sure we're using the nvm webpack, not the apt one
  npm install -g --no-audit webpack webpack-cli
fi

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
