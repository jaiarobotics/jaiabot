# Deploying Custom Software

1. [Modify the codebase](./page93_modifying_codebase.md)
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
jaiabot_arduino_type=usb_new jaiabot_systemd_type=bot ./docker-arm64-build-and-deploy.sh jaia@10.23.X.Y (X indicates fleet number and Y indicates bot number plus 100)
# HUB
jaiabot_systemd_type=hub ./docker-arm64-build-and-deploy.sh jaia@10.23.X.Y (X indicates fleet number and Y indicates hub number plus 10)
```
6. Edit runtime.env
```
ssh -i /path/to/key jaia@10.23.X.Y (X indicates fleet number and Y indicates bot number plus 100 or hub number plus 10)
sudo vi /etc/jaiabot/runtime.env
```

* Update the bot index to reflect the bot you are deploying the software to
* Update the fleet index to reflect current fleet configuration
* Update n_bots to reflect the total number of bots in the fleet

7. Start jaiabot services
```
ssh -i /path/to/key jaia@10.23.X.Y (X indicates fleet number and Y indicates bot number plus 100 or hub number plus 10)
sudo systemctl start jaiabot (takes about 1 min to start)
```

## Debugging

* Make sure if you are upgrading that you do the entire fleet or stop the services on the systems you are not using
* This will limit any unexpected issues as mismatched dccl packets cannot be interpreted
* If you get errors during this upgrade process please contact your Jaia representative
