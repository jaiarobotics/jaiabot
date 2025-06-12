# Working With Jaia Software

### Table of Contents:
- [Launching The Simulator on Macbooks](#launching-the-sumulator-on-macbooks)
- [Launching The Simulator on Windows](#launching-the-simulator-on-windows)
- [Troublshooting the Simulator](#Troubleshooting)
- [Creating an SSH Key (Macbooks)](#sshkey)
- [Modifying Code](#modifying-code)
- [Deploying Code](#deploying-code)

<br>
<a id="launching-the-simulator-on-macbooks"></a>

# Launching the Simulator on Macbooks
Note: The Jaia simulator works with __Ubuntu 20.04 (branch: 1.y), 22.04 (branch: 1.y), 24.04 (branch: 2.y)
1. Open Multipass and Launch Ubuntu 24.04 LTS 
2. Navigate to ‘All Instances’ and stop "personal-shell-name". 
3. Click on <personal-shell-name> in ‘Name’ column. Switch from ‘Shells’ to ‘Details’ at the top. 
4. Click ‘Configure’ under ‘Resources’. Change CPUs to 4+, Memory to 4+, Disk to 10+. 
5. Navigate back to ‘All Instances’ and start <personal-shell-name>. 
6. 'Open shell' option in Multipass may not work on Mac. If so, launch Multipass shell in Mac Terminal.  
```
multipass shell <personal-shell-name>
```
7. Clone the jaiabot repo (https://github.com/jaiarobotics/jaiabot)
```
(install git if needed)
sudo apt install git
git clone https://github.com/jaiarobotics/jaiabot
```
8. Open Jaiabot Directory
```
cd jaiabot
```
9. Verify branch, switch to correct branch (2.y)
```
git status
git checkout 2.y #if you're in 1.y
```
10. Run the setup scripts
```
cd /path/to/jaiabot/scripts
./setup-tools-build.sh
./setup-tools-runtime.sh
```
11. Run the build script
```
cd /path/to/jaiabot
./build.sh
```
12. Launch the JCC web interface
```
cd /path/to/jaiabot/src/web
./run.sh
# Should look like: WARNING:root:🏓 Pinging server localhost:40000
```
13. Launch the simulator in a separate terminal (Toolbar > Shell > New > Window)
```
multipass shell <personal-shell-name>
cd /path/to/jaiabot/config/launch/simulation
# Set the simulation to run 4 bots at a time warp of 5
./generate_all_launch.sh 4 5
./all.launch
# Should look like: [all] XX:XX:XX: All processes running
```
14. Once that's running, open a tab in your preferred browser 
15. Open Multipass and find your Private IP address associated with Ubuntu environment 
    * for example: XXX.XXX.XX.X
16. Enter that IP address into your search bar with :40001 appended to the end 
    * for example: XXX.XXX.XX.X:40001
Simulator should be up and running!

<br>
<a id="launching-the-simulator-on-windows"></a>

# Launching the Simulator on Windows

1. Launch Ubuntu 24.04 
2. Clone the Jaiabot Repo
```
# install git if needed
sudo apt install git
git clone https://github.com/jaiarobotics/jaiabot​
```
3. Open Jaiabot Directory 
```
cd jaiabot
```
4. Verify branch, switch to correct branch (2.y)
```
git status
git checkout 2.y #if you're in 1.y
```
5. Run the setup scripts
```
cd /path/to/jaiabot/scripts
./setup-tools-build.sh
./setup-tools-runtime.sh
```
6. Run the build script
```
cd /path/to/jaiabot
./build.sh
```
7. Launch the JCC web interface
```
cd /path/to/jaiabot/src/web
./run.sh
# Should look like: WARNING:root:🏓 Pinging server localhost:40000
```
8. Launch the simulator in a separate terminal (Toolbar > Shell > New > Window)
```
multipass shell <personal-shell-name>
cd /path/to/jaiabot/config/launch/simulation
# Set the simulation to run 4 bots at a time warp of 5
./generate_all_launch.sh 4 5
./all.launch
# Should look like: [all] XX:XX:XX: All processes running
```
9. Simulator should pop up on broswer -- It is running successfully!

<br>
<a id="Troubleshooting"></a>

# Troubleshooting the Simulator
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
* Verify you are using Python 3.12
* Purge multipass in terminal if there's no space on disk or memory

<br>
<a id="sshkey"></a>

# Creating an SSH Key (Mackbook Users)

1. Make sure Multipass is running 
2. Open one terminal and run Multipass 
```
Multipass Shell "personal-shell-name"
```
3. Enter your home directory and ssh key
```
cd ~/.ssh
ls
# should see an authorized_keys file
```
4. Enter the authorized_key files 
```
nano authroized_keys
```
5. Switch to your local computer on another terminal window. Generate SSH key. 
```
cd .ssh
ssh-keygen
# may have to hit enter multiple times to bypass passwords
ls
# should see a key that is of the form id_edXXXXX and id_edXXXXX.pub
cat id_edXXXXX.pub 
# this should generate a key
```
6. Copy and paste the output from the previous step into the nano file in the other terminal window. 
    
    * CTRL+o, enter, CTRL+x 
    * This saves and closes the nano tab

7. Switch back to other terminal (local computer terminal). Set up config file
```
nano config
```
8. Inside the config file enter this text. Then save and exit:
```
IdentityFile ~/.ssh/id_edXXXXX

Host jaia
HostName "IP address from multipass instance" 
IdentityFile ~/.ssh/id_edXXXXX
User ubuntu
```
9. Entering the environment
```
ssh ubuntu@XXX.XXX.XX.X # your private IP address
```
10. If prompted, enter Yes (Y)
11. Logout of the environment 
```
Exit
```
12. Open your IDE (We reccomend VSCode) and download "Remote-SSH" Extension
13. (Shift, Command+P) -- This opens the search bar. Search "ssh." Select "Remote-SSH: Add New SSH Host..." and hit Enter
14. Type "ssh ubuntu@XXX.XXX.XX.X" in search bar. Hit Enter.
15. Select /ssh/config. Hit enter. 
16. There should be a popup in the bottom right corner. Hit "Connect".
17. Your SSH should be set up! 

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
