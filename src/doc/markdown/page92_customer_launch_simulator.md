# Launching the Simulator
Note: The Jaia simulator works __exclusively with Ubuntu 20.04__
1. Clone the jaiabot repo (https://github.com/jaiarobotics/jaiabot)
```
(install git if neededed)
sudo apt-get install git
git clone https://github.com/jaiarobotics/jaiabot
```
2. Run the setup scripts
```
cd /path/to/jaiabot/scripts
./setup-tools-build.sh
./setup-tools-runtime.sh
```
3. Run the build script
```
cd /path/to/jaiabot
./build.sh
```
4. Launch the JCC web interface
```
cd /path/to/jaiabot/src/web
./run.sh
```
5. Launch the simulator in a separate terminal
```
cd /path/to/jaiabot/config/launch/simulation
# Set the simulation to run 4 bots at a time warp of 5
./generate_all_launch.sh 4 5
./all.launch
```
6. Troubleshooting the simulator
```
# Kill all processes, then relaunch the simulator
cd /path/to/jaiabot/scripts
./kill-jaiabot-processes.sh
```