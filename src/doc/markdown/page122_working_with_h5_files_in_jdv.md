# Key Data
*Description of the file contents here...*
<br><br>

- [Sensor Data](#sensor-data) <br>
  - [Temperature Data](#temperature-data) <br>
  - [Pressure Data](#pressure-data) <br>
  - [Salinity Data](#salinity-data) <br>
- [Vehicle Data](#vehicle-data) <br>
  - [Positional Data](#positional-data) <br>


## **Sensor Data**
<br>


### **Temperature Data**
- *Description of Temperature fields here* <br>
- *Raw vs calculated, compensation equations etc...* <br>
- *Description of sensor (Blue Robotics Bar30)*<br>

##### **Data Paths**
| Data Field | JDV Path                       | HDF5 Log Path                                             | Unit | Frequency |
|----------- |--------------------------------|-----------------------------------------------------------|------|-----------|
|**Temperature**|`jaiabot::pressure_temperature` ➜ `temperature`|`/jaiabot::pressure_temperature/jaiabot.protobuf.PressureTemperatureData/temperature`|*°C*|*10 Hz*|

##### **Timestamp Paths**
| JDV Path                      | HDF5 Log Path                                            |
|-------------------------------|----------------------------------------------------------|
|`jaiabot::pressure_temperature` ➜ `_utime_`|`/jaiabot::pressure_temperature/jaiabot.protobuf.PressureTemperatureData/_utime_`|
<br>


### **Pressure Data**
- *Description of Pressure fields here* <br>
- *Raw vs calculated, compensation equations etc...* <br>
- *Description of sensor (Blue Robotics Bar30)*<br>

##### **Data Paths**
| Data Field | JDV Path                       | HDF5 Log Path                                             | Unit | Frequency |
|----------- |--------------------------------|-----------------------------------------------------------|------|-----------|
|**Depth**|`jaiabot::pressure_adjusted` ➜ `calculated_depth`|`/jaiabot::pressure_adjusted/jaiabot.protobuf.PressureAdjustedData/calculated_depth`|*m*|*10 Hz*|
|**Pressure**|`jaiabot::pressure_adjusted` ➜ `pressure_adjusted`|`/jaiabot::pressure_adjusted/jaiabot.protobuf.PressureAdjustedData/pressure_adjusted`|*bar*|*10 Hz*|
|**Raw Pressure**|`jaiabot::pressure_adjusted` ➜ `pressure_raw`|`/jaiabot::pressure_adjusted/jaiabot.protobuf.PressureAdjustedData/pressure_raw`|*bar*|*10 Hz*|

##### **Timestamp Paths**
| JDV Path                      | HDF5 Log Path                                            |
|-------------------------------|----------------------------------------------------------|
|`jaiabot::pressure_adjusted` ➜ `_utime_`|`/jaiabot::pressure_adjusted/jaiabot.protobuf.PressureAdjustedData/_utime_`|
<br>


### **Salinity Data**
- *Description of Salinity fields here...* <br>
- *Raw vs calculated, compensation equations etc...* <br>
- *Description of sensor (Atlas Scientific OEM EC)*<br>

##### **Data Paths**
| Data Field         | JDV Path                               | HDF5 Log Path                                                     | Unit  | Frequency |
|--------------------|----------------------------------------|-------------------------------------------------------------------|-------|-----------|
|**Conductivity**    |`jaiabot::salinity` ➔ `conductivity`    |`/jaiabot::salinity/jaiabot.protobuf.SalinityData/conductivity`    |*μS/cm*|*10 Hz*    |
|**Raw Conductivity**|`jaiabot::salinity` ➔ `conductivity_raw`|`/jaiabot::salinity/jaiabot.protobuf.SalinityData/conductivity_raw`|*μS/cm*|*10 Hz*    |
|**Salinity**        |`jaiabot::salinity` ➔ `salinity`        |`/jaiabot::salinity/jaiabot.protobuf.SalinityData/salinity`        |*ppt*  |*10 Hz*    |
|**Raw Salinity**    |`jaiabot::salinity` ➔ `salinity_raw`    |`/jaiabot::salinity/jaiabot.protobuf.SalinityData/salinity_raw`    |*ppt*  |*10 Hz*    |

##### **Timestamp Paths**
| JDV Path                      | HDF5 Log Path                                            |
|-------------------------------|----------------------------------------------------------|
|`jaiabot::salinity` ➔ `_utime_`|`/jaiabot::salinity/jaiabot.protobuf.SalinityData/_utime_`|
<br>


## **Vehicle Data**
<br>


### **Positional Data**
- *Description of Salinity fields here...* <br>
- *Raw vs calculated, compensation equations etc...* <br>


##### **Data Paths**
| Data Field         | JDV Path                               | HDF5 Log Path                                                     | Unit  | Frequency |
|--------------------|----------------------------------------|-------------------------------------------------------------------|-------|-----------|
|**Latitude**|`goby::middleware::groups::gpsd::tpv` ➔ `location` ➔ `lat`|`/goby::middleware::groups::gpsd::tpv/goby.middleware.protobuf.gpsd.TimePositionVelocity/location/lat`|*Decimal °*|*5 Hz*|
|**Longitude**|`goby::middleware::groups::gpsd::tpv` ➔ `location` ➔ `lon`|`/goby::middleware::groups::gpsd::tpv/goby.middleware.protobuf.gpsd.TimePositionVelocity/location/lon`|*Decimal °*|*5 Hz*|
|**Speed Over Ground**|`goby::middleware::groups::gpsd::tpv` ➔ `speed`|`/goby::middleware::groups::gpsd::tpv/goby.middleware.protobuf.gpsd.TimePositionVelocity/speed`|*m/s*|*5 Hz*|


##### **Timestamp Paths**
| JDV Path                                                     | HDF5 Log Path                                                                                   |
|--------------------------------------------------------------|-------------------------------------------------------------------------------------------------|
|`goby::middleware::groups::gpsd::tpv` ➔ `location` ➔ `_utime_`|`/goby::middleware::groups::gpsd::tpv/goby.middleware.protobuf.gpsd.TimePositionVelocity/_utime_`|


<br>












<!--
<br><br><br><br><br><br><br><br>
- [Sensor Data](#sensor-data) <br>
- [Bot Status](#bot-status) <br>
    - [Sensor Data Found Under Bot Status](#sensor-data-found-under-bot-status)
    - [Bot Data Found Under Bot Status ](#bot-data-found-under-bot-status)
- [Motor Status](#motor-status) 
- [Task Packet Data](#task-packet-data)
    - [Dive Fields](#dive-fields)
    - [Drift Fields](#drift-fields)

## Sensor Data


    
| Field Name        | Location in JDV               | Unit     | Sample Frequency |
|-------------------|------------------------------|----------|-------------------|
| `temperature`     | jaiabot::pressure_temperature| °C       | 10 Hz             |
| `pressure_adjusted`|jaiabot::pressure_adjusted   | dbar     | 10 Hz             |
| `conductivity`    |jaiabot::salinity             |   μS     |                   |
| `salinity`        |jaiabot::salinity             | ppt      |                   |
|`calculated_depth` | jaiabot::pressure_adjusted   | M        | 

<br>

* Pressure, conductivity, and salinity have a pressure_raw, conductivity_raw, salinity_raw reading respectively. These can be found under the same dropdowns as their counterpart. 
    *  Pressure_adjusted is converted from pressure_raw by zeroing out the pressure sensor right before the Jaiabot dives. 
    *  Conductivity is converted from conductivity_raw by compensating raw (measured) electrical conductivity for temperature effects, yielding specific conductivity — which is normalized to 25 °C, a standard comparison point.
        * Uses linear scaling for low conductivity measuremants (freshwater), and a nonlinear viscosity-based model for higher values (more accurate for seawater).
    * Salinity is converted from conductivity by using the Practical Salinity Scale 1978 method to convert raw conductivity measurements into derived salinity in PSU (practical salinity units, ≈ ppt), while accounting for temperature and pressure.
* Calculated_Depth is derived from pressure using the hydrostatic equation, which relates pressure to the depth of a fluid column

### JaiaBot-Bio Specific Sensor Data 

These sensor sensor dropdowns will not appear in the JDV if you are not working with a JaiaBot-Bio. 

| Field Name        | Location in JDV               | Unit     | Sample Frequency |
|-------------------|------------------------------|----------|-------------------|
| `ph`              | jaiabot::ph                  | n/a      | 10 Hz             |
| `do_solubility`|jaiabot::dissolved_oxygen |  mg/L    | 10 Hz             |
| `do_raw`          |jaiabot::dissolved_oxygen      |   mg/L     |                   |
| `do_saturation_percent` |jaiabot::dissolved_oxygen|   %   |                   |
|`do_normalized_solubility` | jaiabot::dissolved_oxygen   |   mg/L     | 

<br>

* do_solubility calculates DO solubility in mg/L under the specified conditions. It accounts for temperature, salinity, and pressure 
* do_saturation_percent expresses the measured DO concentration as a percentage of the theoretical maximum solubility under current temperature, salinity, and pressure conditions
* do_normalized_solubility is calculated at the same temperature and pressure, but assuming 0 ppt salinity, then scaled by the observed saturation percent. This represents what the oxygen concentration would be in freshwater under the same thermal and pressure conditions, at the same relative saturation level as the current environment.


## Bot Status

When locating JaiaBot::Bot_Status;XX, you will see a number after Bot_Status. This number is not significant as it just corresponds to the API software version currently being used. 

### Sensor Data Found Under Bot Status 

 Field Name        | Location in JDV               | Unit     | Sample Frequency |
|-------------------|------------------------------|----------|-------------------|
| `temperature`     | jaiabot::bot_status          | °C       | 10 Hz             |
| `salinity`        | jaiabot::bot_status           | ppt      |                   |
|`depth`            | jaiabot::bot_status          | M        | 

### Bot Data Found Under Bot Status

 Field Name        | Location in JDV               | Unit     | Sample Frequency |
|-------------------|------------------------------|----------|-------------------|
| `speed`           | jaiabot::bot_status          | M/s      | 10 Hz             |
| `battery_percent` | jaiabot::bot_status          | %        |                   |
| `mission_state`   | jaiabot::bot_status          | n/a      |

* under speed there are two more data categories: `over_ground` and `over_water`
* `battery_percent` is calculated by linearly interpolating the measured voltage against a predefined voltage-to-percentage map that reflects the battery's discharge curve. This provides an estimated battery level based on where the voltage falls between known calibration points.
* mission_state describes the command in which the JaiaBot is performing at a certain time 
    * some of those commands include `dive_prep`, `powered_descent`, `transit`, and `surface_drift`and each of them correspond to a specific number, so it can be seen on a graph. 
    * more specific descriptions of each mission state can be found at this [link](https://github.com/jaiarobotics/jaiabot/blob/2.y/src/doc/figures/mission-states.png)

<br>

## Motor Status 

If you have an older model of the Jaiabot, this dropdown category will not show up, as the older models do not have thermistor readings. 

 Field Name        | Location in JDV               | Unit     | Sample Frequency |
|-------------------|------------------------------|----------|-------------------|
| `rpm`             | jaiabot::motor_status          | n/a       |                |
| `resistance`      | jaiabot::motor_status/thermistor| ohms (Ω) |                |
| `temperature`      | jaiabot::motor_status/thermistor| °C       |                |
| `voltage`          | jaiabot::motor_status/thermistor| volts    |                |

<br>

## IMU Data 

Data relating to the JaiaBot's IMU is located under the path jaia::imu/jaiabot.protobuf.IMUData. This includes detailed measurements of the vehicle’s orientation, motion, and calibration status during operation. More information on the specifics of the measurements can be found in this [READ.ME](https://github.com/jaiarobotics/jaiabot/blob/a986dcac8259054a00a1fca71ec65a9ccf14b4bf/src/python/adafruit/README.md) file.

Field Name | Path      | Description | Units |
|----------|-----------|---------------------|---------|
| `euler_angles` | jaiabot::imu/jaiabot.protobuf.IMUData/euler_angles | There are three different properties: `heading`, `pitch`, and `roll`. These values help visualize the attitude of the vehicle during operation and are critical for motion analysis, maneuver tracking, and control logic. | Degrees
| `angular_velocity` | jaiabot::imu/jaiabot.protobuf.IMUData/angular_velocity| There is the option to view the angular velocity of the `x`, `y`, or `z` directions. | Degrees/S|
|`bot_rolled_over` | jaiabot::imu/jaiabot.protobuf.IMUData | A Boolean flag indicating if the bot has rolled over in mission | n/a
|`accuracies` | jaiabot::imu/jaiabot.protobuf.IMUData/accuracies | There are three different properties which report the accuracy of the calibration: `accelerometer`, `gyroscope`, and `magnetometer`. | numeric value between 0 (low calibration) and 3 (fully calibrated)
|`gravity`| jaiabot::imu/jaiabot.protobuf.IMUData/ | The `gravity` vector represents the negative force of gravity, away from the ground.  This vector is reported in the sensor's frame of reference.  The magnitude of this vector will be close to Earth's gravitational constant, $g_0\approx9.8m/{s^2}$. There is the option to view the gravity in the `x`, `y`, or `z` directions. | $m/{s^2}$ |

## Task Packet Data

TaskPackets are structured data objects sent from the bot that describe the details of individual mission “tasks” — like a dive, drift, or other maneuver — along with relevant measurements and metadata.

When locating JaiaBot::task_packet;XX, you will see a number after task_packet. This number is not significant as it just corresponds to the API software version currently being used. 

### Dive Fields

Field Name | Path      | Description |
|----------|-----------|---------------------|
| `bottom_dive` | jaiabot::task_packet;XX/dive | Discrete data points. Bottom dive has values of 0, 1, and 255. 0 = dive and hold, 1 = bottom dive, 255 = surface drift? | n/a
| `bottom_type` | jaiabot::task_packet/dive | Discrete data points recorded at bottom of dive. 2 = SOFT sediment. |
|`duration_to_acquire_gps` | jaiabot::task_packet;XX/dive | The time in seconds that the bot takes to reacquire GPS. Discrete data points recorded at bottom dives and at dive and holds.  | 
|`max_acceleration` | jaiabot::task_packet;xx/dive | Records the max accelaration in ${m/s^2}$ of the bot when diving. 
|`start_location`| jaiabot::task_packet;XX/dive| Contains two subfields (lat and lon). Records lat = 0 and lon = 0 when bottom_dive = 255.  | 

### Drift Fields 

Field Name | Path      | Description |
|----------|-----------|---------------------|
| `estimated_drift` | jaiabot::task_packet;XX/drift/estimated_drift | Two subfields: heading and speed which define specific surface drifts of the JaiaBot.
| `drift_duration` | jaiabot::task_packet/drift | Records how long the JaiaBot drifts for.  |
|`significant_wave_height` | jaiabot::task_packet;XX/drift | A statistical measure of ocean waves in meters, defined as the average height of the tallest one-third of waves in a set. | 



