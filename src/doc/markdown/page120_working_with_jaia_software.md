# Working With Jaia Software

### Table of Contents:
- [Launching The Simulator](#launching-the-simulator)
- [Modifying Code](#modifying-code)
- [Deploying Code](#deploying-code)

<br>
<a id="launching-the-simulator"></a>

# Launching the Simulator
Note: The Jaia simulator works with __Ubuntu 20.04 and 22.04__
1. Clone the jaiabot repo (https://github.com/jaiarobotics/jaiabot)
```
(install git if needed)
sudo apt install git
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
* Kill all processes
```
# Kill all processes, then relaunch the simulator
cd /path/to/jaiabot/scripts
./kill-jaiabot-processes.sh
```

* Refresh the build directory

```
# Remove the build directory
cd /path/to/jaiabot
rm -rf build

# Re-create the build directory
./build.sh
```

<br>
<a id="modifying-code"></a>

# Modifying Code
1. [Launch the simulator](#launching-the-simulator)
2. Modify the code as you see fit
3. Shutdown the simulator and JCC web interface
```
# Shutdown the simulator
cd /path/to/jaiabot/config/launch/simulation
Ctrl+C

# Shutdown the server
cd /path/to/jaiabot/src/web
Ctrl+C
```
4. Repeat **Steps 3 - 5** of [launching the simulator](#launching-the-simulator)
5. With the new code tested, it can be [deployed](#deploying-code) to your Jaia System or submitted for review by creating a pull request

<br>
<a id="deploying-code"></a>

# Deploying Code
1. [Modify the codebase](#modifying-code)
2. Connect to a hub router
    * Select the SSID JAIA-HUB-WIFI-X from Wi-Fi list (X indicates fleet number)
3. Create Docker image
```
cd ~/jaiabot/scripts
./docker-build-build-system.sh
```
4. Stop the jaiabot services for the system you are deploying to
```
ssh -i /path/to/key jaia@10.23.X.Y (X indicates fleet number and Y indicates bot number plus 100 or hub number plus 10)
sudo systemctl stop jaiabot
```
5. Deploy
```
cd ~/jaiabot/scripts
# BOT
jaiabot_arduino_type=usb jaiabot_systemd_type=bot ./docker-arm64-build-and-deploy.sh jaia@10.23.X.Y (X indicates fleet number and Y indicates bot number plus 100)
# HUB
jaiabot_systemd_type=hub ./docker-arm64-build-and-deploy.sh jaia@10.23.X.Y (X indicates fleet number and Y indicates hub number plus 10)
```
6. Start jaiabot services
```
ssh -i /path/to/key jaia@10.23.X.Y (X indicates fleet number and Y indicates bot number plus 100 or hub number plus 10)
sudo systemctl start jaiabot (takes about 1 min to start)
```

### Debugging
* Make sure if you are upgrading that you do the entire fleet or stop the services on the systems you are not using
* This will limit any unexpected issues as mismatched dccl packets cannot be interpreted
* If you get errors during this upgrade process please contact your Jaia representative
