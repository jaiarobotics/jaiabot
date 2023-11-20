#!/bin/bash

# Install dependencies to current directory, or command-line parameter
if [[ -z $1 ]]; then
    NODE_MODULES_DIR="./"
else
    NODE_MODULES_DIR=$1
fi

echo 🟢 Installing npm dependencies to: $NODE_MODULES_DIR

# We need to check if node_modules is already created.
# If the privileges are root then we should remove and install again as
# this may cause issues with running and installing new dependencies.
if [ -d "${NODE_MODULES_DIR}node_modules" ]; then
    if [ "$(find "node_modules" -maxdepth 0 -printf '%u\n')" == "root" ]; then
        echo "Running with root privileges to remove node_modules."
        sudo rm -rf "${NODE_MODULES_DIR}node_modules"
    fi

    # We need to check for ol-layerswitcher because it is causing jcc web
    # build errors if it already exists. We check the privileges on the folder to determine
    # if we need to escalate our priveleges to remove it.
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

# We need to check the privileges on package-lock.json because if it is root
# then we will have jcc build errors.
if [ "$(find "package-lock.json" -maxdepth 0 -printf '%u\n')" == "root" ]; then
    echo "Running with root privileges to remove package-lock.json."
    sudo rm -rf "${NODE_MODULES_DIR}package-lock.json"
fi

cd $NODE_MODULES_DIR
npm install --no-audit --quiet
