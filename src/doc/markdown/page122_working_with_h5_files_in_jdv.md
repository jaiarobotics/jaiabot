# Working with h5 files in JDV
*This document provides a description of some of the more commonly requested data fields logged by the JaiaBot. Below, you will find a series of tables providing key metadata about these fields.*
<br><br>

## Contents
- [Notes](#notes)
  - [Timestamps](#timestamps)
  - [Data Paths](#data-paths)
  - [Example Scripts](#example-scripts)
- [Sensor Data](#sensor-data)
  - [Temperature Data](#temperature-data) 
  - [Pressure Data](#pressure-data)
  - [Salinity Data](#salinity-data)
  - [pH Data](#ph-data)
  - [Dissolved Oxygen Data](#dissolved-oxygen-data)
  - [Fluorometer Data](#fluorometer-data)
- [Vehicle Data](#vehicle-data)
  - [Location Data](#location-data)
  - [IMU Data](#imu-data)
  - [Mission State](#mission-state)
  - [Task Packets](#task-packets)
  - [Bot Status](#bot-status)
<br>


## Notes

##### Updates:
*This file was generated and completed using data from JaiaBot Embedded Version 2.0.0. In the future, data fields and the path to reach them may change. This file will be kept up to date.*

##### Timestamps:
*Timestamps are logged in Unix Time - the amount of microseconds since 1 January, 1970 - and can be found in the parent group's **\_utime_** field. Because values are measured, messages sent and received, and data logged at different times between sensors and boards, each group has its own "_utime_" field. For this reason, it's important to use the specific _utime_ field which corresponds to the data field of interest.*

##### Data Paths:
*The Data Paths listed below include the path a user would follow to find the specific data field via the Jaia Data Visualizer (JDV), as well as in the raw HDF5 log file (e.g. via a custom script).*

##### Example Scripts:
*Internal data analysis scripts can be found in our public GitHub Repository. Anyone is able to access these by checking out the following branch, then navigating to `jaiabot/scripts/log-analysis`. In the coming months, these scripts will be merged into our main branch, but will remain in the same file location.*

https://github.com/jaiarobotics/jaiabot/tree/task/developer-log-analysis-tools 


## Sensor Data
*Many of the measurements taken by the JaiaBot's environmental sensors undergo some form of post-processing in order to be useful universally. The word **"raw"** in the title of a field denotes that this field records the measurement taken directly from the sensor, before any compensation has been applied.* 
<br>

*If a data field **does not have** the word **"raw"** in its title, then either no compensation is needed for this field, or a compensation has already been applied to it.*
<br>

\**We are working to implement compensation models for all sensor data.*\*

### Temperature Data
- *Measured via a **Blue Robotics Bar30***
  - *Stated Accuracy: ± 4 °C*
  - https://bluerobotics.com/store/sensors-cameras/sensors/bar-depth-pressure-sensor/

##### Data Paths
| Data Field    | Unit | Frequency | JDV Path                                      | HDF5 Log Path                                                                       |
|---------------|------|-----------|-----------------------------------------------|-------------------------------------------------------------------------------------|
|**Temperature**|*°C*  |*10 Hz*    |`jaiabot::pressure_temperature` ➜ `temperature`|`/jaiabot::pressure_temperature/jaiabot.protobuf.PressureTemperatureData/temperature`|

##### Timestamp Paths
| Units        | JDV Path                                  | HDF5 Log Path                                                                   |
|--------------|-------------------------------------------|---------------------------------------------------------------------------------|
|*Microseconds*|`jaiabot::pressure_temperature` ➜ `_utime_`|`/jaiabot::pressure_temperature/jaiabot.protobuf.PressureTemperatureData/_utime_`|
<br>


### Pressure Data
- ***Depth*** - *The depth of the vehicle's tail, adjusting for surface pressure and the distance from the pressure sensor to the tail.* <br>
- ***Sensor Depth*** - *The depth the vehicle's pressure sensor, adjusting for surface pressure.* <br>
- ***Pressure*** - *The current pressure experienced by the vehicle, minus the pressure at the surface* <br>
- ***Raw Pressure*** - *The pressure reading as it comes from the Bar 30 pressure sensor* <br>
- *Measured via a **Blue Robotics Bar30***
  - *Stated Accuracy: ± 200 mbar*
  - https://bluerobotics.com/store/sensors-cameras/sensors/bar-depth-pressure-sensor/

##### Data Paths
| Data Field     | Unit | Frequency | JDV Path                                         | HDF5 Log Path                                                                       |
|----------------|------|-----------|--------------------------------------------------|-------------------------------------------------------------------------------------|
|**Depth**       |*m*   |*10 Hz*    |`jaiabot::pressure_adjusted` ➜ `depth` |`/jaiabot::pressure_adjusted/jaiabot.protobuf.PressureAdjustedData/depth` |
|**Sensor Depth**|*m*   |*10 Hz*    |`jaiabot::pressure_adjusted` ➜ `sensor_depth` |`/jaiabot::pressure_adjusted/jaiabot.protobuf.PressureAdjustedData/sensor_depth` |
|**Pressure**    |*mbar*|*10 Hz*    |`jaiabot::pressure_adjusted` ➜ `pressure_adjusted`|`/jaiabot::pressure_adjusted/jaiabot.protobuf.PressureAdjustedData/pressure_adjusted`|
|**Raw Pressure**|*mbar*|*10 Hz*    |`jaiabot::pressure_adjusted` ➜ `pressure_raw`     |`/jaiabot::pressure_adjusted/jaiabot.protobuf.PressureAdjustedData/pressure_raw`     |

##### Timestamp Paths
| Unit         | JDV Path                               | HDF5 Log Path                                                             |
|--------------|----------------------------------------|---------------------------------------------------------------------------|
|*Microseconds*|`jaiabot::pressure_adjusted` ➜ `_utime_`|`/jaiabot::pressure_adjusted/jaiabot.protobuf.PressureAdjustedData/_utime_`|
<br>


### Salinity Data
- ***Conductivity*** - *Specific conductivity, the conductivity compensated to a 25 °C standard* <br>
- ***Raw Conductivity*** - *The conductivity as reported by the conductivity sensor* <br>
- ***Salinity*** - *Salinity compensated for temperature and pressure* <br>
- ***Raw Salinity*** - *The salinity as reported by the conductivity sensor* <br>
- *Measured via an **Atlas Scientific OEM-EC** and **Mini-Conductivity Probe K 1.0***
  - *Stated Accuracy: ± 2%*
  - https://atlas-scientific.com/embedded-solutions/conductivity-oem-circuit/
  - https://atlas-scientific.com/probes/mini-e-c-probe-k-1-0/

##### Data Paths
| Data Field         | Unit  | Frequency | JDV Path                               | HDF5 Log Path                                                     |
|--------------------|-------|-----------|----------------------------------------|-------------------------------------------------------------------|
|**Conductivity**    |*μS/cm*|*10 Hz*    |`jaiabot::salinity` ➔ `conductivity`    |*HYDRO/PAM:*`/jaiabot::salinity/jaiabot.protobuf.SalinityData/conductivity`<br>*BIO:*`/jaiabot::salinity/jaiabot.sensor.protobuf.AtlasScientificOEMEC/conductivity`|
|**Raw Conductivity**|*μS/cm*|*10 Hz*    |`jaiabot::salinity` ➔ `conductivity_raw`|*HYDRO/PAM:*`/jaiabot::salinity/jaiabot.protobuf.SalinityData/conductivity_raw`<br>*BIO:*`/jaiabot::salinity/jaiabot.sensor.protobuf.AtlasScientificOEMEC/conductivity_raw`|
|**Salinity**        |*ppt*  |*10 Hz*    |`jaiabot::salinity` ➔ `salinity`        |*HYDRO/PAM:*`/jaiabot::salinity/jaiabot.protobuf.SalinityData/salinity`<br>*BIO:*`/jaiabot::salinity/jaiabot.sensor.protobuf.AtlasScientificOEMEC/salinity`|
|**Raw Salinity**    |*ppt*  |*10 Hz*    |`jaiabot::salinity` ➔ `salinity_raw`    |*HYDRO/PAM:*`/jaiabot::salinity/jaiabot.protobuf.SalinityData/salinity_raw`<br>*BIO:*`/jaiabot::salinity/jaiabot.sensor.protobuf.AtlasScientificOEMEC/salinity_raw`|

##### Timestamp Paths
| Units        | JDV Path                      | HDF5 Log Path                                            |
|--------------|-------------------------------|----------------------------------------------------------|
|*Microseconds*|`jaiabot::salinity` ➔ `_utime_`|*HYDRO/PAM:*`/jaiabot::salinity/jaiabot.protobuf.SalinityData/_utime_`<br>*BIO:*`/jaiabot::salinity/jaiabot.sensor.protobuf.AtlasScientificOEMEC/_utime_`|


### pH Data
- ***pH*** - *pH compensated to a 25 °C standard* <br>
- ***Raw pH*** - *The pH as reported by the pH sensor* <br>
- ***Temperature*** - *The temperature reported by the temperature sensor inside of the pH probe* <br>
- *Measured via an **Atlas Scientific OEM pH** and **Atlas Scientific Industrial pH Probe w/ Temp.***
  - *Stated Accuracy: ± 0.002*
  - https://atlas-scientific.com/embedded-solutions/ph-oem-circuit/
  - https://atlas-scientific.com/probes/industrial-ph-probe/

##### Data Paths
| Data Field         | Unit  | Frequency | JDV Path                               | HDF5 Log Path                                                         |
|--------------------|-------|-----------|----------------------------------------|-----------------------------------------------------------------------|
|**pH**              |*pH*   |*10 Hz*    |`jaiabot::ph` ➔ `ph`                    |`/jaiabot::ph/jaiabot.sensor.protobuf.AtlasScientificOEMpH/ph`         |
|**Raw pH**          |*pH*   |*10 Hz*    |`jaiabot::ph` ➔ `ph_raw`                |`/jaiabot::ph/jaiabot.sensor.protobuf.AtlasScientificOEMpH/ph_raw`     |
|**Temperature**     |*°C*   |*10 Hz*    |`jaiabot::ph` ➔ `temperature`           |`/jaiabot::ph/jaiabot.sensor.protobuf.AtlasScientificOEMpH/temperature`|

##### Timestamp Paths
| Units        | JDV Path                      | HDF5 Log Path                                                     |
|--------------|-------------------------------|-------------------------------------------------------------------|
|*Microseconds*|`jaiabot::ph` ➔ `_utime_`      |`/jaiabot::ph/jaiabot.sensor.protobuf.AtlasScientificOEMpH/_utime_`|
<br>


### Dissolved Oxygen Data
- ***Dissolved Oxygen Solubility*** - *Dissolved oxygen solubility (mg/L) at current temperature (C), salinity (ppt), and pressure (mmhg)* <br>
- ***Normalized Dissolved Oxygen Solubility*** - *Dissolved oxygen solubility at 0 salinity (ppt), same temperature (C) and pressure (mmhg), scaled by observed saturation* <br>
- ***Raw Dissolved Oxygen*** - *The dissolved oxygen as reported by the dissolved oxygen sensor* <br>
- ***Dissolved Oxygen Saturation*** - *Measured DO / DO Solubility at current temperature (C), salinity (ppt), and pressure (mmhg)* <br>
- ***Temperature*** - *The temperature as reported by the dissolved oxygen sensor* <br>
- *Measured via an **Atlas Scientific OEM DO** and **Atlas Scientific Industrial DO Probe w/ Temp.***
  - *Stated Accuracy: ± 0.05 mg/L*
  - https://atlas-scientific.com/embedded-solutions/do-oem-circuit/
  - https://atlas-scientific.com/probes/industrial-dissolved-oxygen-probe/

##### Data Paths
| Data Field                               | Unit  | Frequency | JDV Path                                               | HDF5 Log Path                                                                                    |
|------------------------------------------|-------|-----------|--------------------------------------------------------|--------------------------------------------------------------------------------------------------|
|**Dissolved Oxygen Solubility**           |*mg/L* |*10 Hz*    |`jaiabot::dissolved_oxygen` ➔ `do_solubility`           |`/jaiabot::dissolved_oxygen/jaiabot.sensor.protobuf.AtlasScientificOEMDO/do_solubility`           |
|**Normalized Dissolved Oxygen Solubility**|*mg/L* |*10 Hz*    |`jaiabot::dissolved_oxygen` ➔ `do_normalized_solubility`|`/jaiabot::dissolved_oxygen/jaiabot.sensor.protobuf.AtlasScientificOEMDO/do_normalized_solubility`|
|**Raw Dissolved Oxygen**                  |*mg/L* |*10 Hz*    |`jaiabot::dissolved_oxygen` ➔ `do_raw`                  |`/jaiabot::dissolved_oxygen/jaiabot.sensor.protobuf.AtlasScientificOEMDO/do_raw`                  |
|**Dissolved Oxygen Saturation**           |*%*    |*10 Hz*    |`jaiabot::dissolved_oxygen` ➔ `do_saturation_percent`   |`/jaiabot::dissolved_oxygen/jaiabot.sensor.protobuf.AtlasScientificOEMDO/do_saturation_percent`   |
|**Temperature**                           |*°C*   |*10 Hz*    |`jaiabot::dissolved_oxygen` ➔ `temperature`             |`/jaiabot::dissolved_oxygen/jaiabot.sensor.protobuf.AtlasScientificOEMDO/temperature`             |

##### Timestamp Paths
| Units        | JDV Path                              | HDF5 Log Path                                                                   |
|--------------|---------------------------------------|---------------------------------------------------------------------------------|
|*Microseconds*|`jaiabot::dissolved_oxygen` ➔ `_utime_`|`/jaiabot::dissolved_oxygen/jaiabot.sensor.protobuf.AtlasScientificOEMDO/_utime_`|
<br>


### Fluorometer Data
- ***Concentration*** - *The concentration of a fluorophore reported by the fluorometer* <br>
- ***Sensor Voltage*** - *The raw voltage reported by the fluorometer, before a calibration coefficient or offset have been applied* <br>
- *Measured via a **Turner Designs C Fluor***
  - http://docs.turnerdesigns.com/t2/doc/spec-guides/998-2125.pdf

##### Data Paths
| Data Field       | Unit   | Frequency | JDV Path                                       | HDF5 Log Path                                                                    |
|------------------|--------|-----------|------------------------------------------------|----------------------------------------------------------------------------------|
|**Concentration** |*Varies*|*10 Hz*    |`jaiabot::fluorometer` ➔ `concentration`        |`/jaiabot::fluorometer/jaiabot.sensor.protobuf.TurnerCFluor/concentration`        |
|**Sensor Voltage**|*V*     |*10 Hz*    |`jaiabot::fluorometer` ➔ `concentration_voltage`|`/jaiabot::fluorometer/jaiabot.sensor.protobuf.TurnerCFluor/concentration_voltage`|

##### Timestamp Paths
| Units        | JDV Path                         | HDF5 Log Path                                                      |
|--------------|----------------------------------|--------------------------------------------------------------------|
|*Microseconds*|`jaiabot::fluorometer` ➔ `_utime_`|`/jaiabot::fluorometer/jaiabot.sensor.protobuf.TurnerCFluor/_utime_`|
<br>



## Vehicle Data
<br>


### Location Data
- ***Latitude/Longitude*** - *Accuracy of ~3 m (radius)* <br>
- ***Speed Over Ground*** - *GPS speed of the JaiaBot* <br>

##### Data Paths
| Data Field          | Unit      | Frequency | JDV Path                                                 | HDF5 Log Path                                                                                        |
|---------------------|-----------|-----------|----------------------------------------------------------|------------------------------------------------------------------------------------------------------|
|**Latitude**         |*Decimal °*|*5 Hz*     |`goby::middleware::groups::gpsd::tpv` ➔ `location` ➔ `lat`|`/goby::middleware::groups::gpsd::tpv/goby.middleware.protobuf.gpsd.TimePositionVelocity/location/lat`|
|**Longitude**        |*Decimal °*|*5 Hz*     |`goby::middleware::groups::gpsd::tpv` ➔ `location` ➔ `lon`|`/goby::middleware::groups::gpsd::tpv/goby.middleware.protobuf.gpsd.TimePositionVelocity/location/lon`|
|**Speed Over Ground**|*m/s*      |*5 Hz*     |`goby::middleware::groups::gpsd::tpv` ➔ `speed`           |`/goby::middleware::groups::gpsd::tpv/goby.middleware.protobuf.gpsd.TimePositionVelocity/speed`       |

##### Timestamp Paths
| Units        | JDV Path                                                     | HDF5 Log Path                                                                                   |
|--------------|--------------------------------------------------------------|-------------------------------------------------------------------------------------------------|
|*Microseconds*|`goby::middleware::groups::gpsd::tpv` ➔ `location` ➔ `_utime_`|`/goby::middleware::groups::gpsd::tpv/goby.middleware.protobuf.gpsd.TimePositionVelocity/_utime_`|
<br>


### IMU Data
- ***Heading/Pitch/Roll*** - *Three degrees of rotation the IMU reports* <br>
  
##### Data Paths
| Data Field | Unit      | Frequency | JDV Path                                                               | HDF5 Log Path                                               |
|------------|-----------|-----------|------------------------------------------------------------------------|-------------------------------------------------------------|
|**Heading** |*Decimal °*|*10 Hz*    |`jaiabot::imu` ➔ `jaiabot.protobuf.IMUData` ➔ `euler_angles` ➔ `heading`|`/jaiabot::imu/jaiabot.protobuf.IMUData/euler_angles/heading`|
|**Pitch**   |*Decimal °*|*10 Hz*    |`jaiabot::imu` ➔ `jaiabot.protobuf.IMUData` ➔ `euler_angles` ➔ `pitch`  |`/jaiabot::imu/jaiabot.protobuf.IMUData/euler_angles/pitch`  |
|**Roll**    |*Decimal °*|*10 Hz*    |`jaiabot::imu` ➔ `jaiabot.protobuf.IMUData` ➔ `euler_angles` ➔ `roll`   |`/jaiabot::imu/jaiabot.protobuf.IMUData/euler_angles/roll`   |

##### Timestamp Paths
| Units        | JDV Path                                              | HDF5 Log Path                                  |
|--------------|-------------------------------------------------------|------------------------------------------------|
|*Microseconds*|`jaiabot::imu` ➔ `jaiabot.protobuf.IMUData` ➔ `_utime_`|`/jaiabot::imu/jaiabot.protobuf.IMUData/_utime_`|
<br>


### Mission State 
- ***Mission State*** - *The different states that the JaiaBot uses to complete the mission at hand* <br>
- https://github.com/jaiarobotics/jaiabot/blob/2.y/src/doc/markdown/page041_hdf5.md

##### Data Paths
| Data Field      | Unit | Frequency | JDV Path                          | HDF5 Log Path                                                 |
|-----------------|------|-----------|-----------------------------------|---------------------------------------------------------------|
|**Mission State**|*n/a* |*1 Hz*     |`jaiabot::mission_report` ➔ `state`|`/jaiabot::mission_report/jaiabot.protobuf.MissionReport/state`|

##### Timestamp Paths
| Units        | JDV Path                            | HDF5 Log Path                                                   |
|--------------|-------------------------------------|-----------------------------------------------------------------|
|*Microseconds*|`jaiabot::mission_report` ➔ `_utime_`|`/jaiabot::mission_report/jaiabot.protobuf.MissionReport/_utime_`|
<br>


### Task Packets
- *Task Packets are reported from the JaiaBot to the Hub whenever a dive or drift task are completed* <br>
- *Task packets contain data about the specific task, including its start and end point/time, and some key characteristics of the task.* <br>
- *Task Packet fields contain an API reference number (integer) which may change depending on the version of embedded software that the JaiaBot is running on when the log is created. Below, this reference number is denoted with 'X'. A regex pattern should be used to future-proof any custom scripts.* <br>

##### Data Paths
| Data Field             | Unit         | JDV Path                                             | HDF5 Log Path                                                             |
|------------------------|--------------|------------------------------------------------------|---------------------------------------------------------------------------|
|**Bot ID**              |*Integer*     |`jaiabot::task_packet;X` ➔ `bot_id`                   |`/jaiabot::task_packet;X/jaiabot.protobuf.TaskPacket/bot_id`               |
|**Start Time**          |*Microseconds*|`jaiabot::task_packet;X` ➔ `start_time`               |`/jaiabot::task_packet;X/jaiabot.protobuf.TaskPacket/start_time`           |
|**End Time**            |*Microseconds*|`jaiabot::task_packet;X` ➔ `end_time`                 |`/jaiabot::task_packet;X/jaiabot.protobuf.TaskPacket/end_time`             |
|**Type**                |*Integer*     |`jaiabot::task_packet;X` ➔ `type`                     |`/jaiabot::task_packet;X/jaiabot.protobuf.TaskPacket/type`                 |
|**Bottom Dive**         |*Boolean*     |`jaiabot::task_packet;X` ➔ `dive` ➔ `bottom_dive`     |`/jaiabot::task_packet;X/jaiabot.protobuf.TaskPacket/dive/bottom_dive`     |
|**Bottom Type**         |*Boolean*     |`jaiabot::task_packet;X` ➔ `dive` ➔ `bottom_type`     |`/jaiabot::task_packet;X/jaiabot.protobuf.TaskPacket/dive/bottom_type`     |
|**Depth Achieved**      |*m*           |`jaiabot::task_packet;X` ➔ `dive` ➔ `depth_achieved`  |`/jaiabot::task_packet;X/jaiabot.protobuf.TaskPacket/dive/depth_achieved`  |
|**Dive Rate**           |*m/s*         |`jaiabot::task_packet;X` ➔ `dive` ➔ `dive_rate`       |`/jaiabot::task_packet;X/jaiabot.protobuf.TaskPacket/dive/dive_rate`       |
|**Dive Start Location** |*Lat/Lon*     |`jaiabot::task_packet;X` ➔ `dive` ➔ `start_location`  |`/jaiabot::task_packet;X/jaiabot.protobuf.TaskPacket/dive/start_location`  |
|**Drift Duration**      |*Seconds*     |`jaiabot::task_packet;X` ➔ `drift` ➔ `drift_duration` |`/jaiabot::task_packet;X/jaiabot.protobuf.TaskPacket/drift/drift_duration` |
|**Drift Start Location**|*Lat/Lon*     |`jaiabot::task_packet;X` ➔ `drift` ➔ `start_location` |`/jaiabot::task_packet;X/jaiabot.protobuf.TaskPacket/drift/start_location` |
|**Drift End Location**  |*Lat/Lon*     |`jaiabot::task_packet;X` ➔ `drift` ➔ `end_location`   |`/jaiabot::task_packet;X/jaiabot.protobuf.TaskPacket/drift/end_location`   |
|**Estimated Drift**     |*m*           |`jaiabot::task_packet;X` ➔ `drift` ➔ `estimated_drift`|`/jaiabot::task_packet;X/jaiabot.protobuf.TaskPacket/drift/estimated_drift`|

##### Timestamp Paths
| Units        | JDV Path                           | HDF5 Log Path                                               |
|--------------|------------------------------------|-------------------------------------------------------------|
|*Microseconds*|`jaiabot::task_packet;X` ➔ `_utime_`|`/jaiabot::task_packet;X/jaiabot.protobuf.TaskPacket/_utime_`|
<br>


### Bot Status
- *Bot Status messages contain key information about the JaiaBot and its sensors throughout the mission. The information is pulled from other sources and automatically downsamples to 1 Hz.*
- *Bot Status fields contain an API reference number (integer) which may change depending on the version of embedded software that the JaiaBot is running on when the log is created. Below, this reference number is denoted with 'X'. A regex pattern should be used to future-proof any custom scripts.*
  
##### Data Paths
| Data Field          | Unit      | Frequency | JDV Path                                        | HDF5 Log Path                                                       |
|---------------------|-----------|-----------|-------------------------------------------------|---------------------------------------------------------------------|
|**Battery Charge**   |*%*        |*1 Hz*     |`jaiabot::bot_status;X` ➔ `battery_percent`      |`/jaiabot::bot_status;X/jaiabot.protobuf.BotStatus/battery_percent`  |
|**Bot ID**           |*Integer*  |*1 Hz*     |`jaiabot::bot_status;X` ➔ `battery_percent`      |`/jaiabot::bot_status;X/jaiabot.protobuf.BotStatus/bot_id`           |
|**Depth**            |*m*        |*1 Hz*     |`jaiabot::bot_status;X` ➔ `depth`                |`/jaiabot::bot_status;X/jaiabot.protobuf.BotStatus/depth`            |
|**Latitude**         |*Decimal °*|*1 Hz*     |`jaiabot::bot_status;X` ➔ `location` ➔ `lat`     |`/jaiabot::bot_status;X/jaiabot.protobuf.BotStatus/location/lat`     |
|**Longitude**        |*Decimal °*|*1 Hz*     |`jaiabot::bot_status;X` ➔ `location` ➔ `lon`     |`/jaiabot::bot_status;X/jaiabot.protobuf.BotStatus/location/lon`     |
|**Mission State**    |*n/a*      |*1 Hz*     |`jaiabot::bot_status;X` ➔ `mission_state`        |`/jaiabot::bot_status;X/jaiabot.protobuf.BotStatus/mission_state`    |
|**Salinity**         |*ppt*      |*1 Hz*     |`jaiabot::bot_status;X` ➔ `salinity`             |`/jaiabot::bot_status;X/jaiabot.protobuf.BotStatus/salinity`         |
|**Speed Over Ground**|*m/s*      |*1 Hz*     |`jaiabot::bot_status;X` ➔ `speed` ➔ `over_ground`|`/jaiabot::bot_status;X/jaiabot.protobuf.BotStatus/speed/over_ground`|
|**Temperature**      |*°C*       |*1 Hz*     |`jaiabot::bot_status;X` ➔ `temperature`          |`/jaiabot::bot_status;X/jaiabot.protobuf.BotStatus/temperature`      |

##### Timestamp Paths
| Units        | JDV Path                          | HDF5 Log Path                                             |
|--------------|-----------------------------------|-----------------------------------------------------------|
|*Microseconds*|`jaiabot::bot_status;X` ➔ `_utime_`|`/jaiabot::bot_status;X/jaiabot.protobuf.BotStatus/_utime_`|
<br>
