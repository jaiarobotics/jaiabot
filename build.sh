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

echo "******************************************************************"
echo "$(dirname $0)"

script_dir=$(dirname $0)

ARCH=$(dpkg --print-architecture)

set -e -u
mkdir -p ${script_dir}/build/${ARCH}

# install clang-format hook if not installed
[ ! -e ${script_dir}/.git/hooks/pre-commit ] && ${script_dir}/scripts/clang-format-hooks/git-pre-commit-format install

# install nvm if not installed
if [ ! -d "${HOME}/.nvm" ]
then
        echo "nvm not installed! Installing...";
  curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash

  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
  [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

  npm install -g npm@9.6.4
  nvm install v18.12.1
  nvm use v18.12.1
  npm install i -g --no-audit webpack webpack-cli
fi

echo "Configuring..."
cd ${script_dir}/build/${ARCH}
(set -x; cmake ../.. ${JAIABOT_CMAKE_FLAGS})
echo "Building with ${JAIA_BUILD_NPROC} parallel processes..."
(set -x; time cmake --build . -- -j${JAIA_BUILD_NPROC} ${JAIABOT_MAKE_FLAGS} $@)
