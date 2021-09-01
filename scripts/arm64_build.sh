#!/bin/bash

script_dir=$(dirname $0)

mkdir -p ${script_dir}/../build
cd ${script_dir}/../build

export CC=/usr/bin/clang
export CXX=/usr/bin/clang++

(set -x; cmake .. -DCMAKE_SYSTEM_NAME=Linux -DCMAKE_SYSTEM_PROCESSOR=aarch64 -DCMAKE_C_FLAGS="-target aarch64-linux-gnu" -DCMAKE_CXX_FLAGS="-target aarch64-linux-gnu")
(set -x; make -j`nproc`)
