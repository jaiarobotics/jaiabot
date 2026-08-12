#!/usr/bin/env bash

# Cross-compiles jaiabot into $1 (a directory relative to the jaiabot root). Runs inside the build
# container created by container-image-build.sh, which provides the cross-compiler, node and
# the arm64 dependencies.
#
# Env var "jaiabot_machine_type" can be set to "virtualbox" to build amd64 binaries instead of the
# arm64 embedded system binaries.

set -e

build_dir=$1

if [ -z "${build_dir}" ]; then
    echo "❌ Usage: $0 <build_dir relative to the jaiabot root, e.g. build/resolute-3.y-arm64>"
    exit 1
fi

jaia_root=$(cd "$(dirname "$0")/../.." && pwd)

mkdir -p "${jaia_root}/${build_dir}"
cd "${jaia_root}/${build_dir}"

export CC=/usr/bin/clang
export CXX=/usr/bin/clang++

cmake_args=()
if [[ "${jaiabot_machine_type}" != "virtualbox" ]]; then
    cmake_args=(-DCMAKE_SYSTEM_NAME=Linux -DCMAKE_SYSTEM_PROCESSOR=aarch64
                -DCMAKE_C_FLAGS="-target aarch64-linux-gnu"
                -DCMAKE_CXX_FLAGS="-target aarch64-linux-gnu")
fi

echo "Building with node $(node -v), npm $(npm -v) and ${JAIA_BUILD_NPROC:=$(nproc)} parallel processes..."

(set -x; cmake "${jaia_root}" "${cmake_args[@]}")
(set -x; time make -j"${JAIA_BUILD_NPROC}")
# the build runs as root in the container, so make the output readable to the host user
(set -x; chmod -R ugo+r .)
