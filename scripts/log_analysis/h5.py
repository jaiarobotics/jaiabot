import h5py
import datetime

BotStatus = 'jaiabot::bot_status;0/jaiabot.protobuf.BotStatus/'
BotStatus_time = BotStatus + '_utime_'
BotStatus_latitude = BotStatus + 'location/lat'
BotStatus_longitude = BotStatus + 'location/lon'
BotStatus_attitude_heading = BotStatus + 'attitude/heading'
BotStatus_speed_over_ground = BotStatus + 'speed/over_ground'
BotStatus_course_over_ground = BotStatus + 'attitude/course_over_ground'
BotStatus_depth = BotStatus + 'depth'
BotStatus_salinity = BotStatus + 'salinity'
BotStatus_mission_state = BotStatus + 'mission_state'

PressureTemperature = 'jaiabot::pressure_temperature/jaiabot.protobuf.PressureTemperatureData/'
PressureTemperature_pressure = PressureTemperature + 'pressure'
PressureTemperature_temperature = PressureTemperature + 'temperature'

PIDControl = 'jaiabot::engineering_command;0/jaiabot.protobuf.Engineering/pid_control/'
PIDControl_throttle = PIDControl + 'throttle'
PIDControl_heading = PIDControl + 'heading/target'
PIDControl_rudder = PIDControl + 'rudder'
PIDControl_depth = PIDControl + 'depth/target'
PIDControl_speed = PIDControl + 'speed/target'
PIDControl_timeout = PIDControl + 'timeout'

PIDControl_depth_Kp = PIDControl + 'depth/Kp'
PIDControl_depth_Ki = PIDControl + 'depth/Ki'
PIDControl_depth_Kd = PIDControl + 'depth/Kd'

Engineering_flag = 'jaiabot::engineering_command;0/jaiabot.protobuf.Engineering/flag'

LowControl_motor = 'jaiabot::low_control/jaiabot.protobuf.LowControl/control_surfaces/motor'
LowControl_rudder = 'jaiabot::low_control/jaiabot.protobuf.LowControl/control_surfaces/rudder'

DesiredCourse_heading = 'goby::middleware::frontseat::desired_course/goby.middleware.frontseat.protobuf.DesiredCourse/heading'
DesiredCourse_speed = 'goby::middleware::frontseat::desired_course/goby.middleware.frontseat.protobuf.DesiredCourse/speed'

DesiredSetpoints = 'jaiabot::desired_setpoints/jaiabot.protobuf.DesiredSetpoints/'
DesiredSetpoints_dive_depth = DesiredSetpoints + 'dive_depth'
DesiredSetpoints_type = DesiredSetpoints + 'type'

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
    def __init__(self, name, data) -> None:
        self.name = name
        self.data = data


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

            for h5_file in self.h5_files:
                try:
                    data = list(h5_file[dataset_name])
                    if '_utime_' in dataset_name:
                        data = [ date_from_micros(micros) for micros in data ]
                        name = name.replace('_utime_', 'time')
                    all_data.extend(data)
                except KeyError:
                    print(f'WARNING:  Cannot locate {dataset_name} in {h5_file}')
                    continue

                # Sentinel nil value, to prevent connection of multiple series
                all_data.append(None)

            series = Series(name, all_data)
            self.series[dataset_name] = series
            return series

    def check_enum_dtype(self, dataset_name):
        dataset = self.h5_files[0][dataset_name]
        try:
            enum_names = dataset.attrs['enum_names']
            enum_values = dataset.attrs['enum_values']
            return { enum_values[index]: enum_names[index] for index in range(0, len(enum_values))}
        except KeyError:
            return None
