#!/bin/bash

# Install dependencies to current directory, or command-line parameter
if [[ -z $1 ]]; then
    NODE_MODULES_DIR="./"
else
    NODE_MODULES_DIR=$1
fi

echo 🟢 Installing npm dependencies to: $NODE_MODULES_DIR

cd $NODE_MODULES_DIR
npm install --no-audit --quiet
