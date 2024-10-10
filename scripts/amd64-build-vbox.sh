#!/usr/bin/env bash

set -e

script_dir=$(dirname $0)
set -a; source ${script_dir}/common-versions.env; set +a 

build_dir=${script_dir}/../build

mkdir -p ${script_dir}/../build/amd64-vbox
cd ${script_dir}/../build/amd64-vbox

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
  curl https://raw.githubusercontent.com/creationix/nvm/${jaia_version_nvm}/install.sh | bash

  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
  [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
  
  npm install -g npm@${jaia_version_npm}
  nvm install ${jaia_version_nodejs}
  nvm use ${jaia_version_nodejs}
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
