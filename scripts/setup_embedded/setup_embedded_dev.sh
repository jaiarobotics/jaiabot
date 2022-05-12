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

# First run the steps required even when using release Debian package `jaiabot_embedded`
./setup_embedded_release.sh $*

echo "===Setting hostname to jaia$1$2"
echo "jaia$1$2" > /etc/hostname

echo "===Installing runtime apt packages"
# add packages.gobysoft.org to your apt sources
echo "deb http://packages.gobysoft.org/ubuntu/release/ `lsb_release -c -s`/" | sudo tee /etc/apt/sources.list.d/gobysoft_release.list
# install the public key for packages.gobysoft.org
apt-key adv --recv-key --keyserver keyserver.ubuntu.com 19478082E2F8D3FE
apt update
apt install -y gpsd gpsd-clients python3-pip goby3-apps goby3-gui

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

echo "===Updating path in .bashrc"
if grep -q jaiabot /home/ubuntu/.bashrc
then
  echo "---entry already exists"
else
  echo "---making entry"
  echo "PATH=\${HOME}/jaiabot/build/arm64/bin:\${PATH}" >> /home/ubuntu/.bashrc
fi

echo "===Made it to the end! You need to reboot."
