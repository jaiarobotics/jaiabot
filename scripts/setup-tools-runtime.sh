#!/usr/bin/env bash

echo "Removing timesyncd (conflicts with ntp)"
sudo apt remove systemd-timesyncd
echo "Installing apt packages"
sudo apt-get install -y goby3-apps goby3-gui goby3-moos dccl4-apps parallel moos-ivp-apps moos-ivp-gui libmoos-ivp opencpn i2c-tools libgoby3-moos libgoby3-moos-dev libxcb-xinerama0 ntp screen python3-dateutil python3-plotly python3-pyqt5 python3-h5py python3-geopandas python3-matplotlib python3-flask python3-networkx socat python3-dataclasses-json python3-rasterio python3.12-venv gpsd
echo "Creating /etc/jaiabot directory"
sudo install -d -m 0755 -o $USER /etc/jaiabot
echo "Creating /var/log/jaiabot directory"
sudo install -d -m 0755 -o $USER /var/log/jaiabot
echo "Creating /var/log"

echo "updating PATH in ~/.bashrc if not already present"
if ! grep -q 'jaiabot/build/amd64/bin' "$HOME/.bashrc"; then
    echo "export PATH=$(dirname "$(pwd)")/build/amd64/bin:$(dirname "$(pwd)")/build/arm64/bin:\$HOME/.local/bin:\$PATH" >> "$HOME/.bashrc"
    echo "PATH entry added to ~/.bashrc"
else
    echo "PATH entry already present in ~/.bashrc"
fi
