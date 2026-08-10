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
parser.add_argument('--bot_id', default=0, type=int, help='Bot ID')
parser.add_argument('--hub_id', default=0, type=int, help='Hub ID')
parser.add_argument('--fleet_id', default=0, type=int, help='Fleet ID')
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
parser.add_argument('--pam_connection_type', choices=['uart', 'usb', 'none'], help='If set, configure services for PAM connection type')
parser.add_argument('--bot_type', choices=['hydro', 'pam', 'bio', 'none'], help='If set, configure services for bot type')
parser.add_argument('--data_offload_ignore_type', choices=['goby', 'taskpacket', 'none'], help='If set, configure services for arduino type')
parser.add_argument('--motor_harness_type', choices=['rpm_and_thermistor', 'none'], help='If set, configure services for motor harness type')
parser.add_argument('--temperature_sensor_type', choices=['bar02', 'bar30', 'tsys01', 'none'], help='If set, configure services for temperature sensor')
parser.add_argument('--pressure_sensor_type', choices=['bar02', 'bar30', 'none'], help='If set, configure services for pressure sensor')
parser.add_argument('--rf_encryption_password', default ='', help='Encryption key for XBee radio: 128-bit value (up to 16 bytes) as hex')
parser.add_argument('--comms_links', choices=['xbee', 'wifi', 'iridium'], nargs="+", default=['xbee'], help='Select one or more comms_links')
parser.add_argument('--camera_positions', choices=['aft', 'fore', 'outward', 'none'], nargs="+", default=['none'], help='Select one or more camera_positions')
parser.add_argument('--dccl_encryption_password', default ='', help='Encryption passphrase for DCCL (intervehicle) messages: can be any string')
parser.add_argument('--additional_sensors', choices=['turner_c_flour', 'aml', 'ppk', 'none'], nargs="+", default=['none'], help='Select one or more additional sensors')

args=parser.parse_args()

class ARDUINO_TYPE(Enum):
    SPI = 'spi'
    USB = 'usb'
    NONE = 'none'

class PAM_CONNECTION_TYPE(Enum):
    UART = 'uart'
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

class BOT_TYPE(Enum):
    HYDRO = 'HYDRO'
    PAM = 'PAM'
    BIO = 'BIO'
    NONE = 'NONE'

class DATA_OFFLOAD_IGNORE_TYPE(Enum):
    GOBY = 'GOBY'
    TASKPACKET = 'TASKPACKET'
    NONE = 'NONE'

class MOTOR_HARNESS_TYPE(Enum):
    RPM_AND_THERMISTOR = 'RPM_AND_THERMISTOR'
    NONE = 'NONE'

class TEMPERATURE_SENSOR_TYPE(Enum):
    BAR02 = 'bar02'
    BAR30 = 'bar30'
    TSYS01 = 'tsys01'
    NONE = 'none'

class PRESSURE_SENSOR_TYPE(Enum):
    BAR02 = 'bar02'
    BAR30 = 'bar30'
    NONE = 'none'

# Set the arduino type based on the argument
# Used to set the serial port device
if args.arduino_type == 'spi':
    jaia_arduino_type = ARDUINO_TYPE.SPI
elif args.arduino_type == 'usb':
    jaia_arduino_type = ARDUINO_TYPE.USB
else:
    jaia_arduino_type = ARDUINO_TYPE.NONE

if args.pam_connection_type == 'uart':
    jaia_pam_connection_type = PAM_CONNECTION_TYPE.UART
elif args.pam_connection_type == 'usb':
    jaia_pam_connection_type = PAM_CONNECTION_TYPE.USB
else:
    jaia_pam_connection_type = PAM_CONNECTION_TYPE.NONE

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

if args.bot_type == 'hydro':
    jaia_bot_type = BOT_TYPE.HYDRO
elif args.bot_type == 'pam':
    jaia_bot_type = BOT_TYPE.PAM
elif args.bot_type == 'bio':
    jaia_bot_type = BOT_TYPE.BIO
else:
    jaia_bot_type = BOT_TYPE.NONE

jaia_data_offload_ignore_type = DATA_OFFLOAD_IGNORE_TYPE.NONE

