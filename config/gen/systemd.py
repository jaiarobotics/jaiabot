#!/usr/bin/env python3

import argparse
from enum import Enum
import os
from string import Template
import shutil
import subprocess

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

parser = argparse.ArgumentParser(description='Generate systemd services for JaiaBot and JaiaHub', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
parser.add_argument('type', choices=['bot', 'hub'], help='Should we generate service files for a bot or a hub?')
parser.add_argument('--env_file', default='/etc/jaiabot/runtime.env', help='Location of the file to contain environmental variables loaded by systemd services (written by this script)')
parser.add_argument('--jaiabot_bin_dir', default=jaiabot_bin_dir_default, help='Directory of the JaiaBot binaries')
parser.add_argument('--jaiabot_share_dir', default=jaiabot_share_dir_default, help='Directory of the JaiaBot arch-independent files (share)')
parser.add_argument('--goby_bin_dir', default=goby_bin_dir_default, help='Directory of the Goby binaries')
parser.add_argument('--moos_bin_dir', default=moos_bin_dir_default, help='Directory of the MOOS binaries')
parser.add_argument('--gen_dir', default=gen_dir_default, help='Directory to the configuration generation scripts')
parser.add_argument('--systemd_dir', default='/etc/systemd/system', help='Directory to write systemd services to')
parser.add_argument('--bot_index', default=0, type=int, help='Bot index')
parser.add_argument('--hub_index', default=0, type=int, help='Hub index')
parser.add_argument('--fleet_index', default=0, type=int, help='Fleet index')
parser.add_argument('--n_bots', default=1, type=int, help='Number of bots in the fleet')
parser.add_argument('--enable', action='store_true', help='If set, run systemctl enable on all services')
parser.add_argument('--disable', action='store_true', help='If set, run systemctl disable on all services')
parser.add_argument('--simulation', action='store_true', help='If set, configure services for simulation mode - NOT for real operations')
parser.add_argument('--warp', default=1, type=int, help='If --simulation, sets the warp speed to use (multiple of real clock). This value must match other bots/hubs')
parser.add_argument('--log_dir', default='/var/log/jaiabot', help='Directory to write log files to')
parser.add_argument('--led_type', choices=['hub_led', 'none'], help='If set, configure services for led type')
parser.add_argument('--electronics_stack', choices=['1', '2'], help='If set, configure services for electronics stack')

args=parser.parse_args()

class LED_TYPE(Enum):
    HUB_LED = 'hub_led'
    NONE = 'none'

class GPS_TYPE(Enum):
    SPI = 'spi'
    I2C = 'i2c'
    NONE = 'none'

class ELECTRONICS_STACK(Enum):
    STACK_1 = '1'
    STACK_2 = '2'

if args.led_type == 'hub_led':
    jaia_led_type=LED_TYPE.HUB_LED
elif args.led_type == 'none':
    jaia_led_type=LED_TYPE.NONE    
else:
    jaia_led_type=LED_TYPE.NONE

if args.electronics_stack == '1':
    jaia_electronics_stack=ELECTRONICS_STACK.STACK_1
    jaia_gps_type=GPS_TYPE.I2C
elif args.electronics_stack == '2':
    jaia_electronics_stack=ELECTRONICS_STACK.STACK_2
    jaia_gps_type=GPS_TYPE.SPI

# make the output directories, if they don't exist
os.makedirs(os.path.dirname(args.env_file), exist_ok=True)

class Mode(Enum):
    SIMULATION = 'simulation'
    RUNTIME = 'runtime'
    BOTH = 'both'
    
if args.simulation:
    jaia_mode=Mode.SIMULATION
    warp=args.warp
else:
    jaia_mode=Mode.RUNTIME
    warp=1
    
# generate env file from preseed.goby
print('Writing ' + args.env_file + ' from preseed.goby')
subprocess.run('bash -ic "' +
               'export jaia_mode=' + jaia_mode.value + '; ' +
               'export jaia_bot_index=' + str(args.bot_index) + '; ' +
               'export jaia_fleet_index=' + str(args.fleet_index) + '; ' + 
               'export jaia_n_bots=' + str(args.n_bots) + '; ' +
               'export jaia_warp=' + str(warp) + '; ' +
               'export jaia_log_dir=' + str(args.log_dir) + '; ' +
               'source ' + args.gen_dir + '/../preseed.goby; env | egrep \'^jaia|^LD_LIBRARY_PATH\' > /tmp/runtime.env; cp --backup=numbered /tmp/runtime.env ' + args.env_file + '; rm /tmp/runtime.env"',
               check=True, shell=True)

common_macros=dict()

common_macros['env_file']=args.env_file
common_macros['jaiabot_bin_dir']=args.jaiabot_bin_dir
common_macros['jaiabot_share_dir']=args.jaiabot_share_dir
common_macros['goby_bin_dir']=args.goby_bin_dir
common_macros['moos_bin_dir']=args.moos_bin_dir
common_macros['extra_service']=''
common_macros['extra_unit']=''
common_macros['extra_flags']=''
common_macros['bhv_file']='/tmp/jaiabot_${jaia_bot_index}.bhv'
common_macros['moos_file']='/tmp/jaiabot_${jaia_bot_index}.moos'
common_macros['moos_sim_file']='/tmp/jaiabot_sim_${jaia_bot_index}.moos'
# unless otherwise specified, apps are run both at runtime and simulation
common_macros['runs_when']=Mode.BOTH

try:
    common_macros['user']=os.getlogin()
    common_macros['group']=os.getlogin()
except:
    common_macros['user']=os.environ['USER']
    common_macros['group']=os.environ['USER']    
    
class Type(Enum):
     BOT = 'bot'
     HUB = 'hub'
     BOTH = 'both'

if args.type == 'bot':
    jaia_type=Type.BOT
    common_macros['gen']=args.gen_dir + '/bot.py'
elif args.type == 'hub':
    jaia_type=Type.HUB
    common_macros['gen']=args.gen_dir + '/hub.py'

all_goby_apps=[]
    
jaiabot_apps=[
    {'exe': 'jaiabot',
     'template': 'jaiabot.service.in',
     'runs_on': Type.BOTH },
    {'exe': 'gobyd',
     'description': 'Goby Daemon',
     'template': 'gobyd.service.in',
     'error_on_fail': 'ERROR__FAILED__GOBYD',
     'runs_on': Type.BOTH },
    {'exe': 'goby_liaison',
     'description': 'Goby Liaison GUI for JaiaBot',
     'template': 'goby-app.service.in',
     'extra_service': 'Environment=GOBY_LIAISON_PLUGINS=libjaiabot_liaison.so.1',
     'error_on_fail': 'ERROR__FAILED__GOBY_LIAISON',
     'runs_on': Type.BOTH},
    {'exe': 'goby_gps',
     'description': 'Goby GPS Driver',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__GOBY_GPS',
     'runs_on': Type.BOTH,
     'extra_unit': 'BindsTo=gpsd.service\nAfter=gpsd.service'},
    {'exe': 'goby_logger',
     'description': 'Goby Logger',
     'template': 'logger-app.service.in',
     'error_on_fail': 'ERROR__FAILED__GOBY_LOGGER',
     'runs_on': Type.BOTH,
    'extra_unit': 'BindsTo=var-log.mount\nAfter=var-log.mount'},
    {'exe': 'goby_coroner',
     'description': 'Goby Coroner',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__GOBY_CORONER',
     'runs_on': Type.BOTH},
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
     'runs_on': Type.BOTH},
    {'exe': 'jaiabot_hub_manager',
     'description': 'JaiaBot Hub Manager',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_HUB_MANAGER',
     'runs_on': Type.HUB},
    {'exe': 'jaiabot_web_portal',
     'description': 'JaiaBot Web GUI Portal',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_WEB_PORTAL',
     'runs_on': Type.HUB},
    {'exe': 'jaiabot_fusion',
     'description': 'JaiaBot Data Fusion',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_FUSION',
     'runs_on': Type.BOT},
    {'exe': 'jaiabot_simulator',
     'description': 'JaiaBot Simulator',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_SIMULATOR',
     'runs_on': Type.BOT,
     'runs_when': Mode.SIMULATION},       
    {'exe': 'goby_moos_gateway',
     'description': 'Goby to MOOS Gateway',
     'template': 'goby-app.service.in',
     'runs_on': Type.BOT,
     'error_on_fail': 'ERROR__FAILED__GOBY_MOOS_GATEWAY',
     'extra_service': 'Environment=GOBY_MOOS_GATEWAY_PLUGINS=libgoby_ivp_frontseat_moos_gateway_plugin.so.30:libjaiabot_moos_gateway_plugin.so.1',
     'extra_unit': 'BindsTo=jaiabot_moosdb.service\nAfter=jaiabot_moosdb.service'},
    {'exe': 'jaiabot_mission_manager',
     'description': 'JaiaBot Mission Manager',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_MISSION_MANAGER',
     'runs_on': Type.BOT},
    {'exe': 'jaiabot_pid_control',
     'description': 'JaiaBot PID Controller',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_PID_CONTROL',
     'runs_on': Type.BOT},
    {'exe': 'jaiabot_bluerobotics_pressure_sensor_driver',
     'description': 'JaiaBot Blue Robotics Pressure Sensor Driver',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_BLUEROBOTICS_PRESSURE_SENSOR_DRIVER',
     'runs_on': Type.BOT},
    {'exe': 'jaiabot_atlas_scientific_ezo_ec_driver',
     'description': 'JaiaBot Atlas Scientific Salinity Sensor Driver',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_ATLAS_SCIENTIFIC_EZO_EC_DRIVER',
     'runs_on': Type.BOT},
    {'exe': 'jaiabot_adafruit_BNO055_driver',
     'description': 'JaiaBot IMU Sensor Driver',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_ADAFRUIT_BNO055_DRIVER',
     'runs_on': Type.BOT},
    {'exe': 'jaiabot_driver_arduino',
     'description': 'JaiaBot Driver Arduino',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_DRIVER_ARDUINO',
     'runs_on': Type.BOT,
     'runs_when': Mode.RUNTIME},
    {'exe': 'jaiabot_engineering',
     'description': 'JaiaBot Engineering Support',
     'template': 'goby-app.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_ENGINEERING',
     'runs_on': Type.BOT},
    {'exe': 'jaiabot_imu.py',
     'description': 'JaiaBot IMU Python Driver',
     'template': 'py-app.service.in',
     'subdir': 'adafruit_BNO055',
     'args': '20000',
     'error_on_fail': 'ERROR__FAILED__PYTHON_JAIABOT_IMU',
     'runs_on': Type.BOT,
     'runs_when': Mode.RUNTIME},
    {'exe': 'jaiabot_pressure_sensor.py',
     'description': 'JaiaBot Pressure Sensor Python Driver',
     'template': 'py-app.service.in',
     'subdir': 'pressure_sensor',
     'args': '',
     'error_on_fail': 'ERROR__FAILED__PYTHON_JAIABOT_PRESSURE_SENSOR',
     'runs_on': Type.BOT,
     'runs_when': Mode.RUNTIME},
    {'exe': 'jaiabot_as-ezo-ec.py',
     'description': 'JaiaBot Salinity Sensor Python Driver',
     'template': 'py-app.service.in',
     'subdir': 'atlas_scientific_ezo_ec',
     'args': '20002',
     'error_on_fail': 'ERROR__FAILED__PYTHON_JAIABOT_AS_EZO_EC',
     'runs_on': Type.BOT,
     'runs_when': Mode.RUNTIME},
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
    {'exe': 'jaiabot_log_converter',
     'description': 'jaiabot_log_converter converts goby files to h5',
     'template': 'jaiabot_log_converter.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_LOG_CONVERTER',
     'runs_on': Type.HUB},
    {'exe': 'jaiabot_data_vision',
     'description': 'jaiabot_data_vision visualize log data',
     'template': 'jaiabot_data_vision.service.in',
     'error_on_fail': 'ERROR__FAILED__JAIABOT_DATA_VISION',
     'runs_on': Type.HUB},
    {'exe': 'gpsd',
     'description': 'GPSD for simulator only',
     'template': 'gpsd-sim.service.in',
     'runs_on': Type.BOT,
     'runs_when': Mode.SIMULATION}
]

