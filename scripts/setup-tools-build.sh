#!/usr/bin/env bash

# Add packages.gobysoft.org mirror to your apt sources
echo "deb http://packages.jaia.tech/ubuntu/gobysoft/1.y/ `lsb_release -c -s`/" | sudo tee /etc/apt/sources.list.d/gobysoft_release.list
# Install the public key for packages.gobysoft.org
sudo apt-key adv --recv-key --keyserver keyserver.ubuntu.com 19478082E2F8D3FE
# Update apt
sudo apt-get update
# Install the required dependencies
sudo apt-get install libgoby3-dev libgoby3-moos-dev libgoby3-gui-dev gpsd libnanopb-dev nanopb python3-protobuf
# Install the build tools necessary
sudo apt-get install cmake g++ npm clang-format clang graphviz
# Install packages to allow apt to use a repository over HTTPS:
sudo apt-get install apt-transport-https ca-certificates curl gnupg lsb-release
# Install this version of npm
npm install -g npm@9.6.4
# Install Arduino command line interface for local compilation of ino files into hex
echo asjshdfkjhdkf
curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sudo BINDIR=/usr/local/bin sh && \
    arduino-cli config init && \
    arduino-cli core update-index && \
    arduino-cli core install arduino:avr
# Add Docker’s official GPG key:
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
# Use the following command to set up the stable repository.
echo \
  "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
# Update the apt package index, and install the latest version of Docker Engine and containerd
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io
# Create the docker group and add your user.
sudo usermod -aG docker $USER
newgrp docker
# Verify that you can run docker commands without sudo.
docker run hello-world
# Configure Docker to start on boot
sudo systemctl enable docker.service
sudo systemctl enable containerd.service
# Build the container
cd ../.docker/focal/arm64
docker build -t gobysoft/jaiabot-ubuntu-arm64:20.04.1 .
# Optionally, push to docker hub
docker push gobysoft/jaiabot-ubuntu-arm64:20.04.1
