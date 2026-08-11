#!/usr/bin/env bash

set -u -e

if [ "$(id -u)" -eq 0 ]; then
    SUDO=""
elif command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
else
    echo "This script requires root or sudo."
    exit 1
fi

script_dir=$(dirname $BASH_SOURCE)
set -a; source ${script_dir}/../common-versions.env; set +a 

# Prereqs
$SUDO apt-get -y update
$SUDO apt-get -y install gnupg lsb-release curl git
# Install the public key for packages.gobysoft.org / packages.jaia.tech
export GOBYSOFT_SIGNING_KEY=19478082E2F8D3FE
export JAIABOT_SIGNING_KEY=954A004CD5D8CF32
$SUDO install -d -m 0755 /etc/apt/keyrings
gpg --keyserver keyserver.ubuntu.com --recv-keys ${GOBYSOFT_SIGNING_KEY} && gpg --export ${GOBYSOFT_SIGNING_KEY} | $SUDO tee /etc/apt/keyrings/gobysoft.gpg > /dev/null
gpg --keyserver keyserver.ubuntu.com --recv-keys ${JAIABOT_SIGNING_KEY} && gpg --export ${JAIABOT_SIGNING_KEY} | $SUDO tee /etc/apt/keyrings/jaiabot.gpg > /dev/null
# Add packages.gobysoft.org mirror to your apt sources
default_version=${jaia_version_release_branch}
echo "deb [signed-by=/etc/apt/keyrings/gobysoft.gpg] http://packages.jaia.tech/ubuntu/gobysoft/continuous/${default_version}/ $(. /etc/os-release; echo "$VERSION_CODENAME")/" | $SUDO tee /etc/apt/sources.list.d/gobysoft_continuous.list
echo "deb-src [signed-by=/etc/apt/keyrings/jaiabot.gpg] http://packages.jaia.tech/ubuntu/continuous/${default_version}/ $(. /etc/os-release; echo "$VERSION_CODENAME")/" | $SUDO tee /etc/apt/sources.list.d/jaiabot_continuous.list
# Update apt
$SUDO apt-get -y update
# Install the required dependencies
$SUDO apt-get -y build-dep jaiabot --install-recommends
# (BUG) Need non-soversioned lib?
# gmake[2]: *** No rule to make target '/usr/lib/x86_64-linux-gnu/libais.so', needed by 'lib/libjaiabot_messages.so.2.6.0+0+ge328122e'.  Stop.
$SUDO apt-get -y install libais-dev

# Install Arduino command line interface for local compilation of ino files into hex
export BINDIR=/usr/local/bin
curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | $SUDO env BINDIR="$BINDIR" sh -s ${jaia_version_arduino_cli} && \
    arduino-cli config init --overwrite && \
    arduino-cli core update-index && \
    arduino-cli core install arduino:avr

# Install nvm, npm, and webpack
curl https://raw.githubusercontent.com/creationix/nvm/${jaia_version_nvm}/install.sh | bash

export NODE_VERSION=${jaia_version_nodejs}

if [ -n "${XDG_CONFIG_HOME-}" ] && [ -d "${XDG_CONFIG_HOME}/nvm" ]; then
    export NVM_DIR="${XDG_CONFIG_HOME}/nvm"
elif [ -d "${HOME}/.nvm" ]; then
    export NVM_DIR="${HOME}/.nvm"
else
    echo "Error: Neither \$XDG_CONFIG_HOME/nvm nor \$HOME/.nvm exists." >&2
    exit 1
fi

# We have to source the "~/.nvm/nvm.sh" script in order to set the paths to use the
#   nvm versions of webpack and npm
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && . "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# Now we use nvm to install the correct version of node FIRST, so npm is compatible
nvm install ${NODE_VERSION}
nvm alias default ${NODE_VERSION}
nvm use ${NODE_VERSION}
# Now npm can upgrade itself
npm install -g npm@${jaia_version_npm}
# Then, npm can install webpack
npm install -g --no-audit webpack@${jaia_version_webpack} webpack-cli@${jaia_version_webpack_cli}

# Check if pre-commit hook is installed
if [ ! -e ${script_dir}/../../.git/hooks/pre-commit ]; then
   # Check if there is a broken symlink
   if [ -L ${script_dir}/../../.git/hooks/pre-commit ]; then
      rm ${script_dir}/../../.git/hooks/pre-commit
   fi
   # Install the pre-commit hook
   ${script_dir}/../git-hooks/clang-format-hooks/git-pre-commit-format install
fi
