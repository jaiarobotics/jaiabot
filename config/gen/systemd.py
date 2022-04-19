#!/usr/bin/env python3

import argparse
from enum import Enum
import os
from string import Template
import shutil

# defaults based on $PATH settings
script_dir=os.path.dirname(os.path.realpath(__file__))
try:
    jaia_bin_dir_default=os.path.dirname(shutil.which('jaiabot_single_thread_pattern'))
except Exception as e:
    jaia_bin_dir_default='/usr/bin'
                            
try:
    goby_bin_dir_default=os.path.dirname(shutil.which('gobyd'))
except Exception as e:
    goby_bin_dir_default='/usr/bin'

gen_dir_default=script_dir
    

parser = argparse.ArgumentParser(description='Generate systemd services for JaiaBot and JaiaHub', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
parser.add_argument('--type', choices=['bot', 'hub'], required=True, help='Should we generate service files for a bot or a hub?')
parser.add_argument('--env_file', default='/etc/jaia/runtime.env', help='Location of the file to contain environmental variables loaded by systemd services (written by this script)')
parser.add_argument('--jaia_bin_dir', default=jaia_bin_dir_default, help='Directory of the JaiaBot binaries')
parser.add_argument('--goby_bin_dir', default=goby_bin_dir_default, help='Directory of the Goby binaries')
parser.add_argument('--gen_dir', default=gen_dir_default, help='Directory to the configuration generation scripts')
parser.add_argument('--systemd_dir', default='/etc/systemd/system', help='Directory to write systemd services to')
args=parser.parse_args()

# generate env file from preseed.goby
os.system('bash -c "jaia_mode=runtime; source ' + args.gen_dir + '/../preseed.goby; env | egrep \'^jaia|^LD_LIBRARY_PATH\' > ' + args.env_file + '"')

common_macros=dict()

common_macros['env_file']=args.env_file
common_macros['jaia_bin_dir']=args.jaia_bin_dir
common_macros['goby_bin_dir']=args.goby_bin_dir

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
    {'exe': 'jaiabot_fusion',
     'description': 'JaiaBot Data Fusion',
     'template': 'goby-app.service.in',
     'runs_on': Type.BOT},
    {'exe': 'jaiabot_bluerobotics_pressure_sensor_driver',
     'description': 'JaiaBot Blue Robotics Pressure Sensor Driver',
     'template': 'goby-app.service.in',
     'runs_on': Type.BOT}
]


for app in jaiabot_apps:
    if app['runs_on'] == Type.BOTH or app['runs_on'] == jaia_type:
        macros={**app, **common_macros}
        with open(script_dir + '/../templates/systemd/' + app['template'], 'r') as file:        
            out=Template(file.read()).substitute(macros)    
        outfilename = args.systemd_dir + '/' + app['exe'] + '.service'
        print('Writing ' + outfilename)
        outfile = open(outfilename, 'w')
        outfile.write(out)
