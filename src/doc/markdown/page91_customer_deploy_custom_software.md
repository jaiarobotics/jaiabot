# Customer Deploying Custom Software To JAIA Systems

## Clone Jaiabot Repo On Local Machine

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
* Compile code and verify it completes
```
cd ~/jaiabot
./build.sh
```

* Test code using the simulator

### Running Simulator locally

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

* Run JaiaBot Command & Control (in a different terminal)
```
cd ~/jaiabot/src/web
./run.sh
```

* Open a web browser to view central command:    http://localhost:40001/

### Create Docker Image

```
cd ~/jaiabot/scripts
./docker-build-build-system.sh
```

### Stop Jaiabot Services

* Stop the jaiabot services to the systems you are deploying the software to

```
ssh -i /path/to/key jaia@10.23.X.10Y (X indicates fleet number and Y indicates bot or hub number)
sudo systemctl stop jaiabot
```

### Deploy

```
cd ~/jaiabot/scripts
# BOT
jaiabot_arduino_type=usb_new jaiabot_systemd_type=bot ./docker-arm64-build-and-deploy.sh jaia@10.23.X.10Y (X indicated fleet number and Y indicates bot number)
# HUB
jaiabot_systemd_type=hub ./docker-arm64-build-and-deploy.sh jaia@10.23.X.1Y (X indicated fleet number and Y indicates hub number)
```

### Edit Runtime.env

```
ssh -i /path/to/key jaia@10.23.X.10Y (X indicates fleet number and Y indicates bot or hub number)
sudo vi /etc/jaiabot/runtime.env
```

* Update the bot index to reflect the bot you are deploying the software to
* Update the fleet index to reflect current fleet configuration
* Update n_bots to reflects the total number of bots in the fleet

### Start Jaiabot Services

```
ssh -i /path/to/key jaia@10.23.X.10Y (X indicates fleet number and Y indicates bot or hub number)
sudo systemctl start jaiabot (takes about 1 min to start)
```

## Debugging

* Make sure if you are upgrading that you do the entire fleet or stop the services on the systems you are not using
* This will limit any unexpected issues
* If you get errors during this upgrade process please contact you jaia representative