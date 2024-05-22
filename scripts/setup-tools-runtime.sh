#!/usr/bin/env bash

echo "Installing apt packages"
sudo apt-get install -y goby3-apps goby3-gui goby3-moos parallel moos-ivp-apps moos-ivp-gui libmoos-ivp opencpn i2c-tools libgoby3-moos libgoby3-moos-dev python3-pip libxcb-xinerama0 ntp screen
echo "Installing pip packages"
pip install --upgrade pip
echo "Adding ~/.local/bin to PATH"
export PATH=$HOME/.local/bin:$PATH
pip install python-dateutil plotly pyQt5 h5py geopandas matplotlib flask networkx
echo "Creating /etc/jaiabot directory"
sudo install -d -m 0755 -o $USER /etc/jaiabot
echo "Creating /var/log/jaiabot directory"
sudo install -d -m 0755 -o $USER /var/log/jaiabot
echo "Creating /var/log"
echo "updating PATH"
echo "export PATH=$(dirname "$(pwd)")/build/amd64/bin:$(dirname "$(pwd)")/build/arm64/bin:$HOME/.local/bin:\$PATH" >> ~/.bashrc
