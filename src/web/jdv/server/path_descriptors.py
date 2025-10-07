from dataclasses import *
import re
import logging

l = logging.getLogger(__file__)


@dataclass
class PathDescriptor:
    name: str
    path_suffix: str
    units: str
    frequency: float | None = None
    description: str | None = None
    path_regex: str | None = None  # Optional regex to match paths
    invalid_values: set = None # Set of values to treat as invalid


path_descriptors = [
    PathDescriptor(
        name='Mission State',
        path_suffix='BotStatus/mission_state',
        units='',
        description='Active state of the JaiaBot mission manager.',
    ),
    PathDescriptor(
        name='Bot ID',
        path_suffix='BotStatus/bot_id',
        units='',
        description='Bot ID of the JaiaBot.',
    ),
    PathDescriptor(
        name='Temperature',
        path_suffix='BotStatus/temperature',
        units='°C',
        description='Temperature reported by the JaiaBot temperature sensor.',
    ),
    PathDescriptor(
        name='Depth',
        path_suffix='BotStatus/depth',
        units='m',
        description='Depth below the water surface reported by the JaiaBot pressure sensor.',
    ),
    PathDescriptor(
        name='Latitude',
        path_suffix='BotStatus/location/lat',
        units='°',
        description='Latitude reported by the JaiaBot GPS receiver.',
    ),
    PathDescriptor(
        name='Longitude',
        path_suffix='BotStatus/location/lon',
        units='°',
        description='Longitude reported by the JaiaBot GPS receiver.',
    ),
    PathDescriptor(
        name='Course Over Ground',
        path_suffix='/attitude/course_over_ground',
        units='°',
        description='Course over ground reported by the JaiaBot GPS receiver.',
    ),
    PathDescriptor(
        name='Heading',
        path_suffix='/attitude/heading',
        units='°',
        description='Heading reported by the JaiaBot compass.',
    ),
    PathDescriptor(
        name='Pitch',
        path_suffix='/attitude/pitch',
        units='°',
        description='Pitch reported by the JaiaBot IMU.',
    ),
    PathDescriptor(
        name='Roll',
        path_suffix='/attitude/roll',
        units='°',
        description='Roll reported by the JaiaBot IMU.',
    ),
    PathDescriptor(
        name='Speed (over water)',
        path_suffix='BotStatus/speed/over_water',
        units='m/s',
        description='Speed through the water reported by the JaiaBot speed sensor.',
    ),
    PathDescriptor(
        name='Speed (over ground)',
        path_suffix='BotStatus/speed/over_ground',
        units='m/s',
        description='Speed over ground reported by the JaiaBot GPS receiver.',
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
        description='Uncompensated water pressure as reported directly from the sensor.'
    ),
    PathDescriptor(
        name='Adjusted Pressure',
        path_suffix='PressureAdjustedData/pressure_adjusted',
        units='dbar',
        description='Water pressure adjusted for atmospheric pressure.'
    ),
    PathDescriptor(
        name='Calculated Depth',
        path_suffix='PressureAdjustedData/calculated_depth',
        units='m',
        description='Calculated depth.'
    ),
    PathDescriptor(
        name='Conductivity',
        path_suffix='SalinityData/conductivity',
        units='μS/cm',
        description='Conductivity adjusted to a 25 °C standard.'
    ),
    PathDescriptor(
        name='Conductivity',
        path_suffix='AtlasScientificOEMEC/conductivity',
        units='μS/cm',
        frequency=10,
        description='Conductivity adjusted to a 25 °C standard.'
    ),
    PathDescriptor(
        name='Raw Conductivity',
        path_suffix='SalinityData/conductivity_raw',
        units='μS/cm',
        description='Raw conductivity as reported directly from the sensor.'
    ),
    PathDescriptor(
        name='Raw Conductivity',
        path_suffix='AtlasScientificOEMEC/conductivity_raw',
        units='μS/cm',
        description='Raw conductivity as reported directly from the sensor.'
    ),
    PathDescriptor(
        name='Salinity',
        path_suffix='SalinityData/salinity',
        units='ppt',
        description='Salinity adjusted for conductivity (μS/cm), temperature (°C), and pressure (dbar).'
    ),
    PathDescriptor(
        name='Salinity',
        path_suffix='AtlasScientificOEMEC/salinity',
        units='ppt',
        description='Salinity adjusted for conductivity (μS/cm), temperature (°C), and pressure (dbar).'
    ),
    PathDescriptor(
        name='Raw Salinity',
        path_suffix='SalinityData/salinity_raw',
        units='ppt',
        description='Raw salinity as reported directly from the sensor.'
    ),
    PathDescriptor(
        name='Raw Salinity',
        path_suffix='AtlasScientificOEMEC/salinity_raw',
        units='ppt',
        description='Raw salinity as reported directly from the sensor.'
    ),
    PathDescriptor(
        name='pH',
        path_suffix='AtlasScientificOEMpH/ph',
        units='pH',
        description='pH adjusted for temperature (°C).'
    ),
    PathDescriptor(
        name='Raw pH',
        path_suffix='AtlasScientificOEMpH/ph_raw',
        units='pH',
        description='Raw pH as reported directly from the sensor.'
    ),
    PathDescriptor(
        name='Temperature (pH Probe)',
        path_suffix='AtlasScientificOEMpH/temperature',
        units='°C',
        description='Temperature as reported by the pH probe.'
    ),
    PathDescriptor(
        name='Dissolved Oxygen Solubility',
        path_suffix='AtlasScientificOEMDO/do_solubility',
        units='mg/L',
        description='DO Solubility at current temperature (C), salinity (ppt), and pressure (mmhg).'
    ),
    PathDescriptor(
        name='Normalized Dissolved Oxygen Solubility',
        path_suffix='AtlasScientificOEMDO/do_normalized_solubility',
        units='mg/L',
        description='Dissolved Oxygen Solubility at 0 salinity (ppt), current temperature (C), and pressure (mmhg), scaled by observed saturation.'
    ),
    PathDescriptor(
        name='Raw Dissolved Oxygen',
        path_suffix='AtlasScientificOEMDO/do_raw',
        units='mg/L',
        description='Dissolved oxygen as reported directly from the sensor.'
    ),
    PathDescriptor(
        name='Dissolved Oxygen Saturation',
        path_suffix='AtlasScientificOEMDO/do_saturation_percent',
        units='%',
        description='Measured DO / DO Solubility at current temperature (C), salinity (ppt), and pressure (mmhg).'
    ),
    PathDescriptor(
        name='Temperature (Dissolved Oxygen)',
        path_suffix='AtlasScientificOEMDO/temperature',
        units='°C',
        description='Temperature as reported by the dissolved oxygen sensor.'
    ),
    PathDescriptor(
        name='Fluorometer Concentration',
        path_suffix='fluorometer/concentration',
        units='See fluorometer spec. sheet.',
        description='Concentration as reported by the fluorometer.'
    ),
    PathDescriptor(
        name='Fluorometer Concentration Voltage',
        path_suffix='fluorometer/concentration_voltage',
        units='V',
        description='Raw voltage reported by the analog fluorometer sensor.'
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
