#!/usr/bin/env bash

set -e

script_dir=$(dirname $0)
build_dir=${1}

mkdir -p ${build_dir}
cd ${build_dir}

export CC=/usr/bin/clang
export CXX=/usr/bin/clang++

# Allow user to set nproc for their system, if desired
if [ -z "${JAIA_BUILD_NPROC}" ]; then
    JAIA_BUILD_NPROC=`nproc`
fi


# install nvm if not installed
if [ ! -d "/usr/local/nvm" ]
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

# Print Node and Npm version
echo "Node Version:"
node -v
echo "NPM Version:"
npm -v

echo "Building with ${JAIA_BUILD_NPROC} parallel processes..."

(set -x; cmake ../..)
(set -x; time make -j${JAIA_BUILD_NPROC})
(set -x; chmod -R ugo+r *)
