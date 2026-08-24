# HDF5

## Section: Sensors

### Group: imu
* IMUCommand
  * required IMUCommandType type
    * TAKE_READING = 0
    * START_WAVE_HEIGHT_SAMPLING = 1
    * STOP_WAVE_HEIGHT_SAMPLING = 2
    * START_BOTTOM_TYPE_SAMPLING = 3
    * STOP_BOTTOM_TYPE_SAMPLING = 4
    * START_CALIBRATION = 5
* IMUData
  * optional EulerAngles euler_angles
    * optional double heading
    * optional double pitch
    * optional double roll
  * optional Acceleration linear_acceleration
    * optional double x
    * optional double y
    * optional double z
  * optional Acceleration gravity
    * optional double x
    * optional double y
    * optional double z
  * optional Accuracies accuracies
    * optional int32 accelerometer
    * optional int32 gyroscope
    * optional int32 magnetometer
  * optional IMUCalibrationState calibration_state
    * IN_PROGRESS = 1
    * COMPLETE = 2
  * optional bool bot_rolled_over
  * optional double significant_wave_height
  * optional double max_acceleration
  * optional AngularVelocity angular_velocity
    * optional double x
    * optional double y
    * optional double z
  * optional Quaternion quaternion
    * optional double w
    * optional double x
    * optional double y
    * optional double z
  * optional string imu_type
  * optional Acceleration acceleration
    * optional double x
    * optional double y
    * optional double z
  * optional MagneticField magnetic_field
    * optional double x
    * optional double y
    * optional double z
  * optional AccelerationWorld linear_acceleration_world
    * optional double north
    * optional double east
    * optional double down
* IMUIssue
  * required SolutionType solution
    * STOP_BOT = 0
    * USE_COG = 1
    * USE_CORRECTION = 2
    * RESTART_BOT = 3
    * REBOOT_BOT = 4
    * REPORT_IMU = 5
    * RESTART_IMU_PY = 6
    * REBOOT_BNO085_IMU = 7
    * REBOOT_BNO085_IMU_AND_RESTART_IMU_PY = 8
  * optional IssueType type
    * HEADING_COURSE_DIFFERENCE_TOO_LARGE = 0
  * optional MissionState mission_state
  * optional double imu_heading_course_max_diff
  * optional double heading
  * optional double desired_heading
  * optional double course_over_ground
  * optional double heading_course_difference
  * optional double pitch
  * optional double speed_over_ground
  * optional double desired_speed

### Group: pressure_temperature

* PressureTemperatureData
  * required double pressure_raw
  * optional double temperature
    * Description: Measured in Celcius 
  * required PressureSensorType sensor_type
    * BAR02 = 1
    * BAR30 = 2

### Group: pressure_adjusted

* PressureAdjustedData
  * required double pressure_raw
  * optional double pressure_adjusted
  * optional double pressure_raw_before_dive
  * optional double sensor_depth
    * Description: Measured in Meters
  * optional double depth
    * Description: Measured in Meters

### Group: salinity

* SalinityData
  * optional double conductivity_raw
    * Description: Measured in μS/cm
  * optional double conductivity
    * Description: Conductivity at 25 °C using temperature compensation measured in μS/cm 
  * optional double total_dissolved_solids
    * Description: Measured in ppm
  * optional double salinity_raw
    * Description: Measured in PSU (ppt)
  * optional double salinity
    * Description: Measured in PSU (ppt)

## Section: Low Control

### Group: low_control

* LowControl
  * required uint32 id
  * required uint32 vehicle
  * required uint64 time
  * optional ControlSurfaces control_surfaces
    * required sint32 motor
    * required sint32 port_elevator
    * required sint32 stbd_elevator
    * required sint32 rudder
    * required sint32 timeout
    * required bool led_switch_on

### Group: control_ack

* LowControlAck
  * required uint32 id
  * required uint32 vehicle
  * required uint64 time
  * required uint64 command_time
  * required GeographicCoordinate location
    * required double lat
    * required double lon
  * optional double range
  * optional double speed
  * optional double eps

## Section: DCCL Intervehicle

### Group: bot_status

* BotStatus
  * required uint32 bot_id
  * required uint64 time
  * optional uint64 last_command_time
  * optional goby.middleware.protobuf.HealthState health_state
  * repeated Error error (Reused see Error in Reused Messages Section)
  * repeated Warning warning (Reused see Warning in Reused Messages Section)
  * optional BotType bot_type
    * HYDRO = 1
    * ECHO = 2
    * BIO = 3
  * optional Link link
    * LINK_UNKNOWN = -1
    * LINK_XBEE = 0
    * LINK_WIFI = 1
    * LINK_IRIDIUM = 2
    * LINK_HUB2HUB = 3
  * optional GeographicCoordinate location
    * required double lat
    * required double lon
  * optional double sensor_depth
    * Description: Measured in Meters
  * optional double depth
    * Description: Measured in Meters
  * optional Attitude attitude
    * optional double roll
    * optional double pitch
    * optional double heading
    * optional double course_over_ground
  * optional Speed speed 
    * optional double over_ground
    * optional double over_water
  * optional MissionState mission_state
  * optional int32 active_goal
  * optional double distance_to_active_goal
  * optional uint32 active_goal_timeout
  * optional int32 repeat_index
  * optional double salinity
    * Description: Measured in PSS 
  * optional double temperature
    * Description: Measured in Celcius
  * optional double battery_percent
  * optional int32 calibration_status
  * optional IMUCalibrationState calibration_state
    * IN_PROGRESS = 1
    * COMPLETE = 2
  * optional double hdop
  * optional double pdop
  * optional int32 wifi_link_quality_percentage
  * optional uint64 received_time

### Group: hub_command

