#!/bin/bash

# Install the necessary modules for the jaia user
# We could use a venv here if it becomes necessary, but I'm using the KISS principle for now.
echo "🟢 Creating venv on $HOSTNAME"
python3 -m venv venv
echo "🟢 Installing packages on $HOSTNAME"
./venv/bin/pip3 install -q ./pyjaiaprotobuf ./jaia_serial

# Copy our systemd .service file
echo "🟢 Copying camera_driver.service on $HOSTNAME"
sudo rsync ./camera/camera_driver.service /etc/systemd/system/

# Stop, reload, restart, enable
echo "🟢 Restarting camera_driver.service on $HOSTNAME"
sudo systemctl daemon-reload
sudo systemctl stop camera_driver
sudo systemctl enable camera_driver
sudo systemctl start camera_driver

echo "✅ Done"
