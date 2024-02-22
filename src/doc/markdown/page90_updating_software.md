# Updating Software

## Router Setup

1. Verify your hub router is connected to a hotspot
2. Select your hub router to connect (JAIA-HUB-WIFI-X) (X indicates fleet number)
3. Once connected, open a browser and verfiy that you have a connection
* If you do not have a connection then follow these next steps:
  1. Log into your hub router:
    2. Open a browser and go to 10.23.X.1 (X indicates fleet number)
    3. Log into the hub router (user: admin, password: admin, or what you have set this up to be)
    4. On the left hand toolbar select the 2.4 GHz WAN connection
    5. Setup a hotspot connection by selecting one that is avaiable
    6. Click the save button
    7. Verify that you have internet connection
4.  Once you have connection move onto the next section

## SSH into Bots and Hubs
```
ssh -i /path/to/key jaia@10.23.X.10Y (X indicates fleet number and Y indicates bot or hub number)
```

## Select Jaiabot Version To Follow
```
cat /etc/apt/sources.list.d/jaiabot.list
```

* All bots and hubs are setup to follow the release version
* When you cat the jaiabot.list file you will see 2 commented out lines
* There are 3 ways to follow updates for jaiabot-embedded
  * Continous:
    * The latest code and least tested code (Bugs are to be expected)
  * Beta:
    * The Code is more stable than continous, but may have unexpected results
  * Release:
    * The code is the most stable. Bugs should be minimal.
* To switch between versions uncomment the one you want and comment out the others

```
sudo vi /etc/apt/sources.d/jaiabot.list
```

## Update Jaiabot Packages
```
sudo mount -o remount,rw /boot/firmware
sudo apt update
sudo apt upgrade
sudo mount -o remount,r /boot/firmware
jaiabot-status
```

* After running jaiabot-status, verify the version number matches what you were expecting
* Verify releases at: https://github.com/jaiarobotics/jaiabot/releases
* Wait for jaiabot services to start back up (about 1 min)

## Debugging
* If you are upgrading, make sure to do that for the entire fleet
* If you get errors during this upgrade process please contact your Jaia representative