* Command
  * required uint32 bot_id
  * required uint64 time
  * optional Link link
    * LINK_UNKNOWN = -1
    * LINK_XBEE = 0
    * LINK_WIFI = 1
    * LINK_IRIDIUM = 2
    * LINK_HUB2HUB = 3
  * optional uint32 from_hub_id
  * required CommandType type
    * MISSION_PLAN = 1
    * ACTIVATE = 2
    * START_MISSION = 3
    * MISSION_PLAN_FRAGMENT = 4
    * NEXT_TASK = 10
    * RETURN_TO_HOME = 11
    * STOP = 12
    * PAUSE = 13
    * RESUME = 14
    * REMOTE_CONTROL_SETPOINT = 20
    * REMOTE_CONTROL_TASK = 21
    * REMOTE_CONTROL_RESUME_MOVEMENT = 22
    * RECOVERED = 30
    * SHUTDOWN = 31
    * RETRY_DATA_OFFLOAD = 32
    * DATA_OFFLOAD_COMPLETE = 33
    * DATA_OFFLOAD_FAILED = 34
    * RESTART_ALL_SERVICES = 40
    * REBOOT_COMPUTER = 41
    * SHUTDOWN_COMPUTER = 42 
  * oneof command_data
    * MissionPlan plan
      * optional MissionStart start
        * START_IMMEDIATELY = 1
        * START_ON_COMMAND = 2
      * optional MovementType movement
        * TRANSIT = 1
        * REMOTE_CONTROL = 2
        * TRAIL = 3
      * repeated Goal goal
        * optional string name
        * required GeographicCoordinate location
        * optional MissionTask task
        * optional bool moveWptMode
      * optional Recovery recovery
        * optional bool recover_at_final_goal
        * optional GeographicCoordinate location
      * optional Speeds speeds
        * optional double transit
        * optional double stationkeep_outer
      * optional BottomDepthSafetyParams bottom_depth_safety_params
        * required double constant_heading
        * required int32 constant_heading_time
        * required double constant_heading_speed
        * required double safety_depth
      * optional uint32 fragment_index
      * optional uint32 expected_fragments
      * optional uint32 repeats
      * oneof movement_params
        * TrailParam trail
          * optional int32 contact
          * optional double angle
          * optional bool angle_relative
          * optional double range
    * RemoteControl rc
    * MissionTask rc_task

* CommandForHub
  * required uint32 hub_id
  * required uint64 time
  * required HubCommandType type
    * SCAN_FOR_BOTS = 5
    * RESTART_ALL_SERVICES = 40
    * REBOOT_COMPUTER = 41
    * SHUTDOWN_COMPUTER = 42
    * SET_HUB_LOCATION = 80
  * optional uint32 scan_for_bot_id
  * optional GeographicCoordinate hub_location
    * required double lat
    * required double lon

### Group: task_packet

* TaskPacket
  * required uint32 bot_id
  * required uint64 start_time
  * required uint64 end_time
  * required MissionTask.TaskType type
  * optional Link link
    * LINK_UNKNOWN = -1
    * LINK_XBEE = 0
    * LINK_WIFI = 1
    * LINK_IRIDIUM = 2
    * LINK_HUB2HUB = 3
  * optional DivePacket dive
    * required double dive_rate
    * optional double unpowered_rise_rate
    * optional double powered_rise_rate
    * required double depth_achieved
    * repeated Measurements measurement
      *  optional double mean_depth
        * Description: Measured in Meters
      *  optional double mean_temperature
        * Description: Measured in Celcius
      *  optional double mean_salinity
        * Description: Measured in PSS
    * optional GeographicCoordinate start_location
    * optional double duration_to_acquire_gps
    * optional bool bottom_dive
    * optional bool reached_min_depth
    * optional BottomType bottom_type
      * HARD = 1
      * SOFT = 2
    * optional double max_acceleration
    * optional SubsurfaceCurrentVector subsurface_current
      * required double velocity
      * required double heading
  * optional DriftPacket drift
    * optional int32 drift_duration
    * optional EstimatedDrift estimated_drift
      * required double speed
      * optional double heading
    * optional GeographicCoordinate start_location
    * optional GeographicCoordinate end_location
    * optional double significant_wave_height

### Group: contact_update

* ContactUpdate
  * optional int32 contact
  * required GeographicCoordinate location
    * required double lat
    * required double lon
  * optional double speed_over_ground
  * optional double heading_or_cog

### Group: hub2hub_data

* Hub2HubData
  * required uint32 hub_id
  * required uint64 time
  * oneof contents
    * BotStatus bot_status
    * TaskPacket task_packet
    * Command command_for_bot

### Group: engineering_command

* Engineering
  * required uint32 bot_id
  * optional uint64 time
  * optional PIDControl pid_control
    * optional uint32 timeout
    * optional double throttle
    * optional PIDSettings speed
      * optional double target
      * optional double Kp
      * optional double Ki
      * optional double Kd
    * optional double rudder
    * optional PIDSettings heading
    * optional double port_elevator
    * optional double stbd_elevator
    * optional PIDSettings roll
    * optional PIDSettings pitch
    * optional PIDSettings depth
    * optional bool led_switch_on
    * optional PIDSettings heading_constant
  * optional bool query_engineering_status
  * optional bool query_bot_status
  * optional bool engineering_messages_enabled
  * optional BotStatusRate bot_status_rate
    * BotStatusRate_2_Hz = 0
    * BotStatusRate_1_Hz = 1
    * BotStatusRate_2_SECONDS = 2
    * BotStatusRate_5_SECONDS = 3
    * BotStatusRate_10_SECONDS = 4
    * BotStatusRate_20_SECONDS = 5
    * BotStatusRate_40_SECONDS = 6
    * BotStatusRate_60_SECONDS = 7
    * BotStatusRate_NO_RF = 8
  * optional GPSRequirements gps_requirements
    * optional double transit_hdop_req
    * optional double transit_pdop_req
    * optional double after_dive_hdop_req
    * optional double after_dive_pdop_req
    * optional uint32 transit_gps_fix_checks
    * optional uint32 transit_gps_degraded_fix_checks
    * optional uint32 after_dive_gps_fix_checks
  * optional RFDisableOptions rf_disable_options
    * optional bool rf_disable
    * optional int32 rf_disable_timeout_mins
  * optional BottomDepthSafetyParams bottom_depth_safety_params
    * required double constant_heading
    * required int32 constant_heading_time
    * required double constant_heading_speed
    * required double safety_depth
  * optional IMUCalibration imu_cal
    * optional bool run_cal
  * optional Echo echo
    * optional bool start_echo
    * optional bool stop_echo
    * optional EchoState echo_state
      * BOOTING = 0
      * OCTOSPI = 1
      * SD_INIT = 2
      * SD_MOUNT = 3
      * SD_CREATE = 4
      * PSSI_EN = 5
      * READY = 6
      * START = 7
      * STOP = 8
      * RUNNING = 9
  * optional uint32 flag
  * optional Bounds bounds
    * optional SurfaceBounds strb
      * optional int32 upper
      * optional int32 lower
      * optional int32 center
    * optional SurfaceBounds port
      * optional int32 upper
      * optional int32 lower
      * optional int32 center
    * optional SurfaceBounds rudder
      * optional int32 upper
      * optional int32 lower
      * optional int32 center
    * optional MotorBounds motor
      * optional int32 forwardStart
      * optional int32 reverseStart
      * optional int32 max_reverse
      * optional int32 throttle_zero_net_buoyancy
      * optional int32 throttle_dive
      * optional int32 throttle_ascent
  * optional Link link
    * LINK_UNKNOWN = -1
    * LINK_XBEE = 0
    * LINK_WIFI = 1
    * LINK_IRIDIUM = 2
    * LINK_HUB2HUB = 3

