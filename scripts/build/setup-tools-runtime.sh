#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Removing timesyncd (conflicts with ntp)"
sudo apt remove systemd-timesyncd

# What the jaiabot packages themselves need, read from debian/control rather than duplicated
# here - the copy that used to live in this script had drifted, missing python3-geojson,
# python3-shapely and python3-simplejson among others
echo "Installing the jaiabot packages' runtime dependencies"
${script_dir}/install-runtime-deps.sh jaiabot-python jaiabot-web jaiabot-embedded

# Extras that are useful on a development machine but are not dependencies of any jaiabot
# package: GUI and debugging tools, and the -dev packages for building against goby
echo "Installing development tools"
sudo apt-get install -y i2c-tools libgoby3-moos libgoby3-moos-dev libxcb-xinerama0 \
     moos-ivp-gui opencpn parallel python3-dateutil python3-pyqt5 screen socat
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
