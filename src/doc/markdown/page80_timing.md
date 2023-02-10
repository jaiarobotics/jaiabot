# Timing Intervals

This following table summarizes the time intervals for things like polling, logging, and communications at various points in the JaiaBot architecture.

| Name                                      | Description                                                                         | Timing                                          | Path
| --------------------                      | ----------------                                                                    | -------------------------                       | ---
| Central Command                           | Poll `app.py` for BotStatus                                                         | 0.5 s interval                                  | src/web/central_command/client/components/CentralCommand.jsx
|                                           | Send Mission to `app.py`                                                            | ASAP                                            | 
| Engineering Interface                     | Send/Poll to `app.py`                                                               | 0.1 s interval                                  | src/web/engineering/script.js
| app.py                                    | Send/Receive UDP to `jaiabot_web_portal` on same device                             | "Instantly"                                     | src/web/server/app.py
|                                           | Send/Receive UDP to `jaiabot_web_portal` across network                             | Depends on network latency                      | 
| jaiabot_web_portal                        | Send/Receive via intervehicle to `jaiabot_mission_manager` or `jaiabot_engineering` | Depends on XBee radio latency                   | src/bin/
| jaiabot_driver_arduino                    | Send/Receive ArduinoCommand via serial (each loop steps the motor throttle)         | 0.1 s loop interval                             | src/bin/drivers/arduino/app.cpp
| jaiabot_runtime Arduino app               | ESC control loop                                                                    | 0.1 s loop interval                             | src/arduino/jaiabot_runtime/jaiabot_runtime.ino
| jaiabot_adafruit_BNO055 app               | Publish Query for data loop                                                         | 1 s loop interval                               | src/bin/drivers/adafruit_BNO055/app.cpp
| jaiabot_atlas_scientific_ezo_ec app       | Publish Query for data loop                                                         | 1 s loop interval                               | src/bin/drivers/atlas_scientific_ezo_ec/app.cpp
| jaiabot_bluerobotics_pressure_sensor app  | Publish Query for data loop                                                         | 0.5 s loop interval                             | src/bin/drivers/bluerobotics_pressure_sensor/app.cpp
| jaiabot_fusion app                        | loop                                                                                | 0.2 s loop interval                             | src/bin/fusion/fusion.cpp
| jaiabot_health app                        | loop                                                                                | 1 s loop interval                               | src/bin/health/app.cpp
| arduino_thread (health)                   | loop (issue_status_summary)                                                         | 15 s loop interval                              | src/bin/health/arduino_thread.cpp
| helm_ivp_thread (health)                  | loop (issue_status_summary)                                                         | 15 s loop interval                              | src/bin/health/helm_ivp_thread.cpp
| linux_hardware_thread (health)            | loop (issue_status_summary)                                                         | 60 s loop interval                              | src/bin/health/linux_hardware_thread.cpp
| time_thread (health)                      | loop (issue_status_summary)                                                         | 60 s loop interval                              | src/bin/health/time_thread.cpp
| jaiabot_hub_manager app                   | Publish hub status loop                                                             | 0.5 s loop interval                             | src/bin/hub_manager/hub_manager.cpp
| jaiabot_engineering app                   | Publish Engineering status loop                                                     | 5 s loop interval                               | src/bin/jaiabot_engineering/app.cpp
| jaiabot_metadata app                      | No loop interval                                                                    | No loop interval                                | src/bin/jaiabot_metadata/app.cpp
| jaiabot_pid_control app                   | Publish low control loop                                                            | 0.1 s loop interval                             | src/bin/jaiabot_pid_control/app.cpp
| jaiabot_mission_manager app               | Mission Report loop                                                                 | 1 s loop interval                               | src/bin/mission_manager/app.cpp
| jaiabot_web_portal app                    | loop                                                                                | 2 s loop interval                               | src/bin/web_portal/app.cpp
| jaiabot_moos_gateway app                  | BHV Updates                                                                         | Depends goby::moos::FrontSeatTranslation        | src/lib/jaiabot_moos_gateway/app.cpp
| jaiabot_goby_laiason app                  | Publish low_control                                                                 | 0.05 s loop interval                            | src/lib/laiason/laiason_jaiabot.cpp
| jaiabot_adafruit_BNO055_py                | adafruit_BNO055 Sensor Updates                                                      | Depends jaiabot_adafruit_BNO055                 | src/python/adafruit_BNO055/jaiabot_imu.py
| jaiabot_atlas_scientific_ezo_ec_py        | atlas_scientific_ezo_ec Sensor Updates                                              | Depends jaiabot_atlas_scientific_ezo_ec         | src/python/atlas_scientific_ezo_ec/jaiabot_as-ezo-ec.py
| jaiabot_pressure_sensor_py                | Pressure Sensor Updates                                                             | Depends jaiabot_bluerobotics_pressure_sensor    | src/python/pressure_sensor/jaiabot_pressure_sensor.py