### Group: engineering_status

* Engineering (Reused see engineering_command group)

## Section: DCC Interprocess

### Group: hub_command_full

* Command (Reused see hub_command group)
* CommandForHub (Reused see hub_command group)

## Section: High Control

### Group: desired_setpoints

* DesiredSetpoints
  * required SetpointType type
    * SETPOINT_STOP = 0      
      * Description: no actuator movement - drift
    * SETPOINT_IVP_HELM = 1  
      * Description: IvPHelm setpoints (helm_course)
    * SETPOINT_REMOTE_CONTROL = 2 
      * Description: fixed heading, speed, etc. for a given duration
    * SETPOINT_DIVE = 3
      * Description: Inverse drive control (dive_depth)
    * SETPOINT_POWERED_ASCENT = 4
      * Description: Power ascent to surface
    * SETPOINT_SUSPEND_PID = 5
      * Description: stop sending PID based control messages until another SETPOINT is sent
  * optional bool is_helm_constant_course
  * oneof setpoint_data
    * goby.middleware.frontseat.protobuf.DesiredCourse helm_course
      * required double time
      * optional double heading
      * optional double speed
      * optional double depth
      * optional double pitch
      * optional double roll
      * optional double z_rate
      * optional double altitude
    * RemoteControl remote_control
      * required int32 duration
      * optional double heading
      * optional double speed
    * double dive_depth
    * double throttle

## Section: Mission Manager

### Group: mission_report

* MissionReport
  * required MissionState state
    * PRE_DEPLOYMENT__STARTING_UP = 0
    * PRE_DEPLOYMENT__IDLE = 1
    * PRE_DEPLOYMENT__SELF_TEST = 2
    * PRE_DEPLOYMENT__FAILED = 3
    * PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN = 4
    * PRE_DEPLOYMENT__READY = 5
    * IN_MISSION__UNDERWAY__REPLAN = 100
    * IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT = 110
    * IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__SETPOINT = 112
    * IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__STATION_KEEP = 113
    * IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__SURFACE_DRIFT = 114
    * IN_MISSION__UNDERWAY__MOVEMENT__TRAIL = 115
    * IN_MISSION__UNDERWAY__TASK__STATION_KEEP = 120
    * IN_MISSION__UNDERWAY__TASK__SURFACE_DRIFT = 121
    * IN_MISSION__UNDERWAY__TASK__DIVE__DIVE_PREP = 123
    * IN_MISSION__UNDERWAY__TASK__DIVE__POWERED_DESCENT = 124
    * IN_MISSION__UNDERWAY__TASK__DIVE__HOLD = 125
    * IN_MISSION__UNDERWAY__TASK__DIVE__UNPOWERED_ASCENT = 126
    * IN_MISSION__UNDERWAY__TASK__DIVE__POWERED_ASCENT = 127
    * IN_MISSION__UNDERWAY__TASK__DIVE__REACQUIRE_GPS = 128
    * IN_MISSION__UNDERWAY__TASK__DIVE__SURFACE_DRIFT = 129
    * IN_MISSION__UNDERWAY__TASK__DIVE__CONSTANT_HEADING = 130
    * IN_MISSION__UNDERWAY__TASK__CONSTANT_HEADING = 131
    * IN_MISSION__UNDERWAY__RECOVERY__TRANSIT = 140
    * IN_MISSION__UNDERWAY__RECOVERY__STATION_KEEP = 141
    * IN_MISSION__UNDERWAY__RECOVERY__STOPPED = 142
    * IN_MISSION__UNDERWAY__ABORT = 150
    * IN_MISSION__PAUSE__IMU_RESTART = 160
    * IN_MISSION__PAUSE__REACQUIRE_GPS = 161
    * IN_MISSION__PAUSE__MANUAL = 162
    * IN_MISSION__PAUSE__RESOLVE_NO_FORWARD_PROGRESS = 163
    * POST_DEPLOYMENT__RECOVERED = 200
    * POST_DEPLOYMENT__DATA_OFFLOAD = 202
    * POST_DEPLOYMENT__IDLE = 203
    * POST_DEPLOYMENT__SHUTTING_DOWN = 204
    * POST_DEPLOYMENT__FAILED = 205
  * optional int32 active_goal
  * optional GeographicCoordinate active_goal_location
    * required double lat
    * required double lon
  * optional double distance_to_active_goal
  * optional uint32 active_goal_timeout
  * optional int32 data_offload_percentage
  * optional int32 repeat_index

### Group: mission_ivp_behavior_update

