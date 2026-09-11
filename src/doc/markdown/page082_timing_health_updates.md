# Timing Intervals

This following table summarizes the time intervals for health checks in the JaiaBot architecture.

| Name                                    | Description                                                                    | Timing (s)    | Path                                                       | Date Changed
| --------------------                    | ----------------                                                               | ----------    | ---                                                        | --------------
| jaiabot_fusion app                      | Missing Data Detction                                                          | 20            | src/bin/fusion/fusion.cpp                                  | 2022-10-27
| jaiabot_health app                      | loop                                                                           |  1            | src/bin/health/app.cpp                                     | 2022-10-27
| motor_thread (health)                  | Missing Data Detection, Voltage Missing Detection, Voltage Health Detection    | 20            | src/bin/health/motor_thread.cpp                             | 2022-10-27
| helm_ivp_thread (health)                | Missing Data Detection                                                         | 20            | src/bin/health/helm_ivp_thread.cpp                         | 2022-10-27
| linux_hardware_thread (health)          | Hardware toggle good to error and error to good                                | 60            | src/bin/health/linux_hardware_thread.cpp                   | 2022-10-27
| time_thread (health)                    | NTP toggle good to error and error to good                                     | 60            | src/bin/health/time_thread.cpp                             | 2022-10-27
| jaiabot_driver_imu.py                   | Missing Data Detection                                                         | 40            | src/python/adafruit/jaiabot_driver_imu.py                  | 2022-10-27
| jaiabot_driver_salinity.py              | Missing Data Detection                                                         | 40            | src/python/atlas_scientific_ezo_ec/jaiabot_driver_salinity.py| 2022-10-27
| jaiabot_driver_pressure.py              | Missing Data Detection                                                         | 40            | src/python/pressure_sensor/jaiabot_driver_pressure.py     | 2022-10-27
