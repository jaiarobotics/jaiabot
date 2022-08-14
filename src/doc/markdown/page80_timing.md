# Timing Intervals

This following table summarizes the time intervals for things like polling, logging, and communications at various points in the JaiaBot architecture.

| Name                        | Description                                                                         | Timing                        |
| --------------------        | ----------------                                                                    | -------------------------     |
| Central Command             | Poll `app.py` for BotStatus                                                         | 0.5 s interval                |
|                             | Send Mission to `app.py`                                                            | ASAP                          |
| Engineering Interface       | Send/Poll to `app.py`                                                               | 1.0 s interval                |
| app.py                      | Send/Receive UDP to `jaiabot_web_portal` on same device                             | "Instantly"                   |
|                             | Send/Receive UDP to `jaiabot_web_portal` across network                             | Depends on network latency    |
| jaiabot_web_portal          | Send/Receive via intervehicle to `jaiabot_mission_manager` or `jaiabot_engineering` | Depends on XBee radio latency |
| jaiabot_driver_arduino      | Send/Receive ArduinoCommand via serial (each loop steps the motor throttle)         | 0.25 s loop interval          |
| jaiabot_runtime Arduino app | ESC control loop                                                                    | 0.1 s loop interval           |
