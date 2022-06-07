# add packages.gobysoft.org to your apt sources
echo "deb http://packages.gobysoft.org/ubuntu/release/ `lsb_release -c -s`/" | sudo tee /etc/apt/sources.list.d/gobysoft_release.list
# install the public key for packages.gobysoft.org
sudo apt-key adv --recv-key --keyserver keyserver.ubuntu.com 19478082E2F8D3FE
# update apt
sudo apt update
# install the required dependencies
sudo apt install libgoby3-dev libgoby3-moos-dev libgoby3-gui-dev gpsd libnanopb-dev nanopb python3-protobuf
# install the build tools necessary
sudo apt install cmake g++ clang-format
# install packages to allow apt to use a repository over HTTPS:
sudo apt-get install apt-transport-https ca-certificates curl gnupg lsb-release
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
# optionally, push to docker hub
docker push gobysoft/jaiabot-ubuntu-arm64:20.04.1
