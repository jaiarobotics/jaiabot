# Timing Intervals

This following table summarizes the time intervals for things like polling, logging, and communications at various points in the JaiaBot architecture.

| Name                  | Description                            | Timing |
| --------------------  | ----------------                       | ------------------------- |
| Central Command       | Poll `app.py` for BotStatus              | 0.5s interval                       |
| Engineering Interface | Send/Poll to `app.py`                    | 1.0s interval                       |
| app.py                | Send/Receive UDP to `jaiabot_web_portal` | Depends on network latency |
| jaiabot_web_portal    | Send/Receive via intervehicle to `jaiabot_mission_manager` or `jaiabot_engineering` | Measure XBee radio latency     |
| jaiabot_arduino       | Send/Receive ArduinoCommand via serial   | 0.25s loop interval      |
| jaiabot_runtime Arduino app | ESC control loop | 0.1s loop interval |
