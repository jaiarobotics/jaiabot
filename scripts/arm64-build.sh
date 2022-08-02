#!/usr/bin/env bash

set -e

script_dir=$(dirname $0)
build_dir=${script_dir}/../build

mkdir -p ${script_dir}/../build/arm64
cd ${script_dir}/../build/arm64

export CC=/usr/bin/clang
export CXX=/usr/bin/clang++

# Allow user to set nproc for their system, if desired
if [ -z "${JAIA_BUILD_NPROC}" ]; then
    JAIA_BUILD_NPROC=`nproc`
fi

echo "Building with ${JAIA_BUILD_NPROC} parallel processes..."

(set -x; cmake ../.. -DCMAKE_SYSTEM_NAME=Linux -DCMAKE_SYSTEM_PROCESSOR=aarch64 -DCMAKE_C_FLAGS="-target aarch64-linux-gnu" -DCMAKE_CXX_FLAGS="-target aarch64-linux-gnu")
(set -x; time make -j${JAIA_BUILD_NPROC})
(set -x; chmod -R ugo+r *)
