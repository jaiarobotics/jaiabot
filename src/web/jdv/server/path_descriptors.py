from dataclasses import *
import re

@dataclass
class PathDescriptor:
    name: str
    path_suffix: str
    units: str
    description: str
    path_regex: str | None = None  # Optional regex to match paths
    invalid_values: set = None # Set of values to treat as invalid


path_descriptors = [
    PathDescriptor(
        name='Mission State',
        path_suffix='/BotStatus/mission_state',
        units='',
        description='Active state of the Jaiabot mission manager.',
    ),
    PathDescriptor(
        name='Temperature',
        path_suffix='/temperature',
        units='°C',
        description='Temperature reported by the Jaiabot internal temperature sensor.',
    ),
    PathDescriptor(
        name='Depth',
        path_suffix='/depth',
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
        path_suffix='/speed/over_water',
        units='m/s',
        description='Speed through the water reported by the Jaiabot speed sensor.',
    ),
    PathDescriptor(
        name='Speed (over ground)',
        path_suffix='/speed/over_ground',
        units='m/s',
        description='Speed over ground reported by the Jaiabot GPS receiver.',
    ),
    PathDescriptor(
        name='Timeout',
        path_suffix='/timeout',
        units='sec',
        description='',
    ),
]


def get_by_path(path: str) -> PathDescriptor | None:
    for descriptor in path_descriptors:
        if descriptor.path_regex is not None and re.match(descriptor.path_regex, path):
            return descriptor

        if descriptor.path_suffix is not None and path.endswith(descriptor.path_suffix):
            return descriptor
    
    return None

