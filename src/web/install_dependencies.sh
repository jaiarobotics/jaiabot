#!/bin/bash

# Install dependencies to current directory, or command-line parameter
if [[ -z $1 ]]; then
    NODE_MODULES_DIR="./"
else
    NODE_MODULES_DIR=$1
fi

echo 🟢 Installing npm dependencies to: $NODE_MODULES_DIR

if [ -d "${NODE_MODULES_DIR}node_modules" ]; then
    if [ "$(find "node_modules" -maxdepth 0 -printf '%u\n')" == "root" ]; then
        echo "Running with root privileges to remove node_modules."
        sudo rm -rf "${NODE_MODULES_DIR}node_modules"
    fi

    if [ -d "${NODE_MODULES_DIR}node_modules/ol-layerswitcher" ]; then
        echo "Remove ol-layerswitcher before install"

        if [ "$(find "node_modules/ol-layerswitcher" -maxdepth 0 -printf '%u\n')" == "root" ]; then
            echo "Running with root privileges to remove node_modules/ol-layerswitcher."
            sudo rm -rf "${NODE_MODULES_DIR}node_modules/ol-layerswitcher"
        else
            echo "Not running with root privileges to remove node_modules/ol-layerswitcher."
            rm -rf "${NODE_MODULES_DIR}node_modules/ol-layerswitcher"
	fi
    fi
fi

if [ "$(find "package-lock.json" -maxdepth 0 -printf '%u\n')" == "root" ]; then
    echo "Running with root privileges to remove package-lock.json."
    sudo rm -rf "${NODE_MODULES_DIR}package-lock.json"
fi

cd $NODE_MODULES_DIR
npm install --no-audit --quiet
