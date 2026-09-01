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
    invalid_values: set | None = None # Set of values to treat as invalid


path_descriptors = [
    PathDescriptor(
        name='Mission State',
        path_suffix='BotStatus/mission_state',
        units='',
        frequency=1,
        description='Active state of the JaiaBot mission manager.',
    ),
    PathDescriptor(
        name='Bot ID',
        path_suffix='BotStatus/bot_id',
        units='',
        frequency=1,
        description='Bot ID of the JaiaBot.',
    ),
    PathDescriptor(
        name='Temperature',
        path_suffix='BotStatus/temperature',
        units='°C',
        frequency=1,
        description='Temperature reported by the JaiaBot temperature sensor.',
    ),
    PathDescriptor(
        name='Depth',
        path_suffix='BotStatus/depth',
        units='m',
        frequency=1,
        description='Depth below the water surface reported by the JaiaBot pressure sensor.',
    ),
    PathDescriptor(
        name='Latitude',
        path_suffix='BotStatus/location/lat',
        units='°',
        frequency=1,
        description='Latitude reported by the JaiaBot GPS receiver.',
    ),
    PathDescriptor(
        name='Longitude',
        path_suffix='BotStatus/location/lon',
        units='°',
        frequency=1,
        description='Longitude reported by the JaiaBot GPS receiver.',
    ),
    PathDescriptor(
        name='Course Over Ground',
        path_suffix='/attitude/course_over_ground',
        units='°',
        frequency=10,
        description='Course over ground reported by the JaiaBot GPS receiver.',
    ),
    PathDescriptor(
        name='Heading',
        path_suffix='/attitude/heading',
        units='°',
        frequency=10,
        description='Heading reported by the JaiaBot compass.',
    ),
    PathDescriptor(
        name='Pitch',
        path_suffix='/attitude/pitch',
        units='°',
        frequency=10,
        description='Pitch reported by the JaiaBot IMU.',
    ),
    PathDescriptor(
        name='Roll',
        path_suffix='/attitude/roll',
        units='°',
        frequency=10,
        description='Roll reported by the JaiaBot IMU.',
    ),
    PathDescriptor(
        name='Speed (over water)',
        path_suffix='BotStatus/speed/over_water',
        units='m/s',
        frequency=1,
        description='Speed through the water reported by the JaiaBot speed sensor.',
    ),
    PathDescriptor(
        name='Speed (over ground)',
        path_suffix='BotStatus/speed/over_ground',
        units='m/s',
        frequency=1,
        description='Speed over ground reported by the JaiaBot GPS receiver.',
    ),
    PathDescriptor(
        name='Control surfaces timeout',
        path_suffix='control_surfaces/timeout',
        units='sec',
        description='Command timeout for motor and actuators',
    ),
    PathDescriptor(
        name='Temperature',
        path_suffix='PressureTemperatureData/temperature',
        units='°C',
        frequency=10,
        description='Temperature reported by the JaiaBot pressure sensor.',
    ),
    PathDescriptor(
        name='Raw Pressure',
        path_suffix='PressureTemperatureData/pressure_raw',
        units='dbar',
        frequency=10,
        description='Uncompensated water pressure as reported directly from the sensor.'
    ),
    PathDescriptor(
        name='Adjusted Pressure',
        path_suffix='PressureAdjustedData/pressure_adjusted',
        units='dbar',
        frequency=10,
        description='Water pressure adjusted for atmospheric pressure.'
    ),
    PathDescriptor(
        name='Calculated Depth',
        path_suffix='PressureAdjustedData/calculated_depth',
        units='m',
        frequency=10,
        description='Calculated depth.'
    ),
    PathDescriptor(
        name='Conductivity',
        path_suffix='SalinityData/conductivity',
        units='μS/cm',
        frequency=10,
        description='Specific conductivity - conductivity adjusted to a 25 °C standard.'
    ),
    PathDescriptor(
        name='Conductivity',
        path_suffix='AtlasScientificOEMEC/conductivity',
        units='μS/cm',
        frequency=10,
        description='Specific conductivity - conductivity adjusted to a 25 °C standard.'
    ),
    PathDescriptor(
        name='Raw Conductivity',
        path_suffix='SalinityData/conductivity_raw',
        units='μS/cm',
        frequency=10,
        description='Raw conductivity as reported directly from the sensor.'
    ),
    PathDescriptor(
        name='Raw Conductivity',
        path_suffix='AtlasScientificOEMEC/conductivity_raw',
        units='μS/cm',
        frequency=10,
        description='Raw conductivity as reported directly from the sensor.'
    ),
    PathDescriptor(
        name='Salinity',
        path_suffix='SalinityData/salinity',
        units='ppt',
        frequency=10,
        description='Salinity adjusted for conductivity (μS/cm), temperature (°C), and pressure (dbar).'
    ),
    PathDescriptor(
        name='Salinity',
        path_suffix='AtlasScientificOEMEC/salinity',
        units='ppt',
        frequency=10,
        description='Salinity adjusted for conductivity (μS/cm), temperature (°C), and pressure (dbar).'
    ),
    PathDescriptor(
        name='Raw Salinity',
        path_suffix='SalinityData/salinity_raw',
        units='ppt',
        frequency=10,
        description='Raw salinity as reported directly from the sensor.'
    ),
    PathDescriptor(
        name='Raw Salinity',
        path_suffix='AtlasScientificOEMEC/salinity_raw',
        units='ppt',
        frequency=10,
        description='Raw salinity as reported directly from the sensor.'
    ),
    PathDescriptor(
        name='pH',
        path_suffix='AtlasScientificOEMpH/ph',
        units='pH',
        frequency=10,
        description='pH adjusted for temperature (°C).'
    ),
    PathDescriptor(
        name='Raw pH',
        path_suffix='AtlasScientificOEMpH/ph_raw',
        units='pH',
        frequency=10,
        description='Raw pH as reported directly from the sensor.'
    ),
    PathDescriptor(
        name='Temperature (pH Probe)',
        path_suffix='AtlasScientificOEMpH/temperature',
        units='°C',
        frequency=10,
        description='Temperature as reported by the pH probe.'
    ),
    PathDescriptor(
        name='Dissolved Oxygen Solubility',
        path_suffix='AtlasScientificOEMDO/do_solubility',
        units='mg/L',
        frequency=10,
        description='DO Solubility at current temperature (C), salinity (ppt), and pressure (mmhg).'
    ),
    PathDescriptor(
        name='Normalized Dissolved Oxygen Solubility',
        path_suffix='AtlasScientificOEMDO/do_normalized_solubility',
        units='mg/L',
        frequency=10,
        description='Dissolved Oxygen Solubility at 0 salinity (ppt), current temperature (C), and pressure (mmhg), scaled by observed saturation.'
    ),
    PathDescriptor(
        name='Raw Dissolved Oxygen',
        path_suffix='AtlasScientificOEMDO/do_raw',
        units='mg/L',
        frequency=10,
        description='Dissolved oxygen as reported directly from the sensor.'
    ),
    PathDescriptor(
        name='Dissolved Oxygen Saturation',
        path_suffix='AtlasScientificOEMDO/do_saturation_percent',
        units='%',
        frequency=10,
        description='Measured DO / DO Solubility at current temperature (C), salinity (ppt), and pressure (mmhg).'
    ),
    PathDescriptor(
        name='Temperature (Dissolved Oxygen)',
        path_suffix='AtlasScientificOEMDO/temperature',
        units='°C',
        frequency=10,
        description='Temperature as reported by the dissolved oxygen sensor.'
    ),
    # both fluorometers log the same message type, so the second one is matched on its group
    # name and must be listed before the suffix-matched entries below
    PathDescriptor(
        name='Fluorometer 2 Concentration',
        path_suffix=None,
        path_regex=r'.*jaiabot::fluorometer_2/.*TurnerCFluor/concentration$',
        units='See fluorometer spec. sheet.',
        frequency=10,
        description='Concentration as reported by the second fluorometer.'
    ),
    PathDescriptor(
        name='Fluorometer 2 Concentration Voltage',
        path_suffix=None,
        path_regex=r'.*jaiabot::fluorometer_2/.*TurnerCFluor/concentration_voltage$',
        units='V',
        frequency=10,
        description='Raw voltage reported by the second analog fluorometer sensor.'
    ),
    PathDescriptor(
        name='Fluorometer 2 Analyte',
        path_suffix=None,
        path_regex=r'.*jaiabot::fluorometer_2/.*TurnerCFluor/analyte$',
        units='',
        frequency=10,
        description='What the second fluorometer measures, from its configured coefficients.'
    ),
    PathDescriptor(
        name='Fluorometer 2 Serial Number',
        path_suffix=None,
        path_regex=r'.*jaiabot::fluorometer_2/.*TurnerCFluor/serial_number$',
        units='',
        frequency=10,
        description='Serial number of the second fluorometer probe, from its configured coefficients.'
    ),
    PathDescriptor(
        name='Fluorometer Concentration',
        path_suffix='TurnerCFluor/concentration',
        units='See fluorometer spec. sheet.',
        frequency=10,
        description='Concentration as reported by the fluorometer.'
    ),
    PathDescriptor(
        name='Fluorometer Concentration Voltage',
        path_suffix='TurnerCFluor/concentration_voltage',
        units='V',
        frequency=10,
        description='Raw voltage reported by the analog fluorometer sensor.'
    ), 
    PathDescriptor(
        name='Fluorometer Analyte',
        path_suffix='TurnerCFluor/analyte',
        units='',
        frequency=10,
        description='What the fluorometer measures, from its configured coefficients.'
    ),
    PathDescriptor(
        name='Fluorometer Serial Number',
        path_suffix='TurnerCFluor/serial_number',
        units='',
        frequency=10,
        description='Serial number of the fluorometer probe, from its configured coefficients.'
    ),
    PathDescriptor(
        name='Latitude',
        path_suffix='TimePositionVelocity/location/lat',
        units='°',
        frequency=5,
        description='Latitude reported by the JaiaBot GPS receiver.',
    ),
    PathDescriptor(
        name='Longitude',
        path_suffix='TimePositionVelocity/location/lon',
        units='°',
        frequency=5,
        description='Longitude reported by the JaiaBot GPS receiver.',
    ),
    PathDescriptor(
        name='Latitude (Node Status)',
        path_suffix='NodeStatus/global_fix/lat',
        units='°',
        frequency=5,
        description='A subset of GPS latitude points, filtering out points with low certainty.',
    ),
    PathDescriptor(
        name='Longitude (Node Status)',
        path_suffix='NodeStatus/global_fix/lon',
        units='°',
        frequency=5,
        description='A subset of GPS longitude points, filtering out points with low certainty.',
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


def get_by_path(path: str) -> PathDescriptor:
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