* IvPBehaviorUpdate
  * oneof behavior
    * TransitUpdate transit
      * required bool active
      * optional double x
      * optional double y
      * optional double speed
      * optional int32 slip_radius
    * StationkeepUpdate stationkeep
      * required bool active
      * optional double x
      * optional double y
      * optional double outer_speed
      * optional double transit_speed
      * optional bool center_activate
    * ConstantHeadingUpdate constantHeading
      * required bool active
      * optional double heading
    * ConstantSpeedUpdate constantSpeed
      * required bool active
      * optional double speed
    * TrailUpdate trail
      * required bool active
      * optional MissionPlan.TrailParam param
        * optional int32 contact
        * optional double angle
        * optional bool angle_relative
        * optional double range
    * ContactUpdate contact
      * optional int32 contact
      * optional double x
      * optional double y
      * optional double speed
      * optional double heading_or_cog

### Group: mission_ivp_behavior_report

* IvPBehaviorReport
  * oneof behavior
    * TransitReport transit
      *  optional bool waypoint_reached

### Group: powerstate_command

* Engineering (Reused see engineering_command group)
* Command (Reused see hub_command group)
* CommandForHub (Reused see hub_command group)

### Group: mission_dive

* DivePowerDescentDebug
  * optional double current_depth
  * optional double last_depth
  * optional double goal_depth
  * optional double depth_eps
  * optional uint64 last_depth_change_time
  * optional double bottoming_timeout
  * optional bool depth_reached
  * optional bool depth_changed
  * optional bool depth_change_timeout
  * optional bool bot_is_diving

* DiveHoldDebug
  * optional double current_depth
  * optional double hold_timeout
  * optional bool dive_complete
  * optional bool hold_complete

* DiveUnpoweredAscentDebug
  * optional double current_depth
  * optional double depth_eps
  * optional double unpowered_ascent_timeout
  * optional bool unpowered_ascent_timed_out
  * optional bool surfaced

* DivePoweredAscentDebug
  * optional double current_depth
  * optional double depth_eps
  * optional bool surfaced
 
### Group: mission_tpv_meets_gps_req

* MissionTpvMeetsGpsReq
  * optional goby.middleware.protobuf.gpsd.TimePositionVelocity tpv (Reused see TimePositionVelocity in Reused Messages Section)

## Section: Hub Manager

### Group: hub_status

* HubStatus
  * required uint32 hub_id
  * required uint32 fleet_id
  * required uint64 time
  * optional goby.middleware.protobuf.HealthState health_state
    * HEALTH__OK = 1
    * HEALTH__DEGRADED = 2
    * HEALTH__FAILED = 3
  * repeated Error error (Reused see Error in Reused Messages Section)
  * repeated Warning warning (Reused see Warning in Reused Messages Section)
  * optional GeographicCoordinate location
    * required double lat
    * required double lon
  * repeated uint32 bot_ids_in_radio_file
  * optional LinuxHardwareStatus linux_hardware_status
  * optional BotOffloadData bot_offload
    * required uint32 bot_id
    * optional int32 data_offload_percentage
    * optional bool offload_succeeded
  * optional uint64 received_time
  * repeated KnownBot known_bot
    * required uint32 id
    * required uint64 last_status_time

## Section: Health

### Group: linux_hardware_status

* LinuxHardwareStatus (Reused see Reused Messages Section)

### Group: time_status

* NTPStatus
  * optional SyncSource sync_source
    * SYNC_UNKNOWN = -1
    * SYNC_UNSPECIFIED = 0
    * SYNC_PPS = 1
    * SYNC_LF_RADIO = 2
    * SYNC_HF_RADIO = 3
    * SYNC_UHF_RADIO = 4
    * SYNC_LOCAL = 5
    * SYNC_NTP = 6
    * SYNC_OTHER = 7
    * SYNC_WRISTWATCH = 8
    * SYNC_TELEPHONE = 9
  * optional LeapIndicator leap_indicator
    * LEAP_UNKNOWN = -1
    * LEAP_NONE = 0x00
    * LEAP_LAST_MINUTE_HAS_61_SECONDS = 0x01
    * LEAP_LAST_MINUTE_HAS_59_SECONDS = 0x02
    * LEAP_CLOCK_NOT_SYNCHRONIZED = 0x03
  * optional int32 system_event_counter
  * optional NTPSystemEvent last_system_event
    * NTP_SYSTEM_EVENT_UNKNOWN = -1
    * NTP_SYSTEM_EVENT_UNSPECIFIED = 0x0
    * NTP_SYSTEM_FREQ_NOT_SET = 0x1
    * NTP_SYSTEM_FREQ_SET = 0x2
    * NTP_SYSTEM_SPIKE_DETECT = 0x3
    * NTP_SYSTEM_FREQ_MODE = 0x4
    * NTP_SYSTEM_CLOCK_SYNC = 0x5
    * NTP_SYSTEM_RESTART = 0x6
    * NTP_SYSTEM_PANIC_STOP = 0x7
    * NTP_SYSTEM_NO_SYSTEM_PEER = 0x8
    * NTP_SYSTEM_LEAP_ARMED = 0x9
    * NTP_SYSTEM_LEAP_DISARMED = 0xa
    * NTP_SYSTEM_LEAP_EVENT = 0xb
    * NTP_SYSTEM_CLOCK_STEP = 0xc
    * NTP_SYSTEM_KERNEL_INFO = 0xd
    * NTP_SYSTEM_LEAPSECOND_VALUES_UPDATE_FROM_FILE = 0xe
    * NTP_SYSTEM_STALE_LEAPSECOND_VALUES = 0xf
  * optional NTPPeer system_sync_peer
    * required TallyCode tally_code
      * PEER_CODE_UNKNOWN = -1 
      * PEER_NOT_VALID = 0x20
        * Description: ' '
      * PEER_DISCARDED_BY_INTERSECTION = 0x78
        * Description: 'x'
      * PEER_DISCARDED_BY_TABLE_OVERFLOW = 0x2E
        * Description: '.'
      * PEER_DISCARDED_BY_CLUSTER_ALGORITHM = 0x2D
        * Description: '-'
      * PEER_INCLUDED_IN_COMBINE = 0x2B
        * Description: '+'
      * PEER_ALTERNATIVE_BACKUP = 0x23
        * Description: '#'
      * PEER_SYSTEM_SYNC_SOURCE = 0x2A
        * Description: '*'
      * PEER_PPS_SYNC = 0x6F 
    * required string remote
    * required string refid
    * optional int32 stratum
    * optional int32 when
    * optional int32 poll
    * optional int32 reach
    * optional float delay
    * optional float offset
    * optional float jitter
  * repeated NTPPeer peer

