# Timing Command Diagram 

## HUB:
```
-- Jaia Command and Control (Sends Command on user trigger)
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
           subscribes to: gpsd::tpv (5hz)
           publishes to: node_status (5hz)
           publishes to: bot_status (intervehicle 1hz (Configurable))
            -> jaiabot_frontseat
               subscribes to: node_status (5hz)
               publishes to: NAV_X, NAV_Y, NAV_LAT, NAV_LONG, NAV_DEPTH, NAV_HEADING,
                             NAV_SPEED, NAV_PITCH, NAV_ROLL, NAV_ALTITUDE (Publishes to MOOSDB 5hz)
                -> jaiabot_moosdb (Receives NAV* at 5hz)
                   subscribes to: NAV_* (5hz)
                    -> jaiabot_phelmivp
                       subscribes to: NAV_* (5hz)
                       publishes to: DESIRED_* (5hz)
                <- jaiabot_moosdb
                   subscribes to: DESIRED_* (5hz)
            -- jaiabot_frontseat
               subscribes to: DESIRED_* (5hz)
               publishes to: desired_course (5hz)
                -> jaiabot_pid_control
                   subscribes to: node_status (5hz) 
                        - sets: actual_heading, actual_roll, actual_pitch, actual_speed, actual_depth
                   subscribes to: desired_course (5hz) 
                        - sets: target_heading, target_roll, target_pitch, target_speed
                   publishes to: low_control (10hz)
                    -> jaiabot_arduino_driver
                       subscribes to: low_control (10hz)
                       publishes to: serial_out (10hz)
                        -> Arduino (Receives Serial Data at 10hz)
                           subscribes to: serial_out (10hz)
                           publishes to: actuators (16hz)
                    <- jaiabot_arduino_driver 
                       subscribes to: serial_in (10hz)
                       publishes to: arduino_to_pi (10hz)
        -- jaiabot_fusion (Receives voltage information for bot_status)
           subscribes to: arduino_to_pi (10hz)
           publishes to: bot_status (intervehicle 1hz (Configurable))
```

## HUB: 
```
        <-- jaiabot_hub_manager
            subscribes to: bot_status (intervehicle 1hz (Configurable))
            publishes to: node_status (intervehicle 1hz (Configurable))
    <-- jaiabot_web_portal (Receives bot status triggered by hub_manager publish)
        subscribes to: bot_status (intervehicle 1hz (Configurable))
        publishes to: web_portal_udp_out (intervehicle 1hz (Configurable))
-- Jaia Command and Control (Polls bot status at 2hz)
```