if args.data_offload_ignore_type == 'goby':
    jaia_data_offload_ignore_type = DATA_OFFLOAD_IGNORE_TYPE.GOBY
elif args.data_offload_ignore_type == 'taskpacket':
    jaia_data_offload_ignore_type = DATA_OFFLOAD_IGNORE_TYPE.TASKPACKET

jaia_motor_harness_type = MOTOR_HARNESS_TYPE.NONE

if args.motor_harness_type == 'rpm_and_thermistor':
    jaia_motor_harness_type = MOTOR_HARNESS_TYPE.RPM_AND_THERMISTOR

if args.temperature_sensor_type == 'bar02':
    jaia_temperature_sensor_type = TEMPERATURE_SENSOR_TYPE.BAR02
elif args.temperature_sensor_type == 'bar30':
    jaia_temperature_sensor_type = TEMPERATURE_SENSOR_TYPE.BAR30
elif args.temperature_sensor_type == 'tsys01':
    jaia_temperature_sensor_type = TEMPERATURE_SENSOR_TYPE.TSYS01
else:
    jaia_temperature_sensor_type = TEMPERATURE_SENSOR_TYPE.NONE

if args.pressure_sensor_type == 'bar02':
    jaia_pressure_sensor_type = PRESSURE_SENSOR_TYPE.BAR02
else:
    jaia_pressure_sensor_type = PRESSURE_SENSOR_TYPE.BAR30

UDP_GATEWAY_PORT = 20000

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

is_cloudhub=False

if args.type == 'bot':
    jaia_type = Type.BOT
    bot_or_hub_id_str = 'export jaia_bot_id=' + str(args.bot_id) + '; '
elif args.type == 'hub':
    cloudhub_id=30
    if args.hub_id == cloudhub_id:
        is_cloudhub=True        
    jaia_type = Type.HUB
    bot_or_hub_id_str = 'export jaia_hub_id=' + str(args.hub_id) + '; '

if is_cloudhub:
    # CloudHub is always built as the PRIMARY (full-featured) type, regardless of
    # the comms links in use, since Hub2Hub allows CloudHub to get data even
    # without any direct link such as Iridium.
    cloudhub_unsupported_links = ['xbee', 'wifi']
    comms_links_in_use = [ l for l in args.comms_links if l not in cloudhub_unsupported_links]
else:
    comms_links_in_use = args.comms_links

camera_positions_in_use = args.camera_positions
jaia_additional_sensors = args.additional_sensors
    
# generate env file from preseed.goby
print('Writing ' + args.env_file + ' from preseed.goby')

subprocess.run('bash -ic "' +
               'export jaia_mode=' + jaia_mode.value + '; ' +
               bot_or_hub_id_str + 
               'export jaia_fleet_id=' + str(args.fleet_id) + '; ' + 
               'export jaia_warp=' + str(warp) + '; ' +
               'export jaia_log_dir=' + str(args.log_dir) + '; ' +
               f'export jaia_goby_log_level={args.goby_log_level}; ' +
               f'export jaia_user_role={args.user_role}; ' +
               'export jaia_electronics_stack=' + str(jaia_electronics_stack.value) + '; ' +
               'export jaia_imu_type=' + str(jaia_imu_type.value) + '; ' +
               'export jaia_imu_install_type=' + str(jaia_imu_install_type.value) + '; ' +
               'export jaia_arduino_type=' + str(jaia_arduino_type.value) + '; ' +
               'export jaia_pam_connection_type=' + str(jaia_pam_connection_type.value) + '; ' +
               'export jaia_bot_type=' + str(jaia_bot_type.value) + '; ' +
               'export jaia_data_offload_ignore_type=' + str(jaia_data_offload_ignore_type.value) + '; ' +
               'export jaia_motor_harness_type=' + str(jaia_motor_harness_type.value) + '; ' +
               'export jaia_temperature_sensor_type=' + str(jaia_temperature_sensor_type.value) + '; ' +
               'export jaia_pressure_sensor_type=' + str(jaia_pressure_sensor_type.value) + '; ' +
               f'export jaia_rf_encryption_password={args.rf_encryption_password}; ' +
               'export jaia_comms_mode=' + ','.join(link for link in comms_links_in_use) + '; ' +
               'export jaia_camera_positions=' + ','.join(position for position in camera_positions_in_use) + '; ' +
               f'export jaia_dccl_encryption_password={args.dccl_encryption_password}; ' +
               'export jaia_additional_sensors=' + ','.join(position for position in jaia_additional_sensors) + '; ' +
               'source ' + args.gen_dir + '/../preseed.goby; env | egrep \'^jaia|^LD_LIBRARY_PATH\' > /tmp/runtime.env; cp --backup=numbered /tmp/runtime.env ' + args.env_file + '; rm /tmp/runtime.env"',
               check=True, shell=True)

