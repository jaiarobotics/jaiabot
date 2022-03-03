import h5py
import datetime

BotStatus_time = 'jaiabot::bot_status;0/jaiabot.protobuf.BotStatus/_utime_'
BotStatus_latitude = 'jaiabot::bot_status;0/jaiabot.protobuf.BotStatus/location/lat'
BotStatus_longitude = 'jaiabot::bot_status;0/jaiabot.protobuf.BotStatus/location/lon'
BotStatus_speed_over_ground = 'jaiabot::bot_status;0/jaiabot.protobuf.BotStatus/speed/over_ground'
BotStatus_course_over_ground = 'jaiabot::bot_status;0/jaiabot.protobuf.BotStatus/attitude/course_over_ground'
BotStatus_depth = 'jaiabot::bot_status;0/jaiabot.protobuf.BotStatus/depth'
BotStatus_salinity = 'jaiabot::bot_status;0/jaiabot.protobuf.BotStatus/salinity'

PressureTemperature_time = 'jaiabot::pressure_temperature/jaiabot.protobuf.PressureTemperatureData/_utime_'
PressureTemperature_pressure = 'jaiabot::pressure_temperature/jaiabot.protobuf.PressureTemperatureData/pressure'
PressureTemperature_temperature = 'jaiabot::pressure_temperature/jaiabot.protobuf.PressureTemperatureData/temperature'

RestCommand_time = 'jaiabot::bot_status;0/jaiabot.protobuf.rest.Command/_utime_'
RestCommand_throttle = 'jaiabot::bot_status;0/jaiabot.protobuf.rest.Command/throttle'
RestCommand_heading = 'jaiabot::bot_status;0/jaiabot.protobuf.rest.Command/heading/target'
RestCommand_rudder = 'jaiabot::bot_status;0/jaiabot.protobuf.rest.Command/rudder'
RestCommand_depth = 'jaiabot::bot_status;0/jaiabot.protobuf.rest.Command/depth/target'
RestCommand_speed = 'jaiabot::bot_status;0/jaiabot.protobuf.rest.Command/speed/target'
RestCommand_timeout = 'jaiabot::bot_status;0/jaiabot.protobuf.rest.Command/timeout'

VehicleCommand_time = 'jaiabot::vehicle_command/jaiabot.protobuf.VehicleCommand/_utime_'
VehicleCommand_motor = 'jaiabot::vehicle_command/jaiabot.protobuf.VehicleCommand/control_surfaces/motor'


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
                    pass

                # Sentinel nil value, to prevent connection of multiple series
                all_data.append(None)

            series = Series(name, all_data)
            self.series[dataset_name] = series
            return series
