#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

set -e

pushd "$DIR"

output_path='dist/client'
[[ ! -z "$1" ]] && output_path="$1"

SUDO=
[[ $UID -ne 0 ]] && SUDO=sudo

cat <<EOM > common/version.js
module.exports = "${AXSERVER_VERSION}"
EOM

function add_node_repo_to_host() {
    # Add NodeSource repo if we haven't already
                if [ ! -e /usr/lib/apt/methods/https ]; then
                        apt-get -y install apt-transport-https
                fi
    if [ ! -f /etc/apt/sources.list.d/nodejs-latest.list ]
    then
      echo "Configuring local apt with NodeJS repository"
      $SUDO apt-key adv --keyserver hkp://${KEYSERVER}:80 --recv-key 9FD3B784BC1C6FC31A8A0A1C1655A0AB68576280
      $SUDO sh -c 'echo "deb http://deb.nodesource.com/node_10.x/ $(lsb_release -sc) main" > /etc/apt/sources.list.d/nodejs-latest.list'
      $SUDO apt-get update
    fi
}

which npm &> /dev/null || { 
	echo "NPM not installed! Installing..."; 
	add_node_repo_to_host
	$SUDO apt-get update
	$SUDO apt-get -y install nodejs npm
	which npm &> /dev/null || { 
		echo "NPM did not install successfully. Node version (should be 10.x):"
		node --version
		exit 2 
	}
}

which webpack &> /dev/null || $SUDO npm install -g --no-audit webpack webpack-cli

if [[ "$DIR/package.json" -nt "$DIR/node_modules" ]]
then
	echo "Installing dependencies"
	npm install --no-audit
  # Touch, in case no modules had to be installed
  touch "$DIR/node_modules"
fi

echo "🟢 Building app package"

pushd client/icons
  make
popd

webpack --mode development --display "errors-only" --display-error-details --optimize-minimize --bail  --output-path $output_path # --display errors-only 
echo "✅ Done"
