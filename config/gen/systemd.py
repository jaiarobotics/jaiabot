#!/usr/bin/env python3

import argparse
from enum import Enum
import os
from string import Template
import shutil
import subprocess
from typing import Dict

# defaults based on $PATH settings
script_dir=os.path.dirname(os.path.realpath(__file__))

try:
    jaiabot_bin_dir_default=os.path.dirname(shutil.which('jaiabot_single_thread_pattern'))
except Exception as e:
    jaiabot_bin_dir_default='/usr/bin'

jaiabot_share_dir_default=os.path.realpath(jaiabot_bin_dir_default + '/../share')

try:
    goby_bin_dir_default=os.path.dirname(shutil.which('gobyd'))
except Exception as e:
    goby_bin_dir_default='/usr/bin'

try:
    moos_bin_dir_default=os.path.dirname(shutil.which('MOOSDB'))
except Exception as e:
    moos_bin_dir_default='/usr/bin'

    
gen_dir_default=script_dir    
ansible_dir_default=os.path.realpath(script_dir + '/../ansible')

parser = argparse.ArgumentParser(description='Generate systemd services for JaiaBot and JaiaHub', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
parser.add_argument('type', choices=['bot', 'hub'], help='Should we generate service files for a bot or a hub?')
parser.add_argument('--env_file', default='/etc/jaiabot/runtime.env', help='Location of the file to contain environmental variables loaded by systemd services (written by this script)')
parser.add_argument('--jaiabot_bin_dir', default=jaiabot_bin_dir_default, help='Directory of the JaiaBot binaries')
parser.add_argument('--jaiabot_share_dir', default=jaiabot_share_dir_default, help='Directory of the JaiaBot arch-independent files (share)')
parser.add_argument('--goby_bin_dir', default=goby_bin_dir_default, help='Directory of the Goby binaries')
parser.add_argument('--moos_bin_dir', default=moos_bin_dir_default, help='Directory of the MOOS binaries')
parser.add_argument('--gen_dir', default=gen_dir_default, help='Directory to the configuration generation scripts')
parser.add_argument('--ansible_dir', default=ansible_dir_default, help='Directory to the Ansible configuration')
parser.add_argument('--systemd_dir', default='/etc/systemd/system', help='Directory to write systemd services to')
parser.add_argument('--bot_index', default=0, type=int, help='Bot index')
parser.add_argument('--hub_index', default=0, type=int, help='Hub index')
parser.add_argument('--fleet_index', default=0, type=int, help='Fleet index')
parser.add_argument('--enable', action='store_true', help='If set, run systemctl enable on all services')
parser.add_argument('--disable', action='store_true', help='If set, run systemctl disable on all services')
parser.add_argument('--simulation', action='store_true', help='If set, configure services for simulation mode - NOT for real operations')
parser.add_argument('--warp', default=1, type=int, help='If --simulation, sets the warp speed to use (multiple of real clock). This value must match other bots/hubs')
parser.add_argument('--log_dir', default='/var/log/jaiabot', help='Directory to write log files to')
parser.add_argument('--goby_log_level', default='RELEASE', help='Log level for .goby files (default RELEASE)')
parser.add_argument('--led_type', choices=['hub_led', 'none'], help='If set, configure services for led type')
parser.add_argument('--user_role', choices=['user', 'advanced', 'developer'], help='Role for user in pre-launch UI')
parser.add_argument('--electronics_stack', choices=['0', '1', '2'], help='If set, configure services for electronics stack')
parser.add_argument('--imu_type', choices=['bno055', 'bno085', 'none'], help='If set, configure services for imu type')
parser.add_argument('--imu_install_type', choices=['embedded', 'retrofit', 'none'], help='If set, configure services for imu install type')
parser.add_argument('--arduino_type', choices=['spi', 'usb', 'none'], help='If set, configure services for arduino type')
parser.add_argument('--data_offload_ignore_type', choices=['goby', 'taskpacket', 'none'], help='If set, configure services for arduino type')

args=parser.parse_args()

class ARDUINO_TYPE(Enum):
    SPI = 'spi'
    USB = 'usb'
    NONE = 'none'

class IMU_TYPE(Enum):
    BNO055 = 'bno055'
    BNO085 = 'bno085'
    NONE = 'none'

class IMU_INSTALL_TYPE(Enum):
    EMBEDDED = 'embedded'
    RETROFIT = 'retrofit'
    NONE = 'none'

class LED_TYPE(Enum):
    HUB_LED = 'hub_led'
    NONE = 'none'

class GPS_TYPE(Enum):
    SPI = 'spi'
    I2C = 'i2c'
    NONE = 'none'

class ELECTRONICS_STACK(Enum):
    STACK_0 = '0'
    STACK_1 = '1'
    STACK_2 = '2'
    STACK_3 = '2'

class DATA_OFFLOAD_IGNORE_TYPE(Enum):
    GOBY = 'GOBY'
    TASKPACKET = 'TASKPACKET'
    NONE = 'NONE'

# Set the arduino type based on the argument
# Used to set the serial port device
if args.arduino_type == 'spi':
    jaia_arduino_type = ARDUINO_TYPE.SPI
elif args.arduino_type == 'usb':
    jaia_arduino_type = ARDUINO_TYPE.USB
else:
    jaia_arduino_type = ARDUINO_TYPE.NONE

if args.imu_type == 'bno055':
    jaia_imu_type = IMU_TYPE.BNO055
elif args.imu_type == 'bno085':
    jaia_imu_type = IMU_TYPE.BNO085
else:
    jaia_imu_type = IMU_TYPE.NONE


jaia_imu_install_type = IMU_TYPE.NONE

if args.imu_install_type == 'embedded':
    jaia_imu_install_type = IMU_INSTALL_TYPE.EMBEDDED
elif args.imu_install_type == 'retrofit':
    jaia_imu_install_type = IMU_INSTALL_TYPE.RETROFIT

if args.led_type == 'hub_led':
    jaia_led_type = LED_TYPE.HUB_LED
elif args.led_type == 'none':
    jaia_led_type = LED_TYPE.NONE    
else:
    jaia_led_type = LED_TYPE.NONE

if args.electronics_stack == '0':
    jaia_electronics_stack = ELECTRONICS_STACK.STACK_0
    jaia_gps_type = GPS_TYPE.I2C
elif args.electronics_stack == '1':
    jaia_electronics_stack = ELECTRONICS_STACK.STACK_1
    jaia_gps_type = GPS_TYPE.SPI
elif args.electronics_stack == '2':
    jaia_electronics_stack = ELECTRONICS_STACK.STACK_2
    jaia_gps_type = GPS_TYPE.SPI
else:
    jaia_electronics_stack = ELECTRONICS_STACK.STACK_0
    jaia_gps_type = GPS_TYPE.I2C


jaia_data_offload_ignore_type = DATA_OFFLOAD_IGNORE_TYPE.NONE

if args.data_offload_ignore_type == 'goby':
    jaia_data_offload_ignore_type = DATA_OFFLOAD_IGNORE_TYPE.GOBY
elif args.data_offload_ignore_type == 'taskpacket':
    jaia_data_offload_ignore_type = DATA_OFFLOAD_IGNORE_TYPE.TASKPACKET

# make the output directories, if they don't exist
os.makedirs(os.path.dirname(args.env_file), exist_ok=True)

class Mode(Enum):
    SIMULATION = 'simulation'
    RUNTIME = 'runtime'
    BOTH = 'both'
    
if args.simulation:
    jaia_mode = Mode.SIMULATION
    warp = args.warp
else:
    jaia_mode =  Mode.RUNTIME
    warp = 1

class Type(Enum):
    BOT = 'bot'
    HUB = 'hub'
    BOTH = 'both'

if args.type == 'bot':
    jaia_type = Type.BOT
    bot_or_hub_index_str = 'export jaia_bot_index=' + str(args.bot_index) + '; '
elif args.type == 'hub':
    jaia_type = Type.HUB
    bot_or_hub_index_str = 'export jaia_hub_index=' + str(args.hub_index) + '; '

# generate env file from preseed.goby
print('Writing ' + args.env_file + ' from preseed.goby')

subprocess.run('bash -ic "' +
               'export jaia_mode=' + jaia_mode.value + '; ' +
               bot_or_hub_index_str + 
               'export jaia_fleet_index=' + str(args.fleet_index) + '; ' + 
               'export jaia_warp=' + str(warp) + '; ' +
               'export jaia_log_dir=' + str(args.log_dir) + '; ' +
               f'export jaia_goby_log_level={args.goby_log_level}; ' +
               f'export jaia_user_role={args.user_role}; ' +
               'export jaia_electronics_stack=' + str(jaia_electronics_stack.value) + '; ' +
               'export jaia_imu_type=' + str(jaia_imu_type.value) + '; ' +
               'export jaia_imu_install_type=' + str(jaia_imu_install_type.value) + '; ' +
               'export jaia_arduino_type=' + str(jaia_arduino_type.value) + '; ' +
               'export jaia_data_offload_ignore_type=' + str(jaia_data_offload_ignore_type.value) + '; ' +
               'source ' + args.gen_dir + '/../preseed.goby; env | egrep \'^jaia|^LD_LIBRARY_PATH\' > /tmp/runtime.env; cp --backup=numbered /tmp/runtime.env ' + args.env_file + '; rm /tmp/runtime.env"',
               check=True, shell=True)

common_macros=dict()

common_macros['env_file'] = args.env_file
common_macros['jaiabot_bin_dir'] = args.jaiabot_bin_dir
common_macros['jaiabot_share_dir'] = args.jaiabot_share_dir
common_macros['ansible_dir'] = args.ansible_dir
common_macros['goby_bin_dir'] = args.goby_bin_dir
common_macros['moos_bin_dir'] = args.moos_bin_dir
common_macros['extra_service'] = ''
common_macros['extra_unit'] = ''
common_macros['extra_flags'] = ''
common_macros['bhv_file'] = '/tmp/jaiabot_${jaia_bot_index}.bhv'
common_macros['moos_file'] = '/tmp/jaiabot_${jaia_bot_index}.moos'
common_macros['moos_sim_file'] = '/tmp/jaiabot_sim_${jaia_bot_index}.moos'
# unless otherwise specified, apps are run both at runtime and simulation
common_macros['runs_when'] = Mode.BOTH

try:
    common_macros['user'] = os.getlogin()
    common_macros['group'] = os.getlogin()
except:
    common_macros['user'] = os.environ['USER']
    common_macros['group'] = os.environ['USER']

if jaia_type == Type.BOT:
    common_macros['gen'] = args.gen_dir + '/bot.py'
elif jaia_type == Type.HUB:
    common_macros['gen'] = args.gen_dir + '/hub.py'
    
    
all_goby_apps = []

jaiabot_apps = [
    {'exe': 'jaiabot',
     'template': 'jaiabot.service.in',
     'runs_on': Type.BOTH },
    {'exe': 'gobyd',
     'description': 'Goby Daemon',
     'template': 'gobyd.service.in',
     'error_on_fail': 'ERROR__FAILED__GOBYD',
     'runs_on': Type.BOTH },
    {'exe': 'goby_intervehicle_portal',
     'description': 'Goby Intervehicle Portal',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__GOBY_INTERVEHICLE_PORTAL',
     'extra_service': 'Environment=GOBY_MODEMDRIVER_PLUGINS=libjaiabot_xbee.so.1',
     'runs_on': Type.BOTH,
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'goby_liaison',
     'description': 'Goby Liaison GUI for JaiaBot',
     'template': 'goby-app.service.in',
     'extra_service': 'Environment=GOBY_LIAISON_PLUGINS=libjaiabot_liaison.so.1',
     'error_on_fail': 'ERROR__FAILED__GOBY_LIAISON',
     'runs_on': Type.BOTH,
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'goby_gps',
     'description': 'Goby GPS Driver',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__GOBY_GPS',
     'runs_on': Type.BOTH,
     'extra_unit': 'BindsTo=gpsd.service\nAfter=gpsd.service',
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'goby_logger',
     'description': 'Goby Logger',
     'template': 'logger-app.service.in',
     'error_on_fail': 'ERROR__FAILED__GOBY_LOGGER',
     'runs_on': Type.BOTH,
     'extra_unit': 'BindsTo=var-log.mount\nAfter=var-log.mount',
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'goby_coroner',
     'description': 'Goby Coroner',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__GOBY_CORONER',
     'runs_on': Type.BOTH,
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'jaiabot_health',
     'description': 'JaiaBot Health Reporting and Management',
     'template': 'health-app.service.in', # no failure_reporter start/stop since it would be meaningless
     'user': 'root', # must run as root to allow restart/reboot
     'group': 'root',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_HEALTH',
     'runs_on': Type.BOTH},
    {'exe': 'jaiabot_metadata',
     'description': 'JaiaBot Metadata Manager',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_METADATA',
     'runs_on': Type.BOTH,
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'jaiabot_hub_manager',
     'description': 'JaiaBot Hub Manager',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_HUB_MANAGER',
     'runs_on': Type.HUB,
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'jaiabot_web_portal',
     'description': 'JaiaBot Web GUI Portal',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_WEB_PORTAL',
     'runs_on': Type.HUB,
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'jaiabot_fusion',
     'description': 'JaiaBot Data Fusion',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_FUSION',
     'runs_on': Type.BOT,
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'goby_liaison_standalone',
     'description': 'Goby Liaison PreLaunch GUI for JaiaBot',
     'template': 'liaison-prelaunch.service.in',
     'extra_service': 'Environment=GOBY_LIAISON_PLUGINS=libjaiabot_liaison_prelaunch.so.1',
     'runs_on': Type.HUB},
    {'exe': 'jaiabot_simulator',
     'description': 'JaiaBot Simulator',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_SIMULATOR',
     'runs_on': Type.BOT,
     'runs_when': Mode.SIMULATION,
     'wanted_by': 'jaiabot_health.service'},       
    {'exe': 'goby_moos_gateway',
     'description': 'Goby to MOOS Gateway',
     'template': 'goby-app.service.in',
     'runs_on': Type.BOT,
     'error_on_fail': 'ERROR__FAILED__GOBY_MOOS_GATEWAY',
     'extra_service': 'Environment=GOBY_MOOS_GATEWAY_PLUGINS=libgoby_ivp_frontseat_moos_gateway_plugin.so.30:libjaiabot_moos_gateway_plugin.so.1',
     'extra_unit': 'BindsTo=jaiabot_moosdb.service\nAfter=jaiabot_moosdb.service',
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'jaiabot_mission_manager',
     'description': 'JaiaBot Mission Manager',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_MISSION_MANAGER',
     'runs_on': Type.BOT,
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'jaiabot_pid_control',
     'description': 'JaiaBot PID Controller',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_PID_CONTROL',
     'runs_on': Type.BOT,
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'jaiabot_bluerobotics_pressure_sensor_driver',
     'description': 'JaiaBot Blue Robotics Pressure Sensor Driver',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_BLUEROBOTICS_PRESSURE_SENSOR_DRIVER',
     'runs_on': Type.BOT,
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'jaiabot_atlas_scientific_ezo_ec_driver',
     'description': 'JaiaBot Atlas Scientific Salinity Sensor Driver',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_ATLAS_SCIENTIFIC_EZO_EC_DRIVER',
     'runs_on': Type.BOT,
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'jaiabot_driver_arduino',
     'description': 'JaiaBot Driver Arduino',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_DRIVER_ARDUINO',
     'runs_on': Type.BOT,
     'runs_when': Mode.RUNTIME,
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'jaiabot_engineering',
     'description': 'JaiaBot Engineering Support',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_ENGINEERING',
     'runs_on': Type.BOT,
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'jaiabot_pressure_sensor.py',
     'description': 'JaiaBot Pressure Sensor Python Driver',
     'template': 'py-app.service.in',
     'subdir': 'pressure_sensor',
     'args': '',
     'error_on_fail': 'ERROR__FAILED__PYTHON_JAIABOT_PRESSURE_SENSOR',
     'runs_on': Type.BOT,
     'runs_when': Mode.RUNTIME,
     'wanted_by': 'jaiabot_health.service',
     'restart': 'on-failure'},
    {'exe': 'jaiabot_as-ezo-ec.py',
     'description': 'JaiaBot Salinity Sensor Python Driver',
     'template': 'py-app.service.in',
     'subdir': 'atlas_scientific_ezo_ec',
     'args': '20002',
     'error_on_fail': 'ERROR__FAILED__PYTHON_JAIABOT_AS_EZO_EC',
     'runs_on': Type.BOT,
     'runs_when': Mode.RUNTIME,
     'wanted_by': 'jaiabot_health.service',
     'restart': 'on-failure'},
    {'exe': 'MOOSDB',
     'description': 'MOOSDB Broker',
     'template': 'moosdb.service.in',
     'error_on_fail': 'ERROR__FAILED__MOOS_MOOSDB',
     'runs_on': Type.BOT},
    {'exe': 'pHelmIvP',
     'description': 'pHelmIvP Autonomy Engine',
     'template': 'moos-app.service.in',
     'error_on_fail': 'ERROR__FAILED__MOOS_PHELMIVP',
     'runs_on': Type.BOT},    
    {'exe': 'uProcessWatch',
     'description': 'uProcessWatch MOOS Health monitor',
     'template': 'moos-app.service.in',
     'error_on_fail': 'ERROR__FAILED__MOOS_UPROCESSWATCH',
     'runs_on': Type.BOT},    
    {'exe': 'pNodeReporter',
     'description': 'pNodeReporter MOOS data aggregator',
     'template': 'moos-app.service.in',
     'error_on_fail': 'ERROR__FAILED__MOOS_PNODEREPORTER',
     'runs_on': Type.BOT},
    {'exe': 'MOOSDB',
     'description': 'MOOSDB Simulation Broker',
     'template': 'moosdb-sim.service.in',
     'error_on_fail': 'ERROR__FAILED__MOOS_SIM_MOOSDB',
     'runs_on': Type.BOT,
     'runs_when': Mode.SIMULATION,
     'service': 'jaiabot_moosdb_sim' # override default service name to avoid conflict with jaiabot_moosdb
    },
    {'exe': 'uSimMarine',
     'description': 'uSimMarine marine vehicle simulator',
     'template': 'moos-app-sim.service.in',
     'error_on_fail': 'ERROR__FAILED__MOOS_SIM_USIMMARINE',
     'runs_on': Type.BOT,
     'runs_when': Mode.SIMULATION},
    {'exe': 'jaiabot_data_vision',
     'description': 'jaiabot_data_vision visualize log data',
     'template': 'jaiabot_data_vision.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_DATA_VISION',
     'runs_on': Type.HUB},
    {'exe': 'gpsd',
     'description': 'GPSD for simulator only',
     'template': 'gpsd-sim.service.in',
     'runs_on': Type.BOT,
     'runs_when': Mode.SIMULATION},
]

if jaia_imu_type.value == 'bno085':
    jaiabot_apps_imu = [
        {'exe': 'jaiabot_adafruit_BNO085_driver',
        'description': 'JaiaBot BNO085 IMU Sensor Driver',
        'template': 'goby-app.service.in',
        'error_on_fail': 'ERROR__FAILED__JAIABOT_ADAFRUIT_BNO085_DRIVER',
        'runs_on': Type.BOT,
        'wanted_by': 'jaiabot_health.service'},
        {'exe': 'jaiabot_imu.py',
        'description': 'JaiaBot BNO085 IMU Python Driver',
        'template': 'py-app.service.in',
        'subdir': 'adafruit_BNO085',
        'args': '20000',
        'error_on_fail': 'ERROR__FAILED__PYTHON_JAIABOT_IMU',
        'runs_on': Type.BOT,
        'runs_when': Mode.RUNTIME,
        'wanted_by': 'jaiabot_health.service',
        'restart': 'on-failure'},
    ] 
    jaiabot_apps.extend(jaiabot_apps_imu)
else:
    jaiabot_apps_imu = [
        {'exe': 'jaiabot_adafruit_BNO055_driver',
        'description': 'JaiaBot BNO055 IMU Sensor Driver',
        'template': 'goby-app.service.in',
        'error_on_fail': 'ERROR__FAILED__JAIABOT_ADAFRUIT_BNO055_DRIVER',
        'runs_on': Type.BOT,
        'wanted_by': 'jaiabot_health.service'},
        {'exe': 'jaiabot_imu.py',
        'description': 'JaiaBot BNO055 IMU Python Driver',
        'template': 'py-app.service.in',
        'subdir': 'adafruit_BNO055',
        'args': '20000',
        'error_on_fail': 'ERROR__FAILED__PYTHON_JAIABOT_IMU',
        'runs_on': Type.BOT,
        'runs_when': Mode.RUNTIME,
        'wanted_by': 'jaiabot_health.service',
        'restart': 'on-failure'},
    ]
    jaiabot_apps.extend(jaiabot_apps_imu)

jaia_firmware = [
    {'exe': 'hub-button-led-poweroff.py',
     'description': 'Hub Button LED Poweroff Mode',
     'template': 'hub-button-led-poweroff.service.in',
     'subdir': 'led_button',
     'args': '--electronics_stack=' + jaia_electronics_stack.value,
     'runs_on': Type.HUB,
     'runs_when': Mode.RUNTIME,
     'led_type': LED_TYPE.HUB_LED},
    {'exe': 'hub-button-led-services-running.py',
     'description': 'Hub Button LED Services Running Mode',
     'template': 'hub-button-led-services-running.service.in',
     'subdir': 'led_button',
     'args': '--electronics_stack=' + jaia_electronics_stack.value,
     'runs_on': Type.HUB,
     'runs_when': Mode.RUNTIME,
     'led_type': LED_TYPE.HUB_LED},
    {'exe': 'hub-button-trigger.py',
     'description': 'Hub Button LED Triggers',
     'template': 'hub-button-trigger.service.in',
     'subdir': 'led_button',
     'args': '--electronics_stack=' + jaia_electronics_stack.value,
     'runs_on': Type.HUB,
     'runs_when': Mode.RUNTIME,
     'led_type': LED_TYPE.HUB_LED},
    {'exe': 'gps-spi-pty.py',
     'description': 'Create a pty, and send all the spi gps data to it',
     'template': 'gps_spi_pty.service.in',
     'subdir': 'gps',
     'args': '',
     'runs_on': Type.BOTH,
     'runs_when': Mode.RUNTIME,
     'gps_type': GPS_TYPE.SPI},
    {'exe': 'gps-i2c-pty.py',
     'description': 'Create a pty, and send all the i2c gps data to it',
     'template': 'gps_i2c_pty.service.in',
     'subdir': 'gps',
     'args': '',
     'runs_on': Type.BOTH,
     'runs_when': Mode.RUNTIME,
     'gps_type': GPS_TYPE.I2C},
     {'exe': 'arduino_spi_gpio_pin.py',
     'description': 'Hub Button LED Poweroff Mode',
     'template': 'arduino-spi-gpio-pin.service.in',
     'subdir': 'arduino',
     'args': '--electronics_stack=' + jaia_electronics_stack.value,
     'runs_on': Type.BOT,
     'runs_when': Mode.RUNTIME},
     {'exe': 'jaia_firm_backup_date.sh',
     'description': 'Backup the date to a file when we have a valid date time ntp',
     'template': 'backup-date.service.in',
     'args': '',
     'runs_on': Type.BOTH,
     'runs_when': Mode.RUNTIME},
     {'exe': 'jaia_firm_bno085_reset_gpio_pin.py',
     'description': 'BNO085 script to reboot imu',
     'template': 'bno085-reset-gpio-pin.service.in',
     'subdir': 'adafruit_BNO085',
     'args': '--imu_install_type=' + jaia_imu_install_type.value,
     'runs_on': Type.BOT,
     'runs_when': Mode.RUNTIME,
     'imu_type': IMU_TYPE.BNO085,
     'run_at_boot': False}
]

# check if the app is run on this type (bot/hub) and at this time (runtime/simulation)
def is_app_run(app):
    macros={**common_macros, **app}
    return (macros['runs_on'] == Type.BOTH or macros['runs_on'] == jaia_type) and (macros['runs_when'] == Mode.BOTH or macros['runs_when'] == jaia_mode)

for app in jaiabot_apps:
    if is_app_run(app):
        # goby_intervehicle_portal does not respond to goby_coroner. When this is fixed, remove the exception: https://github.com/GobySoft/goby3/issues/297
        if app['template'] == 'goby-app.service.in' and app['exe'] != 'goby_intervehicle_portal':
            all_goby_apps.append(app['exe'])

        
for app in jaiabot_apps:
    if is_app_run(app):
        macros={**common_macros, **app}
        
        # generate service name from lowercase exe name, substituting . for _, and
        # adding jaiabot to the front if it doesn't already start with that
        if 'service' in macros:
            service = macros['service']
        else:
            service = app['exe'].replace('.', '_').lower()
            if macros['exe'][0:7] != 'jaiabot':
                service = 'jaiabot_' + service

        # special case for goby_coroner - need a list of everything we're running
        if app['exe'] == 'goby_coroner':
            macros['extra_flags'] = '--expected_name ' + ' --expected_name '.join(all_goby_apps)
            
        if not 'bin_dir' in macros:
            if macros['exe'][0:4] == 'goby':
                macros['bin_dir'] = macros['goby_bin_dir']
            else:
                macros['bin_dir'] = macros['jaiabot_bin_dir']

        macros['service'] = service
                
        with open(script_dir + '/../templates/systemd/' + app['template'], 'r') as file:        
            out=Template(file.read()).substitute(macros)    
        outfilename = args.systemd_dir + '/' + service + '.service'
        print('Writing ' + outfilename)
        outfile = open(outfilename, 'w')
        outfile.write(out)
        outfile.close()
        if args.enable:
            print('Enabling ' + service)
            subprocess.run('systemctl enable ' + service, check=True, shell=True)
        if args.disable:
            print('Disabling ' + service)
            subprocess.run('systemctl disable ' + service, check=True, shell=True)

# check if the firmware is run on this type (bot/hub), at this time (runtime/simulation), and if the system has the capability
def is_firm_run(firm):
    macros={**common_macros, **firm}

    if (macros['runs_on'] != Type.BOTH and macros['runs_on'] != jaia_type):
        return False
    
    if (macros['runs_when'] != Mode.BOTH and macros['runs_when'] != jaia_mode):
        return False
    
    if ('led_type' in macros):
        if (macros['led_type'] != jaia_led_type):
            return False
        
    if ('gps_type' in macros):
        if (macros['gps_type'] != jaia_gps_type):
            return False
        
    if ('imu_type' in macros):
        if (macros['imu_type'] != jaia_imu_type):
            return False

    return True

for firmware in jaia_firmware:
    if is_firm_run(firmware):
        macros={**common_macros, **firmware}

        # generate service name from lowercase exe name, substituting . for _, and
        # adding jaiabot to the front if it doesn't already start with that
        if 'service' in macros:
            service = macros['service']
        else:
            service = firmware['exe'].replace('.', '_').lower()
            if macros['exe'][0:9] != 'jaia_firm':
                service = 'jaia_firm_' + service
            
        if not 'bin_dir' in macros:
            if macros['exe'][0:4] == 'goby':
                macros['bin_dir'] = macros['goby_bin_dir']
            else:
                macros['bin_dir'] = macros['jaiabot_bin_dir']

        macros['service'] = service
                
        with open(script_dir + '/../templates/systemd/' + firmware['template'], 'r') as file:        
            out=Template(file.read()).substitute(macros)    
        outfilename = args.systemd_dir + '/' + service + '.service'
        print('Writing ' + outfilename)
        outfile = open(outfilename, 'w')
        outfile.write(out)
        outfile.close()

        # Check to see if we should enable the service to run at boot
        # If not then we should not try to enable or disable the service
        if (not 'run_at_boot' in macros or macros['run_at_boot'] != False):
            if args.enable:
                print('Enabling ' + service)
                subprocess.run('systemctl enable ' + service, check=True, shell=True)
            if args.disable:
                print('Disabling ' + service)
                subprocess.run('systemctl disable ' + service, check=True, shell=True)
        
        
if args.enable or args.disable:
    subprocess.run('systemctl daemon-reload', check=True, shell=True)
