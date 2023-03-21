# Environment Setup

Note: The JaiaBot environment works __exclusively with Ubuntu 20.04__ 

## Clone JaiaBot Repo On Local Machine

This needs to be done in __your home directory__. For example if your user name is janesmith, the JaiaBot repo should be cloned in your home folder located at "/home/janesmith".

```
# cd /home/janesmith
git clone https://github.com/jaiarobotics/jaiabot.git
cd ~/jaiabot/scripts
./setup-tools-build.sh
./setup-tools-runtime.sh
cd ..
```

## Install Dependencies

The JaiaBot software depends on Goby3, MOOS, and other packages.

When using the `jaiabot` Debian packages, these dependencies are automatically installed by `apt`.

When building from source, these can be installed from the regular Ubuntu package repositories plus the `packages.jaia.tech` mirror of the `packages.gobysoft.org` repository (also reference the steps in jaiabot/.docker/focal/amd64/Dockerfile):

```
# add mirror of packages.gobysoft.org to your apt sources
echo "deb http://packages.jaia.tech/ubuntu/gobysoft/1.y/ `lsb_release -c -s`/" | sudo tee /etc/apt/sources.list.d/gobysoft_release.list
# install the public key for packages.gobysoft.org
sudo apt-key adv --recv-key --keyserver keyserver.ubuntu.com 19478082E2F8D3FE
# update apt
sudo apt update
# install the required dependencies
sudo apt-get -y install libgoby3:amd64 \
            libgoby3-dev:amd64 \
            libgoby3-moos-dev:amd64 \
            libgoby3-moos:amd64 \
            libgoby3-gui-dev:amd64 \
            goby3-interfaces:amd64 \
            libnanopb-dev:amd64 \
            nanopb:amd64 \
            python3-protobuf:amd64 \
            wget:amd64 \
            curl:amd64 \
            nodejs:amd64 \
            webpack:amd64 \
            npm:amd64
```

## Configure Using CMake

The `jaiabot` software is configured using CMake which (by default) then generates Makefiles that the `make` tool uses to invoke the C++ compiler and linker.

This process is summarized by:

```
# make a directory for the generated objects
mkdir -p build/amd64
cd build/amd64
# configure the project
cmake ../..
# build it (using make by default)
cmake --build .
# return to root directory
cd ../..
```

Webpack should compile with 55 errors in this step. Ignore them for now and proceed to the next step. These errors will be resolved in the Build step below. 

## Install Goby, MOOS, and Jaia Code

```
# add mirror of packages.gobysoft.org to your apt sources
echo "deb http://packages.jaia.tech/ubuntu/gobysoft/1.y/ `lsb_release -c -s`/" | sudo tee /etc/apt/sources.list.d/gobysoft_release.list
# install the public key for packages.gobysoft.org
sudo apt-key adv --recv-key --keyserver keyserver.ubuntu.com 19478082E2F8D3FE
# add packages.jaia.tech to your apt sources
echo "deb http://packages.jaia.tech/ubuntu/continuous/1.y/ `lsb_release -c -s`/" | sudo tee /etc/apt/sources.list.d/jaiabot_release.list
# install the public key for packages.jaia.tech
sudo apt-key adv --recv-key --keyserver keyserver.ubuntu.com 954A004CD5D8CF32
sudo apt update
# install the Goby and MOOS apps
sudo apt install goby3-apps goby3-moos goby3-gui moos-ivp-apps moosdb10 libmoos-ivp
# install the jaia code
sudo apt install jaiabot-apps jaiabot-python jaiabot-config jaiabot-web
# optional: compiled Arduino sketches and upload scripts
sudo apt install jaiabot-arduino
# optional: compiled documentation to /usr/share/doc/jaiabot/html
sudo apt install jaiabot-doc
# optional: Goby clang tool interface definitions (publish/subscribe API) to /usr/share/jaiabot/interfaces
sudo apt install jaiabot-interfaces
```

## Build

From the root of the JaiaBot repo, run the build script:

```
./build.sh
```

## Build the Web Interface

There are three components comprising the Jaia Web Interface.  These are described in the following sections.

### Command Control

Command Control is the main map page, which allows the user to define new missions by clicking to define waypoints, etc.  This web app is written in JavaScript and uses the React and OpenLayers libraries.  Command Control must be built as follows:

```
cd src/web/command_control
./build.sh
cd ..
```

This will place the product into the `command_control/dist/client` directory.

### Server

In the jaiabot/src/web directory run:

```
pip install -r requirements.txt
```

In addition to the `flask` module, you need to have the python `dccl` module installed. Clone this repository outside of your local copy of the JaiaBot repo.

```
sudo apt install python3 python3-dev python3-pip python3-protobuf
git clone https://github.com/GobySoft/dccl.git
cd dccl
./build.sh
cd python
pip3 install .
```

## Launch the Simulation

Start ntp (or put it in the bashrc)

```
sudo /etc/init.d/ntp start
```

Generate the single launch file for the simulation

```
cd ~/jaiabot/config/launch/simulation
# For 4 bots and a time warp of 5:
./generate_all_launch.sh 4 5
```

Launch the simulation

```
cd ~/jaiabot/config/launch/simulation
./all.launch
```

## Launch the Server

After the simulation is running and continiously logging information to the console, it is time to run the server in a different terminal.

Run JaiaBot Command & Control (in a different terminal)

```
cd ~/jaiabot/src/web
./run.sh
```

Go to http://localhost:40001/ to view the simulator

Estimated environment setup time: 30 - 60 minutes