### Group: systemd_report

* SystemdStartReport
  * required Error clear_error (Reused see Error in Reused Messages Section)

* SystemdStopReport
  * required ServiceResult result
    * SERVICE_RESULT_UNKNOWN = 0
    * SERVICE_RESULT_SUCCESS = 1
    * SERVICE_RESULT_PROTOCOL = 2
    * SERVICE_RESULT_TIMEOUT = 3
    * SERVICE_RESULT_EXIT_CODE = 4
    * SERVICE_RESULT_SIGNAL = 5
    * SERVICE_RESULT_CORE_DUMP = 6
    * SERVICE_RESULT_WATCHDOG = 7
    * SERVICE_RESULT_START_LIMIT_HIT = 8
    * SERVICE_RESULT_RESOURCES = 9
  * required Error error (Reused see Error in Reused Messages Section)
  * optional string journal_dump_file

### Group: systemd_report_ack

* SystemdReportAck
  * required Error error_ack (Reused see Error in Reused Messages Section)

## Section: Metadata

### Group: metadata

* DeviceMetadata
  * optional string name
  * optional Version jaiabot_version
    * required string major
    * required string minor
    * required string patch
    * optional string git_hash
    * optional string git_branch
    * optional string deb_repository
    * optional string deb_release_branch
  * optional string goby_version
  * optional string moos_version
  * optional string ivp_version
  * optional string xbee_node_id
  * optional string xbee_serial_number
  * optional string raspi_firmware_version
  * optional string jaiabot_image_version
  * optional string jaiabot_image_build_date
  * optional string jaiabot_image_first_boot_date
  * optional uint32 intervehicle_api_version
  * optional bool is_simulation
  * optional uint32 fleet_id
  * optional uint32 hub_id
  * optional uint32 bot_id

* QueryDeviceMetaData
  * optional bool query_metadata_status

## Section: MOOS

### Group: moos

* MOOSMessage
  * required Type type
    * TYPE_DOUBLE = 0x44
    * TYPE_STRING = 0x53
    * TYPE_BINARY_STRING = 0x42 
  * required string key
  * oneof value
    * string svalue
    * string dvalue
    * string bvalue
  * required double unixtime
  * required int32 id
  * required string source
  * optional string source_aux
  * required string community

### Group: helm_ivp

* HelmIVPStatus
  * optional string helm_ivp_state
  * optional bool helm_ivp_desired_speed
  * optional bool helm_ivp_desired_heading
  * optional bool helm_ivp_desired_depth
  * optional bool helm_ivp_data

## Section: Subscriptions

### Group: intervehicle_subscribe_request

* extend goby.acomms.protobuf.ModemTransmission
  * optional Transmission transmission
    * optional HubInfo hub
      * optional int32 hub_id
      * optional int32 modem_id
      * optional bool changed

## Section: Arduino

### Group: arduino_from_pi

* ArduinoCommand
  * optional ArduinoSettings settings 
    * required sint32 forward_start
    * required sint32 reverse_start
  * optional ArduinoActuators actuators = 2
    * required sint32 motor
    * required sint32 port_elevator
    * required sint32 stbd_elevator
    * required sint32 rudder
    * required sint32 timeout
    * required bool led_switch_on

### Group: arduino_to_pi

* ArduinoResponse
  * required ArduinoStatusCode status_code
    * STARTUP = 0
    * ACK = 1
    * TIMEOUT = 2
    * PREFIX_READ_ERROR = 3
    * MAGIC_WRONG = 4
    * MESSAGE_TOO_BIG = 5
    * MESSAGE_WRONG_SIZE = 6
    * MESSAGE_DECODE_ERROR = 7
    * CRC_ERROR = 8
    * SETTINGS = 9
  * optional float thermocouple_temperature_C
  * optional float vccvoltage
  * optional float vcccurrent
  * optional float vvcurrent
  * optional int32 motor
  * optional float thermistor_voltage
  * optional uint32 crc
  * optional uint32 calculated_crc
  * required uint32 version

## Section: Serial

### Group: serial_out

* IOData
  * optional int32 index
  * oneof src
    * UDPEndPoint udp_src
      * required string addr
      * required uint32 port
    * TCPEndPoint tcp_src
      * optional string addr
      * optional uint32 port
      * optional bool all_clients
  * oneof dest
    * UDPEndPoint udp_src
      * required string addr
      * required uint32 port
    * TCPEndPoint tcp_src
      * optional string addr
      * optional uint32 port
      * optional bool all_clients 
  * optional bytes data 

## Section Goby

### Group: configuration

* Refer to templates directory in the jaiabot repository
  * jaiabot/config/templates

### Group: datum_update

* DatumUpdate 
  * required .goby.middleware.protobuf.LatLonPoint datum (Reused see LatLonPoint in Reused Messages Section)

### Group: health report 

* VehicleHealth
  * required uint64 time
  * required string platform
  * required HealthState state
    * HEALTH__OK
    * HEALTH__DEGRADED
    * HEALTH__FAILED
  * repeated ProcessHealth process
    * required string name
    * optional uint32 pid
    * required ThreadHealth main (Reused see ThreadHealth in Reused Messages Section)

### Group: health response

* ProcessHealth
  * required string name
  * optional uint32 pid
  * required ThreadHealth main (Reused see ThreadHealth in Reused Messages Section)

### Group: logger request 

* LoggerRequest
  * required State requested_state
    * START_LOGGING = 1
    * STOP_LOGGING = 2
    * ROTATE_LOG = 3

### Group: middleware frontseat desired_course

* DesiredCourse
  * required double time
  * optional double heading
  * optional double speed
  * optional double depth
  * optional double pitch
  * optional double roll
  * optional double z_rate
  * optional double altitude

### Group: middleware frontseat helm_state

* HelmStateReport
  * required HelmState state
    *  HELM_NOT_RUNNING = 0
    * HELM_DRIVE = 1
    * HELM_PARK = 2

