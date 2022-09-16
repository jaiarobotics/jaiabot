# Timing Command Diagram 

## HUB:
```
-- Central Command (Sends Command on user trigger)
    -> jaiabot_web_portal (Subscribes And Publishes Command To Bot (intervehicle), triggered by Command)
```

## BOT:
```
    -- jaiabot_mission_manager (Subscribes And Publishes Update To MOOS_Gateway, triggered by Command, but states update at 1hz)
        -> jaiabot_moos_gateway (Subscribes And Publishes To MOOSDB, triggered by IvPBehaviorUpdate (Triggered by Mission_Plan))
        -> jaiabot_fusion (Publish bot status 2hz (intervehicle) and Publish node status triggered by tpv (gps based on gps input speed))
            -> jaiabot_frontseat (Subscribes to node status (based on gps input speed) then Publishes Nav update for MOOS)
                -> jaiabot_moosdb (Receives NAV* at 2hz)
                    -> jaiabot_helm-ivp (Receives NAV* 4hz publishes Desired NAV* 1hz)
                <- jaiabot_moosdb (Receives Desired NAV* at 1hz)
            -- jaiabot_frontseat (Trigger on Desired NAV* then Publish Desired Course at 1hz)
                -> jaiabot_pid_control (Receives bot status for actual position 2hz, Received Desired Course from Frontseat at 1hz)
                    -> jaiabot_arduino_driver (Receives low control at 2hz)
                        -> Arduino (Receives Serial Data at 4hz)
                    <- jaiabot_arduino_driver (Receives ArduinoResponse at 4hz, Publishes arduino_to_pi 4hz)
        -- jaiabot_fusion (Receives voltage information for bot_status)
```

## HUB: 
```
        <-- jaiabot_hub_manager (Receives bot status 2hz (intervehicle))
    <-- jaiabot_web_portal (Receives bot status triggered by hub_manager publish)
-- Central Command (Gets bot status updates 2hz)
```