common_macros=dict()

common_macros['env_file'] = args.env_file
common_macros['jaiabot_bin_dir'] = args.jaiabot_bin_dir
common_macros['jaiabot_share_dir'] = args.jaiabot_share_dir
common_macros['ansible_dir'] = args.ansible_dir
common_macros['goby_bin_dir'] = args.goby_bin_dir
common_macros['moos_bin_dir'] = args.moos_bin_dir
common_macros['exec_start_pre'] = ''
common_macros['extra_service'] = ''
common_macros['extra_unit'] = ''
common_macros['extra_flags'] = ''
common_macros['bhv_file'] = '/tmp/jaiabot_${jaia_bot_id}.bhv'
common_macros['moos_file'] = '/tmp/jaiabot_${jaia_bot_id}.moos'
common_macros['moos_sim_file'] = '/tmp/jaiabot_sim_${jaia_bot_id}.moos'
# unless otherwise specified, apps are run both at runtime and simulation
common_macros['runs_when'] = Mode.BOTH
# unless otherwise specified, apps run on CloudHub
common_macros['runs_on_cloudhub'] = True

try:
    common_macros['user'] = os.getlogin()
    common_macros['group'] = os.getlogin()
except:
    common_macros['user'] = os.environ['USER']
    common_macros['group'] = os.environ['USER']

# if user/group resolve to root, hardcode them to 'jaia' to avoid privileged execution
# this can happen in some upgrade scenarios
# TODO: Debug why this happens and when (Ansible playbook on local?)
if common_macros['user'] == 'root':
    common_macros['user'] = 'jaia'
    common_macros['group'] = 'jaia'
    
if jaia_type == Type.BOT:
    common_macros['gen'] = args.gen_dir + '/bot.py'
elif jaia_type == Type.HUB:
    common_macros['gen'] = args.gen_dir + '/hub.py'


# most firmware does not run on Cloudhubs at all
firmware_common_macros = common_macros.copy()
firmware_common_macros['runs_on_cloudhub'] = False
    
    
all_goby_apps = []

