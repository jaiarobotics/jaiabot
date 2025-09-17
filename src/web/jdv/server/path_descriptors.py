from dataclasses import *
import re
import logging

l = logging.getLogger(__file__)


@dataclass
class PathDescriptor:
    name: str
    path_suffix: str
    units: str
    description: str | None = None
    path_regex: str | None = None  # Optional regex to match paths
    invalid_values: set = None # Set of values to treat as invalid


path_descriptors = [
    PathDescriptor(
        name='Mission State',
        path_suffix='BotStatus/mission_state',
        units='',
        description='Active state of the Jaiabot mission manager.',
    ),
    PathDescriptor(
        name='Temperature',
        path_suffix='BotStatus/temperature',
        units='°C',
        description='Temperature reported by the Jaiabot internal temperature sensor.',
    ),
    PathDescriptor(
        name='Depth',
        path_suffix='BotStatus/depth',
        units='m',
        description='Depth below the water surface reported by the Jaiabot depth sensor.',
    ),
    PathDescriptor(
        name='Latitude',
        path_suffix='BotStatus/location/lat',
        units='°',
        description='Latitude reported by the Jaiabot GPS receiver.',
    ),
    PathDescriptor(
        name='Longitude',
        path_suffix='BotStatus/location/lon',
        units='°',
        description='Longitude reported by the Jaiabot GPS receiver.',
    ),
    PathDescriptor(
        name='Course Over Ground',
        path_suffix='/attitude/course_over_ground',
        units='°',
        description='Course over ground reported by the Jaiabot GPS receiver.',
    ),
    PathDescriptor(
        name='Heading',
        path_suffix='/attitude/heading',
        units='°',
        description='Heading reported by the Jaiabot compass.',
    ),
    PathDescriptor(
        name='Pitch',
        path_suffix='/attitude/pitch',
        units='°',
        description='Pitch reported by the Jaiabot IMU.',
    ),
    PathDescriptor(
        name='Roll',
        path_suffix='/attitude/roll',
        units='°',
        description='Roll reported by the Jaiabot IMU.',
    ),
    PathDescriptor(
        name='Speed (over water)',
        path_suffix='BotStatus/speed/over_water',
        units='m/s',
        description='Speed through the water reported by the Jaiabot speed sensor.',
    ),
    PathDescriptor(
        name='Speed (over ground)',
        path_suffix='BotStatus/speed/over_ground',
        units='m/s',
        description='Speed over ground reported by the Jaiabot GPS receiver.',
    ),
    PathDescriptor(
        name='Control surfaces timeout',
        path_suffix='control_surfaces/timeout',
        units='sec',
        description='Command timeout for motor and actuators',
    ),
    PathDescriptor(
        name='Raw Pressure',
        path_suffix='PressureTemperatureData/pressure_raw',
        units='dbar',
        description='Pressure as reported directly from the sensor.'
    ),
    PathDescriptor(
        name='Adjusted Pressure',
        path_suffix='PressureAdjustedData/pressure_adjusted',
        units='dbar',
        description='Adjusted pressure.'
    ),
    PathDescriptor(
        name='Calculated Depth',
        path_suffix='PressureAdjustedData/calculated_depth',
        units='m',
        description='Calculated depth.'
    ),
]


def get_title_from_path(path: str):
    components = path.split('/')
    if len(components) < 2:
        l.warning(f'Not enough components in path: {path}')
        return ''

    components = components[1:]

    message_type_components = components[0].split('.')

    if len(message_type_components) < 1:
        l.warning(f'Invalid path: {path}')
        return ''

    components[0] = components[0].split('.')[-1]
    return '/'.join(components)


def get_by_path(path: str) -> PathDescriptor | None:
    for descriptor in path_descriptors:
        if descriptor.path_regex is not None and re.match(descriptor.path_regex, path):
            return descriptor

        if descriptor.path_suffix is not None and path.endswith(descriptor.path_suffix):
            return descriptor
    
    return PathDescriptor(
        name=get_title_from_path(path),
        path_suffix=None,
        units='',
        description=None,
    )
