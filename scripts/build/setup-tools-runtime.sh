#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Removing timesyncd (conflicts with ntp)"
sudo apt remove systemd-timesyncd

# read from debian/control rather than duplicated here, where the list had drifted
echo "Installing the jaiabot packages' runtime dependencies"
${script_dir}/install-runtime-deps.sh jaiabot-python jaiabot-web jaiabot-embedded

# useful on a development machine but not dependencies of any jaiabot package
echo "Installing development tools"
sudo apt-get install -y dccl5-apps i2c-tools libgoby3-moos libgoby3-moos-dev libxcb-xinerama0 \
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