jaiabot_apps = [

    ## HUB AND BOT Services ##

    {'exe': 'jaiabot',
     'template': 'jaiabot.service.in',
     'runs_on': [Type.BOTH]},
    {'exe': 'gobyd',
     'description': 'Goby Daemon',
     'template': 'gobyd.service.in',
     'error_on_fail': 'ERROR__FAILED__GOBYD',
     'runs_on': [Type.BOTH]},
    {'exe': 'goby_intervehicle_portal',
     'description': 'Goby Intervehicle Portal',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__GOBY_INTERVEHICLE_PORTAL',
     'extra_service': 'Environment=GOBY_MODEMDRIVER_PLUGINS=libjaiabot_xbee.so.1:libjaiabot_wifi.so.1',
     'runs_on': [Type.BOTH],
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'goby_liaison',
     'description': 'Goby Liaison GUI for JaiaBot',
     'template': 'goby-app.service.in',
     'extra_service': 'Environment=GOBY_LIAISON_PLUGINS=libjaiabot_liaison.so.1',
     'error_on_fail': 'ERROR__FAILED__GOBY_LIAISON',
     'runs_on': [Type.BOTH],
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'goby_gps',
     'description': 'Goby GPS Driver',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__GOBY_GPS',
     'runs_on': [Type.BOTH],
     'extra_unit': 'BindsTo=gpsd.service\nAfter=gpsd.service',
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'goby_logger',
     'description': 'Goby Logger',
     'template': 'logger-app.service.in',
     'error_on_fail': 'ERROR__FAILED__GOBY_LOGGER',
     'runs_on': [Type.BOTH],
     'extra_unit': 'BindsTo=var-log.mount\nAfter=var-log.mount',
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'goby_coroner',
     'description': 'Goby Coroner',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__GOBY_CORONER',
     'runs_on': [Type.BOTH],
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'jaiabot_health',
     'description': 'JaiaBot Health Reporting and Management',
     'template': 'health-app.service.in', # no failure_reporter start/stop since it would be meaningless
     'user': 'root', # must run as root to allow restart/reboot
     'group': 'root',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_HEALTH',
     'runs_on': [Type.BOTH]},
    {'exe': 'jaiabot_metadata',
     'description': 'JaiaBot Metadata Manager',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_METADATA',
     'runs_on': [Type.BOTH],
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'update_ufw_rules',
     'description': 'Jaia Firewall/Wifi Updater',
     'template': 'wifi_ufw_update.service.in',
     'runs_on': [Type.BOTH],
     'runs_when': Mode.RUNTIME},
    {'exe': 'jaiabot_comms_manager',
     'description': 'JaiaBot Comms Manager',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_COMMS_MANAGER',
     'runs_on': [Type.BOTH],
     'wanted_by': 'jaiabot_health.service'},

    ## HUB Services ##
    
    {'exe': 'jaiabot_hub_manager',
     'description': 'JaiaBot Hub Manager',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_HUB_MANAGER',
     'extra_service': 'Environment=PATH=' + args.jaiabot_bin_dir + ':/usr/bin', # to execute correct data offload script
     'runs_on': [Type.HUB],
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'jaiabot_web_portal',
     'description': 'JaiaBot Web GUI Portal',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_WEB_PORTAL',
     'runs_on': [Type.HUB],
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'goby_liaison_standalone',
     'description': 'Goby Liaison PreLaunch GUI for JaiaBot',
     'template': 'liaison-prelaunch.service.in',
     'extra_service': 'Environment=GOBY_LIAISON_PLUGINS=libjaiabot_liaison_prelaunch.so.1',
     'runs_on': [Type.HUB]},
    {'exe': 'jaiabot_data_vision',
     'description': 'jaiabot_data_vision visualize log data',
     'template': 'jaiabot_data_vision.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_DATA_VISION',
     'runs_on': [Type.HUB]},
    {'service': 'jcc.conf',
     'template': 'jcc.conf.in',
     'runs_on': [Type.HUB]},

    ## ALL BOT Services ##

    {'exe': 'jaiabot_fusion',
     'description': 'JaiaBot Data Fusion',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_FUSION',
     'runs_on': [Type.BOT],
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'jaiabot_simulator',
     'description': 'JaiaBot Simulator',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_SIMULATOR',
     'runs_on': [Type.BOT],
     'runs_when': Mode.SIMULATION,
     'wanted_by': 'jaiabot_health.service'},       
    {'exe': 'goby_moos_gateway',
     'description': 'Goby to MOOS Gateway',
     'template': 'goby-app.service.in',
     'runs_on': [Type.BOT],
     'error_on_fail': 'ERROR__FAILED__GOBY_MOOS_GATEWAY',
     'extra_service': 'Environment=GOBY_MOOS_GATEWAY_PLUGINS=libgoby_ivp_frontseat_moos_gateway_plugin.so.30:libjaiabot_moos_gateway_plugin.so.1',
     'extra_unit': 'BindsTo=jaiabot_moosdb.service\nAfter=jaiabot_moosdb.service',
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'jaiabot_mission_manager',
     'description': 'JaiaBot Mission Manager',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_MISSION_MANAGER',
     'extra_service': 'Environment=PATH=' + args.jaiabot_bin_dir + ':/usr/bin', # to execute correct data pre/post offload scripts
     'runs_on': [Type.BOT],
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'jaiabot_pid_control',
     'description': 'JaiaBot PID Controller',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_PID_CONTROL',
     'runs_on': [Type.BOT],
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'jaiabot_driver_arduino',
     'description': 'JaiaBot Driver Arduino',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_DRIVER_ARDUINO',
     'runs_on': [Type.BOT],
     'runs_when': Mode.RUNTIME,
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'jaiabot_engineering',
     'description': 'JaiaBot Engineering Support',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_ENGINEERING',
     'runs_on': [Type.BOT],
     'wanted_by': 'jaiabot_health.service'},
    {'exe': 'MOOSDB',
     'description': 'MOOSDB Broker',
     'template': 'moosdb.service.in',
     'error_on_fail': 'ERROR__FAILED__MOOS_MOOSDB',
     'runs_on': [Type.BOT]},
    {'exe': 'pHelmIvP',
     'description': 'pHelmIvP Autonomy Engine',
     'template': 'moos-app.service.in',
     'error_on_fail': 'ERROR__FAILED__MOOS_PHELMIVP',
     'runs_on': [Type.BOT]},    
    {'exe': 'uProcessWatch',
     'description': 'uProcessWatch MOOS Health monitor',
     'template': 'moos-app.service.in',
     'error_on_fail': 'ERROR__FAILED__MOOS_UPROCESSWATCH',
     'runs_on': [Type.BOT]},    
    {'exe': 'pNodeReporter',
     'description': 'pNodeReporter MOOS data aggregator',
     'template': 'moos-app.service.in',
     'error_on_fail': 'ERROR__FAILED__MOOS_PNODEREPORTER',
     'runs_on': [Type.BOT]},
    {'exe': 'MOOSDB',
     'description': 'MOOSDB Simulation Broker',
     'template': 'moosdb-sim.service.in',
     'error_on_fail': 'ERROR__FAILED__MOOS_SIM_MOOSDB',
     'runs_on': [Type.BOT],
     'runs_when': Mode.SIMULATION,
     'service': 'jaiabot_moosdb_sim' # override default service name to avoid conflict with jaiabot_moosdb
    },
    {'exe': 'uSimMarine',
     'description': 'uSimMarine marine vehicle simulator',
     'template': 'moos-app-sim.service.in',
     'error_on_fail': 'ERROR__FAILED__MOOS_SIM_USIMMARINE',
     'runs_on': [Type.BOT],
     'runs_when': Mode.SIMULATION},
    {'exe': 'gpsd',
     'description': 'GPSD for simulator only',
     'template': 'gpsd-sim.service.in',
     'runs_on': [Type.BOT],
     'runs_when': Mode.SIMULATION},
    {'exe': 'jaiabot_ctd_manager',
     'description': 'JaiaBot CTD Manager',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_CTD_MANAGER',
     'runs_on': [Type.BOT],
     'wanted_by': 'jaiabot_health.service'},

    ## Bot Types: HYDRO, PAM, NONE Services

    {'exe': 'jaiabot_pressure_sensor.py',
     'description': 'JaiaBot Pressure Sensor Python Driver',
     'template': 'py-app.service.in',
     'subdir': 'pressure_sensor',
     'args': f'-t {jaia_pressure_sensor_type.value} -p {UDP_GATEWAY_PORT}',
     'error_on_fail': 'ERROR__FAILED__PYTHON_JAIABOT_PRESSURE_SENSOR',
     'runs_on': [BOT_TYPE.HYDRO, BOT_TYPE.PAM],
     'runs_when': Mode.RUNTIME,
     'wanted_by': 'jaiabot_health.service',
     'restart': 'on-failure'},
    {'exe': 'jaiabot_as-ezo-ec.py',
     'description': 'JaiaBot Salinity Sensor Python Driver',
     'template': 'py-app.service.in',
     'subdir': 'atlas_scientific_ezo_ec',
     'args': f'-p {UDP_GATEWAY_PORT}',
     'error_on_fail': 'ERROR__FAILED__PYTHON_JAIABOT_AS_EZO_EC',
     'runs_on': [BOT_TYPE.HYDRO, BOT_TYPE.PAM],
     'runs_when': Mode.RUNTIME,
     'wanted_by': 'jaiabot_health.service',
     'restart': 'on-failure'},

    ## PAM Services ##

    {'exe': 'jaiabot_pam.py',
     'description': 'JaiaBot MAI PAM Python Driver',
     'template': 'py-app.service.in',
     'subdir': 'pam',
     'args': f'-p {UDP_GATEWAY_PORT} -d {args.pam_connection_type}',
     'error_on_fail': 'ERROR__FAILED__PYTHON_JAIABOT_PAM',
     'runs_on': [BOT_TYPE.PAM],
     'runs_when': Mode.RUNTIME,
     'wanted_by': 'jaiabot_health.service',
     'restart': 'on-failure'},

    ## BIO Services ##

    {'exe': 'jaiabot_sensors',
     'description': 'JaiaBot Sensors',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_SENSORS',
     'exec_start_pre': '/usr/bin/reset-bio-payload-board.sh',
     'runs_on': [BOT_TYPE.BIO],
     'wanted_by': 'jaiabot_health.service'},

     ## UDP Gateway Services ##
    {'exe': 'jaiabot_udp_gateway',
    'description': 'JaiaBot UDP Gateway',
    'template': 'goby-app.service.in',
    'error_on_fail': 'ERROR__FAILED__JAIABOT_UDP_GATEWAY',
    'runs_on': [Type.BOT],
    'wanted_by': 'jaiabot_health.service'},

]

