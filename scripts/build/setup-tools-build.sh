#!/usr/bin/env bash
#
# Installs the tools required to build this source tree: apt build dependencies (including the
# ninja and clang cross-compilers), arduino-cli (for compiling .ino sketches), and
# nvm/node/npm/webpack (for the web frontend). Requires root or sudo.
#
# Prints only a high-level status line per step; each step's full output is captured and only
# shown (then this script exits) if that step fails.

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

export GOBYSOFT_SIGNING_KEY=19478082E2F8D3FE
export JAIABOT_SIGNING_KEY=954A004CD5D8CF32

log=$(mktemp)
trap 'rm -f "${log}"' EXIT

# Runs "$@" (a command or a function name) with its output captured to $log; on failure, dumps
# that output and exits.
step() {
    local description=$1
    shift
    echo "🟢 ${description}..."
    if ! "$@" > "${log}" 2>&1; then
        echo "❌ ${description} failed:" >&2
        cat "${log}" >&2
        exit 1
    fi
}

# Wraps apt-get so it never prompts. Passed via env rather than exported, since sudo's
# env_reset would otherwise strip DEBIAN_FRONTEND before apt-get sees it.
apt_get() {
    $SUDO env DEBIAN_FRONTEND=noninteractive apt-get -y "$@"
}

install_prereqs() {
    apt_get update
    apt_get install gnupg lsb-release curl git
}

install_apt_keys() {
    $SUDO install -d -m 0755 /etc/apt/keyrings

    if [ ! -e /etc/apt/keyrings/gobysoft.gpg ]; then
        gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys ${GOBYSOFT_SIGNING_KEY}
        gpg --export ${GOBYSOFT_SIGNING_KEY} | $SUDO tee /etc/apt/keyrings/gobysoft.gpg > /dev/null
    fi
    if [ ! -e /etc/apt/keyrings/jaiabot.gpg ]; then
        gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys ${JAIABOT_SIGNING_KEY}
        gpg --export ${JAIABOT_SIGNING_KEY} | $SUDO tee /etc/apt/keyrings/jaiabot.gpg > /dev/null
    fi
}

add_apt_sources() {
    default_version=${jaia_version_release_branch}
    target_ubuntu_codename=${jaia_version_ubuntu_codename}
    echo "deb [signed-by=/etc/apt/keyrings/gobysoft.gpg] http://packages.jaia.tech/ubuntu/gobysoft/continuous/${default_version}/ $(. /etc/os-release; echo "$VERSION_CODENAME")/" | $SUDO tee /etc/apt/sources.list.d/gobysoft_continuous.list
    echo "deb-src [signed-by=/etc/apt/keyrings/jaiabot.gpg] http://packages.jaia.tech/ubuntu/continuous/${default_version}/ ${target_ubuntu_codename}/" | $SUDO tee /etc/apt/sources.list.d/jaiabot_continuous.list
    apt_get update
}

install_build_deps() {
    apt_get build-dep jaiabot --install-recommends
    # (BUG) Need non-soversioned lib?
    # gmake[2]: *** No rule to make target '/usr/lib/x86_64-linux-gnu/libais.so', needed by 'lib/libjaiabot_messages.so.2.6.0+0+ge328122e'.  Stop.
    apt_get install libais-dev ninja-build clang clang-tools
}

install_arduino_cli() {
    export BINDIR=/usr/local/bin
    curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | $SUDO env BINDIR="$BINDIR" sh -s ${jaia_version_arduino_cli}
    arduino-cli config init --overwrite
    arduino-cli core update-index
    arduino-cli core install arduino:avr
}

install_node_toolchain() {
    curl https://raw.githubusercontent.com/creationix/nvm/${jaia_version_nvm}/install.sh | bash

    export NODE_VERSION=${jaia_version_nodejs}

    if [ -n "${XDG_CONFIG_HOME-}" ] && [ -d "${XDG_CONFIG_HOME}/nvm" ]; then
        export NVM_DIR="${XDG_CONFIG_HOME}/nvm"
    elif [ -d "${HOME}/.nvm" ]; then
        export NVM_DIR="${HOME}/.nvm"
    else
        echo "Error: Neither \$XDG_CONFIG_HOME/nvm nor \$HOME/.nvm exists." >&2
        return 1
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
}

install_precommit_hook() {
    # Check if there is a broken symlink
    if [ -L ${script_dir}/../../.git/hooks/pre-commit ] && [ ! -e ${script_dir}/../../.git/hooks/pre-commit ]; then
        rm ${script_dir}/../../.git/hooks/pre-commit
    fi

    if [ ! -e ${script_dir}/../../.git/hooks/pre-commit ]; then
        (cd ${script_dir}/../git-hooks/clang-format-hooks && ./git-pre-commit-format install)
    fi
}

step "Updating apt and installing prerequisites" install_prereqs
step "Installing the packages.jaia.tech / packages.gobysoft.org apt signing keys" install_apt_keys
step "Adding the packages.jaia.tech / packages.gobysoft.org apt mirror" add_apt_sources
step "Installing apt build dependencies (this can take a while)" install_build_deps
step "Installing arduino-cli" install_arduino_cli
step "Installing nvm, node, npm and webpack" install_node_toolchain
step "Installing the clang-format pre-commit hook" install_precommit_hook

echo "🟢 Setup complete."
