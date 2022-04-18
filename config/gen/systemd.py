#!/usr/bin/env python3

import argparse
from enum import Enum
import os
from string import Template


script_dir=os.path.dirname(os.path.realpath(__file__))

parser = argparse.ArgumentParser(description='Generate systemd services for JaiaBot and JaiaHub')
parser.add_argument('--type', choices=['bot', 'hub'], required=True)
parser.add_argument('--env_file', default='/etc/jaia/runtime.env')
parser.add_argument('--jaia_bin_dir', default='/usr/bin')
parser.add_argument('--goby_bin_dir', default='/usr/bin')
parser.add_argument('--gen_dir', default='/etc/jaia/gen')
parser.add_argument('--systemd_dir', default='/etc/systemd/system')
args=parser.parse_args()

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