if jaia_imu_type.value == 'bno085':
    jaiabot_apps_imu = [
        {'exe': 'jaiabot_imu.py',
        'description': 'JaiaBot BNO085 IMU Python Driver',
        'template': 'py-app.service.in',
        'subdir': 'adafruit',
        'args': f'-t {IMU_TYPE.BNO085.value} -p {UDP_GATEWAY_PORT}',
        'error_on_fail': 'ERROR__FAILED__PYTHON_JAIABOT_IMU',
        'runs_on': [Type.BOT],
        'runs_when': Mode.RUNTIME,
        'wanted_by': 'jaiabot_health.service',
        'restart': 'on-failure'},
    ] 
    jaiabot_apps.extend(jaiabot_apps_imu)
else:
    jaiabot_apps_imu = [
        {'exe': 'jaiabot_imu.py',
        'description': 'JaiaBot BNO055 IMU Python Driver',
        'template': 'py-app.service.in',
        'subdir': 'adafruit',
        'args': f'-t {IMU_TYPE.BNO055.value} -p {UDP_GATEWAY_PORT}',
        'error_on_fail': 'ERROR__FAILED__PYTHON_JAIABOT_IMU',
        'runs_on': [Type.BOT],
        'runs_when': Mode.RUNTIME,
        'wanted_by': 'jaiabot_health.service',
        'restart': 'on-failure'},
    ]
    jaiabot_apps.extend(jaiabot_apps_imu)

