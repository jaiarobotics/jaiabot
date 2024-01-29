#!/bin/bash

if [ -z "${JAIABOT_CMAKE_FLAGS}" ]; then
    JAIABOT_CMAKE_FLAGS=
fi

if [ -z "${JAIABOT_MAKE_FLAGS}" ]; then
    JAIABOT_MAKE_FLAGS=
fi

# Allow user to set nproc for their system, if desired
if [ -z "${JAIA_BUILD_NPROC}" ]; then
    JAIA_BUILD_NPROC=`nproc`
fi

script_dir=$(dirname $0)

ARCH=$(dpkg --print-architecture)

# Make sure we're using the nvm versions of npm and webpack
source $HOME/.nvm/nvm.sh

set -e -u
mkdir -p ${script_dir}/build/${ARCH}

# Install clang-format hook if not installed
[ ! -e ${script_dir}/.git/hooks/pre-commit ] && ${script_dir}/scripts/clang-format-hooks/git-pre-commit-format install

echo "Configuring..."
cd ${script_dir}/build/${ARCH}
(set -x; cmake ../.. ${JAIABOT_CMAKE_FLAGS})
echo "Building with ${JAIA_BUILD_NPROC} parallel processes..."
(set -x; time cmake --build . -- -j${JAIA_BUILD_NPROC} ${JAIABOT_MAKE_FLAGS} $@)