### Group: middleware frontseat node_status 

* NodeStatus 
  * required double time
  * optional string name
  * optional VehicleType type
    * UNKNOWN = 0
    * AUV = 10
    * GLIDER = 11
    * USV = 20
    * USV_POWERED = 21
    * USV_SAILING = 22
    * ROV = 30
    * TARGET = 50
    * BUOY = 60
    * MOORING = 61
    * MOORING_SUBSURFACE = 62
    * MOORING_SURFACE = 63
    * SHIP = 100
    * OTHER = -1
  * required .goby.middleware.protobuf.LatLonPoint global_fix (Reused see LatLonPoint in Reused Messages Section)
  * optional CartesianCoordinate local_fix
    * required double x
    * required double y
    * optional double z
  * required EulerAngles pose
    * optional double roll
    * optional double pitch
    * optional double heading
    * optional double course_over_ground
    * optional double roll_rate
    * optional double pitch_rate
    * optional double heading_rate
  * required Speed speed
    * required double over_ground
    * optional double over_water
  * optional Source source
    * optional Sensor position
      * GPS = 1
      * USBL = 2
      * LBL = 3
      * INERTIAL_NAVIGATION_SYSTEM = 4
      * PRESSURE = 10
      * DVL = 20
      * RPM_LOOKUP = 30
      * MAGNETIC_COMPASS = 40
    * optional Sensor depth
    * optional Sensor speed
    * optional Sensor heading

### Group: middleware groups gpsd sky

* SkyView
  * optional string device
  * optional double time
  * optional double gdop
  * optional double hdop
  * optional double pdop
  * optional double tdop
  * optional double vdop
  * optional double xdop
  * optional double ydop
  * optional double nsat
  * optional double usat
  * repeated Satellite satellite
    * required int32 prn
    * optional double az
    * optional double el
    * optional double ss
    * optional bool used
    * optional int32 gnssid
    * optional int32 svid
    * optional int32 sigid
    * optional int32 freqid
    * optional int32 health
  

### Group: middleware groups gpsd tpv

* TimePositionVelocity (Reused see TimePositionVelocity in Reused Messages Section)

## Section: Reused Messages

* LatLonPoint 
  * required double lat
  * required double lon
  * optional double depth
  * optional double altitude

* ThreadHealth
  * repeated Error error (Reused see Error in Reused Messages Section)
  * repeated Warning warning (Reused see Warning in Reused Messages Section)

* TimePositionVelocity
  * optional string device
      * optional double time
      * optional Mode mode
        * ModeNotSeen = 0
        * ModeNoFix = 1
        * Mode2D = 2
        * Mode3D= 3
      * optional LatLonPoint location (Reused see LatLonPoint in Reused Messages Section)
      * optional double altitude
      * optional double track
      * optional double speed
      * optional double climb
      * optional double epc
      * optional double epd
      * optional double eps
      * optional double ept
      * optional double epv
      * optional double epx
      * optional double epy

* LinuxHardwareStatus
  * optional int32 uptime
  * optional Processor processor
    * optional LoadAverages loads
      * required float one_min
      * required float five_min
      * required float fifteen_min
    * optional int32 num_processes
    * optional int32 num_processors
  * optional Memory memory
    * required Information ram 
      * required uint64 total
      * required uint64 available
      * required float use_percent
    * required Information swap
  * optional Disk disk
    * optional Information rootfs
    * optional Information data
  * optional WiFi wifi
    * required bool is_connected
    * optional uint32 link_quality
    * optional uint32 link_quality_percentage
    * optional int32 signal_level
    * optional int32 noise_level

* MissionTask
  * optional TaskType type
    * NONE = 0
    * DIVE = 1
    * STATION_KEEP = 2
    * SURFACE_DRIFT = 3
    * CONSTANT_HEADING = 4
  * optional DiveParameters dive
    * optional double max_depth
    * optional double depth_interval
    * optional double hold_time
    * optional bool bottom_dive
  * optional DriftParameters surface_drift
    * optional int32 drift_time
  * optional ConstantHeadingParameters constant_heading
    * optional double constant_heading
    * optional int32 constant_heading_time
    * optional double constant_heading_speed
  * optional bool start_echo
  * optional StationKeepParameters station_keep
    * optional int32 station_keep_time