if jaia_motor_harness_type.value == 'RPM_AND_THERMISTOR':
    jaiabot_apps_motor_harness_type = [
        {'exe': 'rpm.py',
        'description': 'JaiaBot Motor Python Driver',
        'template': 'py-app.service.in',
        'user': 'root', # must run as root to allow interaction with GPIO pin
        'group': 'root',
        'subdir': 'motor',
        'args': '',
        'error_on_fail': 'ERROR__FAILED__PYTHON_JAIABOT_MOTOR_LISTENER',
        'runs_on': [Type.BOT],
        'runs_when': Mode.RUNTIME,
        'wanted_by': 'jaiabot_health.service',
        'restart': 'on-failure'}
    ] 
    jaiabot_apps.extend(jaiabot_apps_motor_harness_type)

if 'none' not in camera_positions_in_use:
    jaiabot_apps_camera = [
        {'exe': 'jaiabot_driver_camera',
        'description': 'JaiaBot Driver Camera',
        'template': 'goby-app.service.in',
        'error_on_fail': 'ERROR__NOT_RESPONDING__JAIABOT_DRIVER_CAMERA',
        'runs_on': [Type.BOT],
        'runs_when': Mode.RUNTIME,
        'wanted_by': 'jaiabot_health.service'},
    ]
    jaiabot_apps.extend(jaiabot_apps_camera)

if 'turner_c_flour' in jaia_additional_sensors:
    jaiabot_turner_c_fluor = [
        {'exe': 'jaiabot_turner_c_fluor_sensor_driver',
        'description': 'JaiaBot Turner C Fluor Sensor Driver',
        'template': 'goby-app.service.in',
        'error_on_fail': 'ERROR__NOT_RESPONDING__JAIABOT_TURNER_C_FLUOR_SENSOR_DRIVER',
        'runs_on': [Type.BOT],
        'runs_when': Mode.RUNTIME,
        'wanted_by': 'jaiabot_health.service'},
    ]
    jaiabot_apps.extend(jaiabot_turner_c_fluor)

