#!/bin/bash

./build.sh
pushd server
./app.py -s $1
popd server

