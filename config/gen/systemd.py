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
                            
try:
    goby_bin_dir_default=os.path.dirname(shutil.which('gobyd'))
except Exception as e:
    goby_bin_dir_default='/usr/bin'

gen_dir_default=script_dir    

parser = argparse.ArgumentParser(description='Generate systemd services for JaiaBot and JaiaHub', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
parser.add_argument('type', choices=['bot', 'hub'], help='Should we generate service files for a bot or a hub?')
parser.add_argument('--env_file', default='/etc/jaiabot/runtime.env', help='Location of the file to contain environmental variables loaded by systemd services (written by this script)')
parser.add_argument('--jaiabot_bin_dir', default=jaiabot_bin_dir_default, help='Directory of the JaiaBot binaries')
parser.add_argument('--goby_bin_dir', default=goby_bin_dir_default, help='Directory of the Goby binaries')
parser.add_argument('--gen_dir', default=gen_dir_default, help='Directory to the configuration generation scripts')
parser.add_argument('--systemd_dir', default='/etc/systemd/system', help='Directory to write systemd services to')
parser.add_argument('--enable', action='store_true', help='If set, run systemctl enable on all services')
parser.add_argument('--disable', action='store_true', help='If set, run systemctl disable on all services')
args=parser.parse_args()

# make the output directories, if they don't exist
os.makedirs(os.path.dirname(args.env_file), exist_ok=True)

# generate env file from preseed.goby
subprocess.run('bash -ic "export jaia_mode=runtime; source ' + args.gen_dir + '/../preseed.goby; env | egrep \'^jaia|^LD_LIBRARY_PATH\' > ' + args.env_file + '"', check=True, shell=True)

common_macros=dict()

common_macros['env_file']=args.env_file
common_macros['jaiabot_bin_dir']=args.jaiabot_bin_dir
common_macros['goby_bin_dir']=args.goby_bin_dir
common_macros['extra_service']=''
common_macros['extra_unit']=''

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

jaiabot_apps=[
    {'exe': 'jaia',
     'template': 'jaia.service.in',
     'runs_on': Type.BOTH },
    {'exe': 'gobyd',
     'template': 'gobyd.service.in',
     'runs_on': Type.BOTH },
    {'exe': 'goby_liaison',
     'description': 'Goby Liaison GUI for JaiaBot',
     'template': 'goby-app.service.in',
     'extra_service': 'Environment=GOBY_LIAISON_PLUGINS=libjaiabot_liaison.so.1',
     'runs_on': Type.BOTH},
    {'exe': 'goby_gps',
     'description': 'Goby GPS Driver',
     'template': 'goby-app.service.in',
     'runs_on': Type.BOTH,
     'extra_unit': 'BindsTo=gpsd.service\nAfter=gpsd.service'},
    {'exe': 'goby_logger',
     'description': 'Goby Logger',
     'template': 'goby-app.service.in',
     'runs_on': Type.BOTH},
    {'exe': 'jaiabot_hub_manager',
     'description': 'JaiaBot Hub Manager',
     'template': 'goby-app.service.in',
     'runs_on': Type.HUB},
    {'exe': 'jaiabot_web_portal',
     'description': 'JaiaBot Web GUI Portal',
     'template': 'goby-app.service.in',
     'runs_on': Type.HUB},
    {'exe': 'jaiabot_fusion',
     'description': 'JaiaBot Data Fusion',
     'template': 'goby-app.service.in',
     'runs_on': Type.BOT},
    {'exe': 'goby_moos_gateway',
     'description': 'Goby to MOOS Gateway',
     'template': 'goby-app.service.in',
     'runs_on': Type.BOT,
     'extra_service': 'Environment=GOBY_MOOS_GATEWAY_PLUGINS=libgoby_ivp_frontseat_moos_gateway_plugin.so.30:libjaiabot_moos_gateway_plugin.so.1'},
    {'exe': 'jaiabot_mission_manager',
     'description': 'JaiaBot Mission Manager',
     'template': 'goby-app.service.in',
     'runs_on': Type.BOT},
    {'exe': 'jaiabot_pid_control',
     'description': 'JaiaBot PID Controller',
     'template': 'goby-app.service.in',
     'runs_on': Type.BOT},
    {'exe': 'jaiabot_bluerobotics_pressure_sensor_driver',
     'description': 'JaiaBot Blue Robotics Pressure Sensor Driver',
     'template': 'goby-app.service.in',
     'runs_on': Type.BOT},
    {'exe': 'jaiabot_atlas_scientific_ezo_ec_driver',
     'description': 'JaiaBot Atlas Scientific Salinity Sensor Driver',
     'template': 'goby-app.service.in',
     'runs_on': Type.BOT},
    {'exe': 'jaiabot_adafruit_BNO055_driver',
     'description': 'JaiaBot IMU Sensor Driver',
     'template': 'goby-app.service.in',
     'runs_on': Type.BOT},
    {'exe': 'jaiabot_control_surfaces_driver',
     'description': 'JaiaBot Control Surfaces Driver',
     'template': 'goby-app.service.in',
     'runs_on': Type.BOT},
    {'exe': 'jaiabot_imu.py',
     'description': 'JaiaBot IMU Python Driver',
     'template': 'py-app.service.in',
     'subdir': 'adafruit_BNO055',
     'args': '20000',
     'runs_on': Type.BOT},
    {'exe': 'jaiabot_pressure_sensor.py',
     'description': 'JaiaBot Pressure Sensor Python Driver',
     'template': 'py-app.service.in',
     'subdir': 'pressure_sensor',
     'args': '',
     'runs_on': Type.BOT},
    {'exe': 'jaiabot_as-ezo-ec.py',
     'description': 'JaiaBot Salinity Sensor Python Driver',
     'template': 'py-app.service.in',
     'subdir': 'atlas_scientific_ezo_ec',
     'args': '20002',
     'runs_on': Type.BOT}
]


for app in jaiabot_apps:
    if app['runs_on'] == Type.BOTH or app['runs_on'] == jaia_type:
        macros={**common_macros, **app}
        service=app['exe'].replace('.', '_')
        if not 'bin_dir' in macros:
            if macros['exe'][0:4] == 'goby':
                macros['bin_dir'] = macros['goby_bin_dir']
            else:
                macros['bin_dir'] = macros['jaiabot_bin_dir']
            
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
        
if args.enable or args.disable:
    subprocess.run('systemctl daemon-reload', check=True, shell=True)