if 'aml' in jaia_additional_sensors:
    jaiabot_aml_sensor = [
        {'exe': 'jaiabot_aml_sensor_driver',
        'description': 'JaiaBot AML Sensor Driver',
        'template': 'goby-app.service.in',
        'error_on_fail': 'ERROR__NOT_RESPONDING__JAIABOT_AML_SENSOR_DRIVER',
        'runs_on': [Type.BOT],
        'runs_when': Mode.RUNTIME,
        'wanted_by': 'jaiabot_health.service'},
    ]
    jaiabot_apps.extend(jaiabot_aml_sensor)
if 'ppk' in jaia_additional_sensors:
    jaiabot_ubx_ppk = {
        'exe': 'jaiabot_ubx_ppk.py',
        'description': 'JaiaBot UBX PPK Logger',
        'template': 'py-app.service.in',
        'subdir': 'ubx_ppk',
        'args': f'-p {UDP_GATEWAY_PORT}',
        'error_on_fail': 'ERROR__FAILED__JAIABOT_PPK',
        'runs_on': [Type.BOT],
        'runs_when': Mode.RUNTIME,
        'wanted_by': 'jaiabot_health.service',
        'restart': 'on-failure'
    }

    jaiabot_apps.append(jaiabot_ubx_ppk)

if jaia_temperature_sensor_type.value == 'tsys01':
    jaiabot_apps_tsys01 = [
        {'exe': 'jaiabot_tsys01.py',
         'description': 'JaiaBot TSYS01 Temperature Sensor Python Driver',
         'template': 'py-app.service.in',
         'subdir': 'tsys01_temperature_sensor',
         'args': f'-p {UDP_GATEWAY_PORT}',
         'error_on_fail': 'ERROR__FAILED__PYTHON_JAIABOT_TSYS01_TEMPERATURE_SENSOR_DRIVER',
         'runs_on': [Type.BOT],
         'runs_when': Mode.RUNTIME, 
         'wanted_by': 'jaiabot_health.service',
         'restart': 'on-failure'},
    ]
    jaiabot_apps.extend(jaiabot_apps_tsys01)

jaia_firmware = [
    {'exe': 'hub-button-led-poweroff.py',
     'description': 'Hub Button LED Poweroff Mode',
     'template': 'hub-button-led-poweroff.service.in',
     'subdir': 'led_button',
     'args': '--electronics_stack=' + jaia_electronics_stack.value,
     'runs_on': [Type.HUB],
     'runs_when': Mode.RUNTIME,
     'led_type': LED_TYPE.HUB_LED},
    {'exe': 'hub-button-led-services-running.py',
     'description': 'Hub Button LED Services Running Mode',
     'template': 'hub-button-led-services-running.service.in',
     'subdir': 'led_button',
     'args': '--electronics_stack=' + jaia_electronics_stack.value,
     'runs_on': [Type.HUB],
     'runs_when': Mode.RUNTIME,
     'led_type': LED_TYPE.HUB_LED},
    {'exe': 'hub-button-trigger.py',
     'description': 'Hub Button LED Triggers',
     'template': 'hub-button-trigger.service.in',
     'subdir': 'led_button',
     'args': '--electronics_stack=' + jaia_electronics_stack.value,
     'runs_on': [Type.HUB],
     'runs_when': Mode.RUNTIME,
     'led_type': LED_TYPE.HUB_LED},
    {'exe': 'gps-spi-pty.py',
     'description': 'Create a pty, and send all the spi gps data to it',
     'template': 'gps_spi_pty.service.in',
     'subdir': 'gps',
     'args': '',
     'runs_on': [Type.BOTH],
     'runs_when': Mode.RUNTIME,
     'gps_type': GPS_TYPE.SPI},
    {'exe': 'gps-i2c-pty.py',
     'description': 'Create a pty, and send all the i2c gps data to it',
     'template': 'gps_i2c_pty.service.in',
     'subdir': 'gps',
     'args': '',
     'runs_on': [Type.BOTH],
     'runs_when': Mode.RUNTIME,
     'gps_type': GPS_TYPE.I2C},
     {'exe': 'arduino_spi_gpio_pin.py',
     'description': 'Hub Button LED Poweroff Mode',
     'template': 'arduino-spi-gpio-pin.service.in',
     'subdir': 'arduino',
     'args': '--electronics_stack=' + jaia_electronics_stack.value,
     'runs_on': [Type.BOT],
     'runs_when': Mode.RUNTIME},
     {'exe': 'jaia_firm_backup_date.sh',
     'description': 'Backup the date to a file when we have a valid date time ntp',
     'template': 'backup-date.service.in',
     'args': '',
     'runs_on': [Type.BOTH],
     'runs_when': Mode.BOTH,
     'runs_on_cloudhub': True},
     {'exe': 'jaia_firm_bno085_reset_gpio_pin.py',
     'description': 'BNO085 script to reboot imu',
     'template': 'bno085-reset-gpio-pin.service.in',
     'subdir': 'adafruit',
     'args': '--imu_install_type=' + jaia_imu_install_type.value,
     'runs_on': [Type.BOT],
     'runs_when': Mode.RUNTIME,
     'imu_type': IMU_TYPE.BNO085,
     'run_at_boot': False},
     {'exe': 'jaia_firm_pam_reset_gpio_pin.py',
     'description': 'Script to reset gpio line for the PAM',
     'template': 'pam-reset-gpio-pin.service.in',
     'subdir': 'pam',
     'args': '',
     'runs_on': [Type.BOT],
     'runs_when': Mode.RUNTIME,
     'run_at_boot': False}
]

