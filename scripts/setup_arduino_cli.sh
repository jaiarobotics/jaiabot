#!/bin/bash

set -e

# Install the arduino-cli
curl -fsSL -o install_arduino-cli.sh https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh
chmod a+x install_arduino-cli.sh
export BINDIR=${HOME}/bin
mkdir -p ${BINDIR}
export PATH=${HOME}/bin:${PATH}
./install_arduino-cli.sh
rm install_arduino-cli.sh

# Soft link the libraries
mkdir -p ~/Arduino/libraries
ln -sf ${PWD}../src/arduino/libraries/Servo-1.1.8 ${HOME}/Arduino/libraries/
ln -sf ${PWD}../src/arduino/libraries/nanopb-0.4.1 ${HOME}/Arduino/libraries/

# Add ~/bin to the path
if grep -q arduino ${HOME}/.bashrc
then
  echo "entry already exists"
else
  echo '# arduino path addition' >> ${HOME}/.bashrc
  echo 'PATH=${HOME}/bin:${PATH}' >> ${HOME}/.bashrc
fi

#Install the required packages and architectures
arduino-cli config init
arduino-cli core update-index
arduino-cli core install arduino:avr