* Error
  * ERROR__TOO_MANY_ERRORS_TO_REPORT_ALL = 0
  * ERROR__FAILED__UNKNOWN = 1
  * ERROR__FAILED__GOBYD = 2
  * ERROR__FAILED__GOBY_LIAISON = 3
  * ERROR__FAILED__GOBY_GPS = 4
  * ERROR__FAILED__GOBY_LOGGER = 5
  * ERROR__FAILED__GOBY_CORONER = 6
  * ERROR__FAILED__GOBY_MOOS_GATEWAY = 7
  * ERROR__FAILED__JAIABOT_HEALTH = 8
  * ERROR__FAILED__JAIABOT_METADATA = 9
  * ERROR__FAILED__JAIABOT_HUB_MANAGER = 10
  * ERROR__FAILED__JAIABOT_WEB_PORTAL = 11
  * ERROR__FAILED__JAIABOT_FUSION = 12
  * ERROR__FAILED__JAIABOT_MISSION_MANAGER = 13
  * ERROR__FAILED__JAIABOT_PID_CONTROL = 14
  * ERROR__FAILED__JAIABOT_BLUEROBOTICS_PRESSURE_SENSOR_DRIVER = 15
  * ERROR__FAILED__JAIABOT_ATLAS_SCIENTIFIC_EZO_EC_DRIVER = 16
  * ERROR__FAILED__JAIABOT_ADAFRUIT_BNO055_DRIVER = 17
  * ERROR__FAILED__JAIABOT_DRIVER_ARDUINO = 18
  * ERROR__FAILED__JAIABOT_ENGINEERING = 19
  * ERROR__FAILED__MOOS_MOOSDB = 20
  * ERROR__FAILED__MOOS_PHELMIVP = 21
  * ERROR__FAILED__MOOS_UPROCESSWATCH = 22
  * ERROR__FAILED__MOOS_PNODEREPORTER = 23
  * ERROR__FAILED__PYTHON_JAIABOT_WEB_APP = 24
  * ERROR__FAILED__PYTHON_JAIABOT_IMU = 25
  * ERROR__FAILED__PYTHON_JAIABOT_PRESSURE_SENSOR = 26
  * ERROR__FAILED__PYTHON_JAIABOT_AS_EZO_EC = 27
  * ERROR__FAILED__JAIABOT_LOG_CONVERTER = 28
  * ERROR__FAILED__JAIABOT_DATA_VISION = 29
  * ERROR__FAILED__JAIABOT_SIMULATOR = 30
  * ERROR__FAILED__MOOS_SIM_MOOSDB = 31
  * ERROR__FAILED__MOOS_SIM_USIMMARINE = 32
  * ERROR__FAILED__GOBY_INTERVEHICLE_PORTAL = 33
  * ERROR__FAILED__JAIABOT_ADAFRUIT_BNO085_DRIVER = 34
  * ERROR__FAILED__JAIABOT_ECHO_DRIVER = 35
  * ERROR__FAILED__PYTHON_JAIABOT_ECHO = 36
  * ERROR__FAILED__JAIABOT_TSYS01_TEMPERATURE_SENSOR_DRIVER = 37
  * ERROR__FAILED__PYTHON_JAIABOT_TSYS01_TEMPERATURE_SENSOR_DRIVER = 38
  * ERROR__FAILED__PYTHON_JAIABOT_MOTOR_LISTENER = 39
  * ERROR__FAILED__JAIABOT_SENSORS = 40
  * ERROR__FAILED__JAIABOT_COMMS_MANAGER = 41
  * ERROR__FAILED__JAIABOT_CTD_MANAGER = 42
  * ERROR__FAILED__JAIABOT_UDP_GATEWAY = 43
  * ERROR__FAILED__JAIABOT_PPK = 44
  * ERROR__FAILED__JAIABOT_CURRENTS_AND_WAVE_ESTIMATOR = 45
  * ERROR__NOT_RESPONDING__UNKNOWN_APP = 100
  * ERROR__NOT_RESPONDING__GOBYD = 101
  * ERROR__NOT_RESPONDING__GOBY_LIAISON = 102
  * ERROR__NOT_RESPONDING__GOBY_GPS = 103
  * ERROR__NOT_RESPONDING__GOBY_LOGGER = 104
  * ERROR__NOT_RESPONDING__GOBY_CORONER = 105
  * ERROR__NOT_RESPONDING__JAIABOT_HEALTH = 106
  * ERROR__NOT_RESPONDING__JAIABOT_METADATA = 107
  * ERROR__NOT_RESPONDING__JAIABOT_HUB_MANAGER = 108
  * ERROR__NOT_RESPONDING__JAIABOT_WEB_PORTAL = 109
  * ERROR__NOT_RESPONDING__JAIABOT_FUSION = 110
  * ERROR__NOT_RESPONDING__GOBY_MOOS_GATEWAY = 111
  * ERROR__NOT_RESPONDING__JAIABOT_MISSION_MANAGER = 112
  * ERROR__NOT_RESPONDING__JAIABOT_PID_CONTROL = 113
  * ERROR__NOT_RESPONDING__JAIABOT_BLUEROBOTICS_PRESSURE_SENSOR_DRIVER = 114
  * ERROR__NOT_RESPONDING__JAIABOT_ATLAS_SCIENTIFIC_EZO_EC_DRIVER = 115
  * ERROR__NOT_RESPONDING__JAIABOT_ADAFRUIT_BNO055_DRIVER = 116
  * ERROR__NOT_RESPONDING__JAIABOT_DRIVER_ARDUINO = 117
  * ERROR__NOT_RESPONDING__JAIABOT_ENGINEERING = 118
  * ERROR__NOT_RESPONDING__JAIABOT_SINGLE_THREAD_PATTERN = 119
  * ERROR__NOT_RESPONDING__JAIABOT_MULTI_THREAD_PATTERN = 120
  * ERROR__NOT_RESPONDING__JAIABOT_SIMULATOR = 121
  * ERROR__NOT_RESPONDING__GOBY_INTERVEHICLE_PORTAL = 122
  * ERROR__NOT_RESPONDING__JAIABOT_ADAFRUIT_BNO085_DRIVER = 123
  * ERROR__NOT_RESPONDING__JAIABOT_ECHO_DRIVER = 124
  * ERROR__NOT_RESPONDING__JAIABOT_TSYS01_TEMPERATURE_SENSOR_DRIVER = 125
  * ERROR__NOT_RESPONDING__JAIABOT_DRIVER_CAMERA = 126
  * ERROR__NOT_RESPONDING__JAIABOT_COMMS_MANAGER = 127
  * ERROR__MISSING_DATA__GPS_FIX = 200
  * ERROR__MISSING_DATA__GPS_POSITION = 201
  * ERROR__MISSING_DATA__PRESSURE = 210
  * ERROR__MISSING_DATA__HEADING = 212
  * ERROR__MISSING_DATA__SPEED = 215
  * ERROR__MISSING_DATA__COURSE = 216
  * ERROR__MISSING_DATA__CALIBRATION_SYS = 217
  * ERROR__MISSING_DATA__CALIBRATION_GYRO = 218
  * ERROR__MISSING_DATA__CALIBRATION_ACCEL = 219
  * ERROR__MISSING_DATA__CALIBRATION_MAG = 220
  * ERROR__NOT_CALIBRATED_SYS = 221
  * ERROR__NOT_CALIBRATED_GYRO = 222
  * ERROR__NOT_CALIBRATED_ACCEL = 223
  * ERROR__NOT_CALIBRATED_MAG = 224
  * ERROR__NOT_CALIBRATED_IMU = 225
  * ERROR__COMMS__NO_XBEE = 300
  * ERROR__MOOS__HELMIVP_STATE_NOT_DRIVE = 400
  * ERROR__MOOS__HELMIVP_NO_DESIRED_DATA = 401
  * ERROR__MOOS__NO_DATA = 402
  * ERROR__SYSTEM__CANNOT_READ_MEMINFO = 500
  * ERROR__SYSTEM__RAM_SPACE_CRITICAL = 501
  * ERROR__SYSTEM__CANNOT_READ_SYSINFO = 502
  * ERROR__SYSTEM__CPU_LOAD_FACTOR_CRITICAL = 503
  * ERROR__SYSTEM__CANNOT_READ_DISK_USAGE = 504
  * ERROR__SYSTEM__ROOTFS_DISK_SPACE_CRITICAL = 505
  * ERROR__SYSTEM__DATA_DISK_SPACE_CRITICAL = 506
  * ERROR__SYSTEM__NTP_PEERS_QUERY_FAILED = 510
  * ERROR__SYSTEM__NTP_STATUS_QUERY_FAILED = 511
  * ERROR__VEHICLE__VERY_LOW_BATTERY = 600
  * ERROR__VEHICLE__CRITICALLY_LOW_BATTERY = 601
  * ERROR__VEHICLE__MISSING_DATA_BATTERY = 602
  * ERROR__VERSION__MISMATCH_ARDUINO = 700
  * ERROR__MISSING_DATA__ARDUINO_REPORT = 701
  * ERROR__VERSION__MISMATCH_INTERVEHICLE__UPGRADE_HUB = 702
  * ERROR__VERSION__MISMATCH_INTERVEHICLE__UPGRADE_BOT = 703
  * ERROR__ARDUINO_CONNECTION_FAILED = 704
  * ERROR__INIT_FAILED__BLUE_ROBOTICS__BAR30 = 800
  * ERROR__MISSING_DATA__BLUEROBOTICS_BAR30_DATA = 801

