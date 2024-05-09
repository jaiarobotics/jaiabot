#!/usr/bin/env bash

# Add packages.gobysoft.org mirror to your apt sources
echo "deb http://packages.jaia.tech/ubuntu/gobysoft/continuous/1.y/ `lsb_release -c -s`/" | sudo tee /etc/apt/sources.list.d/gobysoft_continuous.list
# Install the public key for packages.gobysoft.org
sudo apt-key adv --recv-key --keyserver hkp://keyserver.ubuntu.com:80 19478082E2F8D3FE
# Update apt
sudo apt-get -y update
# Install the required dependencies
sudo apt-get -y install dccl4-apps libdccl4-dev libgoby3-dev libgoby3-moos-dev libgoby3-gui-dev gpsd libnanopb-dev nanopb rsync python3-venv python3-protobuf
# Install the build tools necessary
sudo apt-get -y install cmake g++ npm clang-format clang graphviz
# Install packages to allow apt to use a repository over HTTPS:
sudo apt-get -y install apt-transport-https ca-certificates curl gnupg lsb-release
# Install Arduino command line interface for local compilation of ino files into hex
curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sudo BINDIR=/usr/local/bin sh && \
    arduino-cli config init --overwrite && \
    arduino-cli core update-index && \
    arduino-cli core install arduino:avr

# Install nvm, npm, and webpack
curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash

export NODE_VERSION=v18.12.1
export NVM_DIR="$HOME/.nvm"

# We have to source the "~/.nvm/nvm.sh" script in order to set the paths to use the
#   nvm versions of webpack and npm
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# Now we use nvm to install the correct version of node FIRST, so npm is compatible
nvm install ${NODE_VERSION}
nvm use ${NODE_VERSION}
# Now npm can upgrade itself
npm install -g npm@9.6.4
# Then, npm can install webpack
npm install -g --no-audit webpack@5.89.0 webpack-cli@5.1.4
