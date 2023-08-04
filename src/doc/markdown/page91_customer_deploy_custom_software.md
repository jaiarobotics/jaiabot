# Customer Deploying Custom Software To Jaia Systems

## Clone JaiaBot Repo On Local Machine

```
git clone https://github.com/jaiarobotics/jaiabot.git
cd ~/jaiabot/scripts
./setup-tools-build.sh
./setup-tools-runtime.sh
```

## Connect To Hub Router

* Select the SSID JAIA-HUB-WIFI-X from Wi-Fi list (X indicates fleet number)

## Deploy Custom Software

### Make Changes To Code Base

* Make changes in the jaiabot repo
* Compile code and verify it completes without errors
```
cd ~/jaiabot
./build.sh
```

* Test code using the simulator

### Running Simulator locally (Currently only support Ubuntu 20.04)

* start ntp (or put it in the bashrc)
```
sudo /etc/init.d/ntp start
```

* Generate the single launch file for the simulation
```
cd ~/jaiabot/config/launch/simulation
# For 4 bots and a time warp of 5:
./generate_all_launch.sh 4 5
```

* Launch the simulation
```
cd ~/jaiabot/config/launch/simulation
./all.launch
```

* Run Jaia Command & Control (in a different terminal)
```
cd ~/jaiabot/src/web
./run.sh
```

* Open a web browser to view Jaia Command & Control:    http://localhost:40001/

### Create Docker Image

```
cd ~/jaiabot/scripts
./docker-build-build-system.sh
```

### Stop JaiaBot Services

* Stop the jaiabot services to the systems you are deploying the software to

```
ssh -i /path/to/key jaia@10.23.X.Y (X indicates fleet number and Y indicates bot number plus 100 or hub number plus 10)
sudo systemctl stop jaiabot
```

### Deploy

```
cd ~/jaiabot/scripts
# BOT
jaiabot_arduino_type=usb_new jaiabot_systemd_type=bot ./docker-arm64-build-and-deploy.sh jaia@10.23.X.Y (X indicates fleet number and Y indicates bot number plus 100)
# HUB
jaiabot_systemd_type=hub ./docker-arm64-build-and-deploy.sh jaia@10.23.X.Y (X indicates fleet number and Y indicates hub number plus 10)
```

### Edit Runtime.env

```
ssh -i /path/to/key jaia@10.23.X.Y (X indicates fleet number and Y indicates bot number plus 100 or hub number plus 10)
sudo vi /etc/jaiabot/runtime.env
```

* Update the bot index to reflect the bot you are deploying the software to
* Update the fleet index to reflect current fleet configuration
* Update n_bots to reflect the total number of bots in the fleet

### Start Jaiabot Services

```
ssh -i /path/to/key jaia@10.23.X.Y (X indicates fleet number and Y indicates bot number plus 100 or hub number plus 10)
sudo systemctl start jaiabot (takes about 1 min to start)
```

## Debugging

* Make sure if you are upgrading that you do the entire fleet or stop the services on the systems you are not using
* This will limit any unexpected issues as mismatched dccl packets cannot be interpreted
* If you get errors during this upgrade process please contact your Jaia representative
