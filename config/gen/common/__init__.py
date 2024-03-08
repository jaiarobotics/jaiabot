import os
import sys
from enum import Enum
from . import config

def check_args():
    if len(sys.argv) >= 2:
        app=sys.argv[1]
    else:
        config.fail('App name must be given as first command line argument')

check_args()
app=sys.argv[1]

try:
    jaia_log_dir=os.environ['jaia_log_dir']
    os.makedirs(jaia_log_dir, exist_ok=True)
except:    
    config.fail('Must set jaia_log_dir environmental variable and must be able to create log directory.')


jaia_templates_dir=os.path.normpath(os.path.dirname(os.path.realpath(__file__)) +  '/../../templates')
config.checkdir(jaia_templates_dir)



class Mode(Enum):
     RUNTIME = "runtime"
     SIMULATION = "simulation"     

try:
    jaia_mode=Mode(os.environ['jaia_mode'])
except:    
    config.fail('Must set jaia_mode environmental variable to "runtime" or "simulation".')

def is_simulation():
    return jaia_mode == Mode.SIMULATION
def is_runtime():
    return jaia_mode == Mode.RUNTIME

is_vfleet=False
datasource_file = "/var/lib/cloud/instance/datasource"
try:
    with open(datasource_file) as f:
        line = f.readlines()
        if is_simulation() and "DataSourceEc2Local" in line[0]:
            is_vfleet=True
except FileNotFoundError:
    pass

class CommsMode(Enum):
     WIFI = "wifi"
     XBEE = "xbee"     

try:
    jaia_comms_mode=CommsMode(os.environ['jaia_comms_mode'])
except:    
    if is_simulation():
        jaia_comms_mode = CommsMode.WIFI
    if is_runtime():
        jaia_comms_mode = CommsMode.XBEE


def app_block(verbosities, debug_log_file_dir, omit_debug_log=False):
    # placeholder for non-Goby apps to avoid having to define in verbosities when not used.
    default_verbosities = {'runtime': {'tty': 'MUST_SET_IN_BOT/HUB.PY', 'log': 'MUST_SET_IN_BOT/HUB.PY'}, 'simulation': {'tty': 'MUST_SET_IN_BOT/HUB.PY', 'log': 'MUST_SET_IN_BOT/HUB.PY'}}
    app_verbosity = verbosities.get(app, default_verbosities)

    if is_simulation():
        simulation_block = config.template_substitute(jaia_templates_dir+'/_simulation.pb.cfg.in',
                                                      warp=sim.warp)
        tty_verbosity = app_verbosity['simulation']['tty']
        log_verbosity = app_verbosity['simulation']['log']
    elif is_runtime():
        simulation_block = ""
        tty_verbosity = app_verbosity['runtime']['tty']
        log_verbosity = app_verbosity['runtime']['log']


    if omit_debug_log or log_verbosity == 'QUIET':
        file_log=''
    else:
        file_log='file_log { file_dir: "' + debug_log_file_dir + '" verbosity: ' + log_verbosity + ' }'

        
    return config.template_substitute(jaia_templates_dir+'/_app.pb.cfg.in',
                                      app=app,
                                      tty_verbosity = tty_verbosity,
                                      file_log=file_log,
                                      simulation=simulation_block)
