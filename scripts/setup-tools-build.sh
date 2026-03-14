#!/usr/bin/env bash

script_dir=$(dirname $BASH_SOURCE)
set -a; source ${script_dir}/common-versions.env; set +a 

# Install packages to allow apt to use a repository over HTTPS:
sudo apt-get -y install apt-transport-https ca-certificates curl gnupg lsb-release wget
# Add packages.gobysoft.org mirror to your apt sources
default_version=${jaia_version_release_branch}
echo "deb http://packages.jaia.tech/ubuntu/gobysoft/continuous/${default_version}/ `lsb_release -c -s`/" | sudo tee /etc/apt/sources.list.d/gobysoft_continuous.list
# Install the public key for packages.gobysoft.org
sudo apt-key adv --recv-key --keyserver hkp://keyserver.ubuntu.com:80 19478082E2F8D3FE
# Update apt
sudo apt-get -y update

# --- ADDED: OpenCV installation via APT ---
# This provides the build-time headers and runtime .so files for vision
sudo apt-get -y install libopencv-dev

# Install the required dependencies
sudo apt-get -y install dccl4-apps libdccl4-dev libgoby3-dev libgoby3-moos-dev libgoby3-gui-dev gpsd libnanopb-dev nanopb rsync python3-venv python3-protobuf python3-netifaces python3-dev gdal-bin
# Install the build tools necessary
sudo apt-get -y install cmake g++ npm clang-format clang graphviz doxygen libstdc++14-dev

# --- ByteTrack-cpp (Vertical-Beach) ---
# Requires Eigen3 (header-only, available via apt) and builds from source.
sudo apt-get -y install libeigen3-dev
if [ ! -f "/usr/local/lib/libByteTrack.a" ]; then
    echo "Installing ByteTrack-cpp..."
    git clone https://github.com/Vertical-Beach/ByteTrack-cpp.git /tmp/ByteTrack-cpp
    mkdir -p /tmp/ByteTrack-cpp/build
    cmake -S /tmp/ByteTrack-cpp -B /tmp/ByteTrack-cpp/build
    make -C /tmp/ByteTrack-cpp/build -j$(nproc)
    sudo cp /tmp/ByteTrack-cpp/build/libbytetrack.so /usr/local/lib/
    sudo mkdir -p /usr/local/include/ByteTrack
    sudo cp -r /tmp/ByteTrack-cpp/include/ByteTrack /usr/local/include/
    sudo ldconfig
    rm -rf /tmp/ByteTrack-cpp
fi

# --- ADDED: ONNX Runtime Manual "Installation" ---
# Since it's not in the Noble apt repos, we pull the binary directly to /usr/local
# This provides both Build-time (headers) and Runtime (shared libs)
ORT_VERSION="1.24.3"
if [ ! -f "/usr/local/lib/libonnxruntime.so" ]; then
    echo "Installing ONNX Runtime ${ORT_VERSION}..."
    wget https://github.com/microsoft/onnxruntime/releases/download/v${ORT_VERSION}/onnxruntime-linux-aarch64-${ORT_VERSION}.tgz
    tar -xzf onnxruntime-linux-aarch64-${ORT_VERSION}.tgz
    sudo cp -r onnxruntime-linux-aarch64-${ORT_VERSION}/include/* /usr/local/include/
    sudo cp -r onnxruntime-linux-aarch64-${ORT_VERSION}/lib/* /usr/local/lib/
    rm -rf onnxruntime-linux-aarch64-${ORT_VERSION}*
    sudo ldconfig
fi

# Install Arduino command line interface
curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sudo BINDIR=/usr/local/bin sh && \
    arduino-cli config init --overwrite && \
    arduino-cli core update-index && \
    arduino-cli core install arduino:avr

# Install nvm, npm, and webpack
curl https://raw.githubusercontent.com/creationix/nvm/${jaia_version_nvm}/install.sh | bash

export NODE_VERSION=${jaia_version_nodejs}

if [ -z "${XDG_CONFIG_HOME-}" ]; then
    export NVM_DIR="${HOME}/.nvm"
else
    export NVM_DIR="${XDG_CONFIG_HOME}/nvm"
fi


# We have to source the "~/.nvm/nvm.sh" script in order to set the paths to use the
#   nvm versions of webpack and npm
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# Now we use nvm to install the correct version of node FIRST, so npm is compatible
nvm install ${NODE_VERSION}
nvm alias default ${NODE_VERSION}
nvm use ${NODE_VERSION}
# Now npm can upgrade itself
npm install -g npm@${jaia_version_npm}
# Then, npm can install webpack
npm install -g --no-audit webpack@${jaia_version_webpack} webpack-cli@${jaia_version_webpack_cli}

# Check if pre-commit hook is installed
if [ ! -e ${script_dir}/../.git/hooks/pre-commit ]; then
   # Check if there is a broken symlink
   if [ -L ${script_dir}/../.git/hooks/pre-commit ]; then
      rm ${script_dir}/../.git/hooks/pre-commit
   fi
   # Install the pre-commit hook
   ${script_dir}/../scripts/git-hooks/clang-format-hooks/git-pre-commit-format install
fi