jaia_firmware = [
    {'exe': 'hub-button-led-poweroff.py',
     'description': 'Hub Button LED Poweroff Mode',
     'template': 'hub-button-led-poweroff.service.in',
     'subdir': 'led_button',
     'args': '--electronics_stack=' + jaia_electronics_stack,
     'runs_on': Type.HUB,
     'runs_when': Mode.RUNTIME,
     'led_type': LED_TYPE.HUB_LED},
    {'exe': 'hub-button-led-services-running.py',
     'description': 'Hub Button LED Services Running Mode',
     'template': 'hub-button-led-services-running.service.in',
     'subdir': 'led_button',
     'args': '--electronics_stack=' + jaia_electronics_stack,
     'runs_on': Type.HUB,
     'runs_when': Mode.RUNTIME,
     'led_type': LED_TYPE.HUB_LED},
    {'exe': 'hub-button-trigger.py',
     'description': 'Hub Button LED Triggers',
     'template': 'hub-button-trigger.service.in',
     'subdir': 'led_button',
     'args': '--electronics_stack=' + jaia_electronics_stack,
     'runs_on': Type.HUB,
     'runs_when': Mode.RUNTIME,
     'led_type': LED_TYPE.HUB_LED},
    {'exe': 'gps-spi-pty.py',
     'description': 'Create a pty, and send all the spi gps data to it',
     'template': 'gps-spi-pty.service.in',
     'subdir': 'gps',
     'args': '',
     'runs_on': Type.BOTH,
     'runs_when': Mode.RUNTIME,
     'gps_type': GPS_TYPE.SPI},
    {'exe': 'gps-i2c-pty.py',
     'description': 'Create a pty, and send all the i2c gps data to it',
     'template': 'gps-i2c-pty.service.in',
     'subdir': 'gps',
     'args': '',
     'runs_on': Type.BOTH,
     'runs_when': Mode.RUNTIME,
     'gps_type': GPS_TYPE.I2C},
]

# check if the app is run on this type (bot/hub) and at this time (runtime/simulation)
def is_app_run(app):
    macros={**common_macros, **app}
    return (macros['runs_on'] == Type.BOTH or macros['runs_on'] == jaia_type) and (macros['runs_when'] == Mode.BOTH or macros['runs_when'] == jaia_mode)

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
def is_firm_run(app):
    macros={**common_macros, **app}
    return (macros['runs_on'] == Type.BOTH or macros['runs_on'] == jaia_type) and (macros['runs_when'] == Mode.BOTH or macros['runs_when'] == jaia_mode) and (macros['led_type'] == jaia_led_type or macros['gps_type'] == jaia_gps_type)

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
        if args.enable:
            print('Enabling ' + service)
            subprocess.run('systemctl enable ' + service, check=True, shell=True)
        if args.disable:
            print('Disabling ' + service)
            subprocess.run('systemctl disable ' + service, check=True, shell=True)
        
        
if args.enable or args.disable:
    subprocess.run('systemctl daemon-reload', check=True, shell=True)