* Warning
  * WARNING__TOO_MANY_WARNINGS_TO_REPORT_ALL = 0
  * WARNING__NOT_RESPONDING__UNKNOWN_APP = 100
  * WARNING__NOT_RESPONDING__JAIABOT_ATLAS_SCIENTIFIC_EZO_EC_DRIVER = 101
  * WARNING__NOT_RESPONDING__JAIABOT_BLUEROBOTICS_PRESSURE_SENSOR_DRIVER = 102
  * WARNING__NOT_RESPONDING__JAIABOT_ADAFRUIT_BNO055_DRIVER = 103
  * WARNING__NOT_RESPONDING__JAIABOT_ADAFRUIT_BNO085_DRIVER = 104
  * WARNING__NOT_RESPONDING__JAIABOT_ECHO_DRIVER = 105
  * WARNING__NOT_RESPONDING__JAIABOT_TSYS01_TEMPERATURE_SENSOR_DRIVER = 106
  * WARNING__NOT_RESPONDING__JAIABOT_CURRENTS_AND_WAVE_ESTIMATOR = 107
  * WARNING__MISSING_DATA__PITCH = 200
  * WARNING__MISSING_DATA__ROLL = 201
  * WARNING__MISSING_DATA__TEMPERATURE = 202
  * WARNING__MISSING_DATA__COURSE = 216
  * WARNING__NOT_CALIBRATED_SYS = 221
  * WARNING__IMU_ISSUE = 222
  * WARNING__TEMPERATURE__ARDUINO_TOO_HIGH = 210
  * WARNING__TEMPERATURE__LINUX_TOO_HIGH = 211
  * WARNING__COMMS_LOW_SIGNAL_STRENGTH = 300
  * WARNING__VEHICLE__LOW_BATTERY = 400
  * WARNING__SYSTEM__NTP_NOT_SYNCHRONIZED = 500
  * WARNING__SYSTEM__NTP_OFFSET_HIGH = 501
  * WARNING__SYSTEM__NTP_JITTER_HIGH = 502
  * WARNING__SYSTEM__RAM_SPACE_LOW = 503
  * WARNING__SYSTEM__CPU_LOAD_FACTOR_HIGH = 504
  * WARNING__SYSTEM__ROOTFS_DISK_SPACE_LOW = 505
  * WARNING__SYSTEM__DATA_DISK_SPACE_LOW = 506
  * WARNING__NOT_RESPONDING__JAIABOT_RPM_LISTENER = 600
  * WARNING__NOT_RESPONDING__JAIABOT_ARDUINO_MOTOR_TEMP = 601
  * WARNING__MISSION__INFEASIBLE_MISSION__TRANSIT_MUST_HAVE_A_GOAL = 700
  * WARNING__MISSION__INFEASIBLE_MISSION__TRANSIT_CANNOT_RECOVER_AT_FINAL_GOAL_WITHOUT_A_GOAL = 701
  * WARNING__MISSION__INFEASIBLE_MISSION__MUST_HAVE_RECOVERY_LOCATION_IF_NOT_RECOVERING_AT_FINAL_GOAL = 702
  * WARNING__MISSION__INFEASIBLE_MISSION__MINIMUM_BOTTOM_DEPTH_REACHED = 703
  * WARNING__MISSION__INFEASIBLE_MISSION__GOAL_DESIRED_DEPTH_EXCEEDED_MAX = 704
  * WARNING__VEHICLE__NO_FORWARD_PROGRESS = 705
  * WARNING__MISSION__DATA_OFFLOAD_FAILED = 720
  * WARNING__MISSION__DATA__GPS_FIX_DEGRADED = 721
  * WARNING__MISSION__DATA_PRE_OFFLOAD_FAILED = 722
  * WARNING__MISSION__DATA_POST_OFFLOAD_FAILED = 723
  * WARNING__INIT_FAILED__ATLAS_SCIENTIFIC__OEM_DO = 800
  * WARNING__INIT_FAILED__ATLAS_SCIENTIFIC__OEM_EC = 801
  * WARNING__INIT_FAILED__ATLAS_SCIENTIFIC__OEM_PH = 802
  * WARNING__INIT_FAILED__TURNER__C_FLUOR = 803
  * WARNING__MISSING_DATA__ATLAS_OEM_EC_DATA = 804
  * WARNING__MISSING_DATA__ATLAS_OEM_PH_DATA = 805
  * WARNING__MISSING_DATA__ATLAS_OEM_DO_DATA = 806
  * WARNING__MISSING_DATA__TURNER_C_FLUOR_DATA = 807
   