#!/usr/bin/env bash

echo "Installing apt packages"
sudo apt-get install goby3-apps goby3-gui goby3-moos parallel moos-ivp-apps moos-ivp-gui libmoos-ivp opencpn i2c-tools libgoby3-moos libgoby3-moos-dev python3-pip libxcb-xinerama0 ntp screen
echo "Installing pip packages"
pip install --upgrade pip
pip install python-dateutil plotly pyQt5 h5py geopandas matplotlib
echo "updating PATH"
echo "export PATH=$HOME/jaiabot/build/amd64/bin:$HOME/jaiabot/build/arm64/bin:\$PATH" >> ~/.bashrc
