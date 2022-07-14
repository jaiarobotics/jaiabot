import h5py
import datetime
import re

ArduinoCommand = 'jaiabot::arduino/jaiabot.protobuf.ArduinoCommand/'
ArduinoCommand_motor = ArduinoCommand + 'motor'
ArduinoCommand_rudder = ArduinoCommand + 'rudder'

BotStatus = 'jaiabot::bot_status;.+/jaiabot.protobuf.BotStatus/'
BotStatus_time = BotStatus + '_utime_'
BotStatus_latitude = BotStatus + 'location/lat'
BotStatus_longitude = BotStatus + 'location/lon'
BotStatus_attitude_heading = BotStatus + 'attitude/heading'
BotStatus_speed_over_ground = BotStatus + 'speed/over_ground'
BotStatus_course_over_ground = BotStatus + 'attitude/course_over_ground'
BotStatus_depth = BotStatus + 'depth'
BotStatus_salinity = BotStatus + 'salinity'
BotStatus_mission_state = BotStatus + 'mission_state'
BotStatus_thermocouple = BotStatus + 'thermocouple_temperature'

IMU = 'jaiabot::imu/jaiabot.protobuf.IMUData/'
IMU_euler_angles_alpha = IMU + 'euler_angles/alpha'
IMU_linear_acceleration_x = IMU + 'linear_acceleration/x'
IMU_linear_acceleration_y = IMU + 'linear_acceleration/y'
IMU_linear_acceleration_z = IMU + 'linear_acceleration/z'

PressureTemperature = 'jaiabot::pressure_temperature/jaiabot.protobuf.PressureTemperatureData/'
PressureTemperature_pressure = PressureTemperature + 'pressure'
PressureTemperature_temperature = PressureTemperature + 'temperature'

Engineering = 'jaiabot::engineering_command;.+/jaiabot.protobuf.Engineering/'
PIDControl = Engineering + 'pid_control/'
PIDControl_throttle = PIDControl + 'throttle'
PIDControl_heading = PIDControl + 'heading/target'
PIDControl_rudder = PIDControl + 'rudder'
PIDControl_depth = PIDControl + 'depth/target'
PIDControl_speed = PIDControl + 'speed/target'
PIDControl_timeout = PIDControl + 'timeout'

PIDControl_depth_Kp = PIDControl + 'depth/Kp'
PIDControl_depth_Ki = PIDControl + 'depth/Ki'
PIDControl_depth_Kd = PIDControl + 'depth/Kd'

Engineering_flag = Engineering + 'flag'

LowControl_motor = 'jaiabot::low_control/jaiabot.protobuf.LowControl/control_surfaces/motor'
LowControl_rudder = 'jaiabot::low_control/jaiabot.protobuf.LowControl/control_surfaces/rudder'

DesiredCourse_heading = 'goby::middleware::frontseat::desired_course/goby.middleware.frontseat.protobuf.DesiredCourse/heading'
DesiredCourse_speed = 'goby::middleware::frontseat::desired_course/goby.middleware.frontseat.protobuf.DesiredCourse/speed'

DesiredSetpoints = 'jaiabot::desired_setpoints/jaiabot.protobuf.DesiredSetpoints/'
DesiredSetpoints_dive_depth = DesiredSetpoints + 'dive_depth'
DesiredSetpoints_type = DesiredSetpoints + 'type'
DesiredSetpoints_helm_course_speed = DesiredSetpoints + 'helm_course/speed'
DesiredSetpoints_helm_course_heading = DesiredSetpoints + 'helm_course/heading'

HUBCommand = 'jaiabot::hub_command;.+/jaiabot.protobuf.Command/'
HUBCommand_type = HUBCommand + 'type'

TPV = 'goby::middleware::groups::gpsd::tpv/goby.middleware.protobuf.gpsd.TimePositionVelocity/'
TPV_time = TPV + '_utime_'
TPV_lat = TPV + 'location/lat'
TPV_lon = TPV + 'location/lon'
TPV_epx = TPV + 'epx'
TPV_epy = TPV + 'epy'
TPV_epv = TPV + 'epv'

def date_from_micros(micros):
    date = datetime.datetime.fromtimestamp(micros / 1e6, tz=datetime.timezone.utc).astimezone()
    return date


class Series:
    def __init__(self, name, data, dtype) -> None:
        self.name = name
        self.data = data
        self.dtype = dtype


class H5FileSet:

    def __init__(self, h5_filenames) -> None:
        self.h5_files = [h5py.File(h5_filename) for h5_filename in sorted(h5_filenames)]
        self.series = {}

    def __getitem__(self, dataset_name):
        try:
            return self.series[dataset_name]
        except KeyError:
            # Name should be only the part after the period
            name = dataset_name.split('.')[-1]

            all_data = []
            dtype = None

            for h5_file in self.h5_files:
                try:
                    dataset = h5_file[dataset_name]
                    dtype = dataset.dtype
                    data = list(dataset)
                    if '_utime_' in dataset_name:
                        data = [ date_from_micros(micros) for micros in data ]
                        name = name.replace('_utime_', 'time')
                    all_data.extend(data)
                except KeyError:
                    continue

                # Sentinel nil value, to prevent connection of multiple series
                all_data.append(None)

            series = Series(name, all_data, dtype)
            self.series[dataset_name] = series
            return series

    def check_enum_dtype(self, dataset_name):
        for h5_file in self.h5_files:
            try:
                dataset = h5_file[dataset_name]
                enum_names = dataset.attrs['enum_names']
                enum_values = dataset.attrs['enum_values']
                return { enum_values[index]: enum_names[index] for index in range(0, len(enum_values))}
            except KeyError:
                continue
        
        return None

    # Finds a datapath, given a regular expression for that datapath
    def find_datapath_re(self, regex):

        def find_re(name):
            if re.match(regex, name):
                return name

        for h5_file in self.h5_files:
            datapath = h5_file.visit(find_re)
            if datapath is not None:
                return datapath
        
        return None