# check if the app is run on this type (bot/hub) and at this time (runtime/simulation)
def is_app_run(app):
    macros={**common_macros, **app}
    return (Type.BOTH in macros['runs_on'] or jaia_type in macros['runs_on'] or jaia_bot_type in macros['runs_on']) and (macros['runs_when'] == Mode.BOTH or macros['runs_when'] == jaia_mode) and (not is_cloudhub or macros['runs_on_cloudhub'])

for app in jaiabot_apps:
    if is_app_run(app):
        if app['template'] == 'goby-app.service.in':
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
        if app.get('exe') == 'goby_coroner':
            macros['extra_flags'] = '--expected_name ' + ' --expected_name '.join(all_goby_apps)
            
        if not 'bin_dir' in macros:
            if (macros.get('exe') or '').startswith('goby'):
                macros['bin_dir'] = macros['goby_bin_dir']
            else:
                macros['bin_dir'] = macros['jaiabot_bin_dir']

        macros['service'] = service
                
        with open(script_dir + '/../templates/systemd/' + app['template'], 'r') as file:        
            out=Template(file.read()).substitute(macros)    
        outfilename = args.systemd_dir + '/' + service + '.service'

        enable = args.enable
        disable = args.disable

        if app['template'] == 'jcc.conf.in':
            outfilename = '/etc/apache2/sites-available/' + service
            enable = False
            disable = False

        print('Writing ' + outfilename)
        outfile = open(outfilename, 'w')
        outfile.write(out)
        outfile.close()
        if enable:
            print('Enabling ' + service)
            subprocess.run('systemctl enable ' + service, check=True, shell=True)
        if disable:
            print('Disabling ' + service)
            subprocess.run('systemctl disable ' + service, check=True, shell=True)
        if app['template'] == 'jcc.conf.in':
            print('Enabling ' + service)
            subprocess.run('a2ensite ' + service, check=True, shell=True)
            subprocess.run('if systemctl is-active --quiet apache2; then systemctl reload apache2; else systemctl start apache2; fi', check=True, shell=True)
            
# check if the firmware is run on this type (bot/hub), at this time (runtime/simulation), and if the system has the capability
def is_firm_run(firm):
    macros={**firmware_common_macros, **firm}

    if (jaia_type not in macros['runs_on'] and Type.BOTH not in macros['runs_on']):
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

    if(is_cloudhub and not macros['runs_on_cloudhub']):
        return False
        
    return True

for firmware in jaia_firmware:
    if is_firm_run(firmware):
        macros={**firmware_common_macros, **firmware}

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
