# Timing Intervals

This following table summarizes the time intervals for things like polling, logging, and communications at various points in the JaiaBot architecture.

| Name                        | Description                                                                         | Timing                        | Path 
| --------------------        | ----------------                                                                    | -------------------------     | ---
| Central Command             | Poll `app.py` for BotStatus                                                         | 0.5 s interval                | src/web/central_command/client/components/CentralCommand.jsx
|                             | Send Mission to `app.py`                                                            | ASAP                          |
| Engineering Interface       | Send/Poll to `app.py`                                                               | 0.1 s interval                | src/web/engineering/script.js
| app.py                      | Send/Receive UDP to `jaiabot_web_portal` on same device                             | "Instantly"                   | src/web/server/app.py
|                             | Send/Receive UDP to `jaiabot_web_portal` across network                             | Depends on network latency    |
| jaiabot_web_portal          | Send/Receive via intervehicle to `jaiabot_mission_manager` or `jaiabot_engineering` | Depends on XBee radio latency | src/bin/
| jaiabot_driver_arduino      | Send/Receive ArduinoCommand via serial (each loop steps the motor throttle)         | 0.25 s loop interval          | src/bin/drivers/arduino/app.cpp
| jaiabot_runtime Arduino app | ESC control loop                                                                    | 0.1 s loop interval           | src/arduino/jaiabot_runtime/jaiabot_runtime.ino
