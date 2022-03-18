#! /bin/bash

# Check for sudo
if [ "$EUID" -ne 0 ]
  then echo "Please run as root"
  exit
fi

# Check for 2 arguments
if [ -z $1 ] || [ -z $2 ] ; then echo "Usage: ./setup_embedded.sh bot/hub id_number"; exit
fi

# Check for bot or hub
if [ $1 != "bot" ] && [ $1 != "hub" ]; then echo "You must enter bot or hub as first argument"; exit; fi

# Check for number
if [ $2 -eq $2 ] 2>/dev/null; then :
else echo "You must enter an integer as the second argument"; exit
fi

echo "===Setting up as $1, number $2"

echo "===Setting up boot config"
cp config.txt /boot/firmware

echo "===Setting hostname to jaia$1$2"
echo "jaia$1$2" > /etc/hostname

echo "===Setting up swap partition"
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
fstab_entry="/swapfile swap swap defaults 0 0"
grep "$fstab_entry" /etc/fstab || echo "$fstab_entry" >> /etc/fstab

echo "===Installing runtime apt packages"
# add packages.gobysoft.org to your apt sources
echo "deb http://packages.gobysoft.org/ubuntu/release/ `lsb_release -c -s`/" | sudo tee /etc/apt/sources.list.d/gobysoft_release.list
# install the public key for packages.gobysoft.org
apt-key adv --recv-key --keyserver keyserver.ubuntu.com 19478082E2F8D3FE
apt update
apt install -y gpsd gpsd-clients python3-pip goby3-apps goby3-gui

echo "===Setting up i2c"
groupadd i2c
chown :i2c /dev/i2c-1
chmod g+rw /dev/i2c-1
usermod -aG i2c ubuntu
udev_entry='KERNEL=="i2c-[0-9]*", GROUP="i2c"'
grep "$udev_entry" /etc/udev/rules.d/10-local_i2c_group.rules || echo "$udev_entry" >> /etc/udev/rules.d/10-local_i2c_group.rules

echo "===Installing Python packages"
pip install smbus adafruit-circuitpython-busdevice adafruit-circuitpython-register

echo "===Placing run script in the home dir"
if [ $1 == 'bot' ]
then
  ln -sf ${PWD}/run.sh_bot /home/ubuntu/run.sh
else
  ln -sf ${PWD}/run.sh_hub /home/ubuntu/run.sh
fi
chmod +x /home/ubuntu/run.sh
chown ubuntu:ubuntu /home/ubuntu/run.sh

if [ $1 == 'bot' ]
then
  echo "===Setting up Arduino"
  cd /home/ubuntu/jaiabot/scripts
  sudo -u ubuntu ./setup_arduino_cli.sh
fi

echo "===Updating path in .bashrc"
if grep -q jaiabot /home/ubuntu/.bashrc
then
  echo "---entry already exists"
else
  echo "---making entry"
  echo "PATH=\${HOME}/jaiabot/build/arm64/bin:\${PATH}" >> /home/ubuntu/.bashrc
fi

echo "===Disabling u-boot waiting for any key to stop boot which really messes with the GPS if on UART like we do for RasPi3"
# As described here: https://stackoverflow.com/questions/34356844/how-to-disable-serial-consolenon-kernel-in-u-boot
cp /boot/firmware/uboot_rpi_3 /boot/firmware/uboot_rpi_3.bak
cp ./uboot_rpi_3.bin /boot/firmware/

echo "===Setting up device links"
python3 /home/ubuntu/jaiabot/scripts/setup_embedded/setup_device_links.py

echo "===Made it to the end! You need to reboot."
