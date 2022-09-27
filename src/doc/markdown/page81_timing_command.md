# Timing Command Diagram 

## HUB:
```
-- JAIABOT Command and Control (Sends Command on user trigger)
    -> jaiabot_web_portal 
       subscribes to: io_data (Process Command)
       publishes to: hub_command (intervehicle Command, bot id input) 
```

## BOT:
```
    -- jaiabot_mission_manager (Event Loop 1hz)
       subscribes to: Command
       publishes to: mission_ivp_behavior_update
        -> jaiabot_moos_gateway
           subscribes to: mission_ivp_behavior_update
           publishes to: JAIABOT_TRANSIT_UPDATES (Publishes to MOOSDB)
        -> jaiabot_fusion
           subscribes to: gpsd::tpv (1hz)
           publishes to: node_status (1hz based on tpv publishes)
           publishes to: bot_status (intervehicle 2hz)
            -> jaiabot_frontseat
               subscribes to: node_status (1hz)
               publishes to: NAV_X, NAV_Y, NAV_LAT, NAV_LONG, NAV_DEPTH, NAV_HEADING,
                             NAV_SPEED, NAV_PITCH, NAV_ROLL, NAV_ALTITUDE (Publishes to MOOSDB 1hz)
                -> jaiabot_moosdb (Receives NAV* at 1hz)
                   subscribes to: NAV_* (1hz)
                    -> jaiabot_phelmivp
                       subscribes to: NAV_* (4hz)
                       publishes to: DESIRED_* (1hz)
                <- jaiabot_moosdb
                   subscribes to: DESIRED_* (1hz)
            -- jaiabot_frontseat
               subscribes to: DESIRED_* (1hz)
               publishes to: desired_course (1hz)
                -> jaiabot_pid_control
                   subscribes to: bot_status (2hz) 
                        - sets: actual_heading, actual_roll, actual_pitch, actual_speed, actual_depth
                   subscribes to: desired_course (1hz) 
                        - sets: target_heading, target_roll, target_pitch, target_speed
                   publishes to: low_control (2hz)
                    -> jaiabot_arduino_driver
                       subscribes to: low_control (2hz)
                       publishes to: serial_out (4hz)
                        -> Arduino (Receives Serial Data at 4hz)
                           subscribes to: serial_out (4hz)
                           publishes to: actuators (16hz)
                    <- jaiabot_arduino_driver 
                       subscribes to: serial_in (4hz)
                       publishes to: arduino_to_pi (4hz)
        -- jaiabot_fusion (Receives voltage information for bot_status)
           subscribes to: arduino_to_pi (4hz)
           publishes to: bot_status (intervehicle 2hz)
```

## HUB: 
```
        <-- jaiabot_hub_manager
            subscribes to: bot_status (intervehicle 2hz)
            publishes to: bot_status (interprocess 2hz)
    <-- jaiabot_web_portal (Receives bot status triggered by hub_manager publish)
        subscribes to: bot_status (interprocess 2hz)
        publishes to: web_portal_udp_out (2hz)
-- JAIABOT Command and Control (Gets bot status updates 2hz)
```
