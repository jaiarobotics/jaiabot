#!/bin/bash

set -e

# Install the arduino-cli
curl -fsSL -o install_arduino-cli.sh https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh
chmod a+x install_arduino-cli.sh
export BINDIR=${HOME}/bin
mkdir -p ${BINDIR}
./install_arduino-cli.sh
rm install_arduino-cli.sh

# Soft link the libraries
mkdir -p ~/Arduino/libraries
#ln -s ~/jaiabot/src/arduino/libraries/RadioHead-1.117 .
ln -sf ${PWD}/libraries/Servo-1.1.8 ${HOME}/Arduino/libraries/
ln -sf ${PWD}/libraries/nanopb-0.4.1 ${HOME}/Arduino/libraries/

# Add ~/bin to the path
if grep -q arduino ${HOME}/.bashrc
then
  echo "entry already exists"
else
  echo '# arduino path addition' >> ${HOME}/.bashrc
  echo 'PATH=${HOME}/bin:${PATH}' >> ${HOME}/.bashrc
  export PATH=${HOME}/bin:${PATH}
fi

#Install the required packages and architectures
#arduino-cli config init --additional-urls  https://adafruit.github.io/arduino-board-index/package_adafruit_index.json
arduino-cli config init
arduino-cli core update-index
arduino-cli core install arduino:avr
#arduino-cli core install adafruit:avr
#arduino-cli board list
