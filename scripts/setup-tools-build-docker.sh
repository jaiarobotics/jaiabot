#!/bin/bash

# Add Docker’s official GPG key:
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
# Use the following command to set up the stable repository
echo \
  "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
# Update the apt package index, and install the latest version of Docker Engine and containerd
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io
# Create the docker group and add your user
sudo usermod -aG docker $USER
newgrp docker
# Verify that you can run docker commands without sudo
docker run hello-world
# Configure Docker to start on boot
sudo systemctl enable docker.service
sudo systemctl enable containerd.service
# Build the container
cd ../.docker/focal/arm64
docker build -t gobysoft/jaiabot-ubuntu-arm64:20.04.1 .
# Optionally, push to docker hub
docker push gobysoft/jaiabot-ubuntu-arm64:20.04.1
