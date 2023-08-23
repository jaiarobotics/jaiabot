#!/usr/bin/env python3

# Generates Goby3 protobuf configuration using definitions and text substitution
# Usage: python3 example.pb.cfg.py app_name

import sys
import os
from common import config
from common import logger
from common import is_simulation, is_runtime
import common, common.hub, common.comms, common.sim, common.bot, common.udp
from pathlib import Path

try:
    fleet_index=int(os.environ['jaia_fleet_index'])
except:
    config.fail('Must set jaia_fleet_index environmental variable, e.g. "jaia_fleet_index=0 ./hub.launch"')

try:
    hub_index=int(os.environ['jaia_hub_index'])
except:
    hub_index=0

log_file_dir = common.jaia_log_dir + '/hub'
Path(log_file_dir).mkdir(parents=True, exist_ok=True)
debug_log_file_dir=log_file_dir 

node_id = 0 
wifi_modem_id = common.comms.wifi_modem_id(node_id)
vehicle_type= 'HUB'

templates_dir=common.jaia_templates_dir

liaison_load_block = config.template_substitute(templates_dir+'/hub/_liaison_load.pb.cfg.in')

verbosities = \
{ 'gobyd':                     { 'runtime': { 'tty': 'WARN', 'log': 'DEBUG1' }, 'simulation': { 'tty': 'WARN', 'log': 'WARN' }},
  'goby_intervehicle_portal':  { 'runtime': { 'tty': 'WARN', 'log': 'WARN'  },  'simulation': { 'tty': 'WARN', 'log': 'DEBUG2' }},
  'goby_liaison':              { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'goby_gps':                  { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'DEBUG2', 'log': 'QUIET' }},
  'goby_logger':               { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'goby_coroner':              { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'QUIET', 'log': 'QUIET' }},
  'jaiabot_health':            { 'runtime': { 'tty': 'WARN', 'log': 'DEBUG2'},  'simulation': { 'tty': 'DEBUG1', 'log': 'DEBUG2'}},
  'jaiabot_metadata':          { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'QUIET', 'log': 'VERBOSE' }},
  'jaiabot_hub_manager':       { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'QUIET', 'log': 'DEBUG2' }},
  'jaiabot_web_portal':        { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'QUIET', 'log': 'DEBUG2' }},
  'goby_opencpn_interface':    { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'goby_terminate':            { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'jaiabot_failure_reporter':  { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'jaiabot_simulator':         { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }}
}

app_common = common.app_block(verbosities, debug_log_file_dir)

interprocess_common = config.template_substitute(templates_dir+'/_interprocess.pb.cfg.in',
                                                 platform='hub'+ str(hub_index) +'_fleet' + str(fleet_index))

try:
    xbee_info = 'xbee { \n' + open('/etc/jaiabot/xbee_info.pb.cfg').read() + '\n}\n'
except FileNotFoundError:
    xbee_info = 'xbee {}'

if common.jaia_comms_mode == common.CommsMode.XBEE:
    if is_simulation():
        xbee_serial_port='/tmp/xbeehub' + str(hub_index)
    else:
        xbee_serial_port='/dev/xbee'
    
    
    link_block = config.template_substitute(templates_dir+'/link_xbee.pb.cfg.in',
                                            subnet_mask=common.comms.subnet_mask,                                            
                                            modem_id=common.comms.xbee_modem_id(node_id),
                                            mac_slots=common.comms.xbee_mac_slots(node_id),
                                            serial_port=xbee_serial_port,
                                            xbee_config=common.comms.xbee_config(),
                                            xbee_hub_id='hub_id: ' + str(hub_index))

elif common.jaia_comms_mode == common.CommsMode.WIFI:
    link_block = config.template_substitute(templates_dir+'/link_udp.pb.cfg.in',
                                             subnet_mask=common.comms.subnet_mask,                                            
                                             modem_id=common.comms.wifi_modem_id(node_id),
                                             local_port=common.udp.wifi_udp_port(node_id),
                                             remotes=common.comms.wifi_remotes(node_id, common.comms.number_of_bots_max, fleet_index),
                                             mac_slots=common.comms.wifi_mac_slots(node_id))

liaison_jaiabot_config = config.template_substitute(templates_dir+'/_liaison_jaiabot_config.pb.cfg.in', mode='HUB')


if common.app == 'gobyd':    
    print(config.template_substitute(templates_dir+'/gobyd.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     link_block=link_block,
                                     required_clients='required_client: "goby_intervehicle_portal"'))
elif common.app == 'goby_intervehicle_portal':    
    print(config.template_substitute(templates_dir+'/goby_intervehicle_portal.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     persist_subscriptions='persist_subscriptions { name: "hub" dir: "' + debug_log_file_dir + '" }',
                                     link_block=link_block))
elif common.app == 'goby_opencpn_interface':
    print(config.template_substitute(templates_dir+'/hub/goby_opencpn_interface.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common))
elif common.app == 'goby_coroner':    
    print(config.template_substitute(templates_dir+'/goby_coroner.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common))
elif common.app == 'jaiabot_health':    
    print(config.template_substitute(templates_dir+'/hub/jaiabot_health.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     # do not power off or restart the simulator computer
                                     ignore_powerstate_changes=is_simulation(),
                                     is_in_sim=is_simulation()))
elif common.app == 'goby_liaison':
    liaison_port=30000
    if is_simulation():
        liaison_port=30000+node_id
    print(config.template_substitute(templates_dir+'/goby_liaison.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     http_port=liaison_port,
                                     jaiabot_config=liaison_jaiabot_config,
                                     load_protobufs=liaison_load_block))
elif common.app == 'goby_gps':
    print(config.template_substitute(templates_dir+'/goby_gps.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     gpsd_port=common.hub.gpsd_port(node_id),
                                     gpsd_device=common.hub.gpsd_device(node_id)))
elif common.app == 'jaiabot_simulator':
    print(config.template_substitute(templates_dir+'/hub/jaiabot_simulator.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common)) 
elif common.app == 'goby_logger':    
    print(config.template_substitute(templates_dir+'/goby_logger.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     goby_logger_dir=log_file_dir,
                                     goby_logger_group_regex=logger.group_regex))
elif common.app == 'jaiabot_hub_manager':
    print(config.template_substitute(templates_dir+'/hub/jaiabot_hub_manager.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     hub_id=hub_index,
                                     xbee_config=common.comms.xbee_config(),
                                     fleet_id=fleet_index))
elif common.app == 'jaiabot_failure_reporter':
    print(config.template_substitute(templates_dir+'/jaiabot_failure_reporter.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     goby_logger_dir=log_file_dir))
elif common.app == 'goby_terminate':
    print(config.template_substitute(templates_dir+'/goby_terminate.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common))
elif common.app == 'jaiabot_metadata':
    print(config.template_substitute(templates_dir+'/hub/jaiabot_metadata.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     xbee_info=xbee_info))
elif common.app == 'log_file':
    print(log_file_dir)
else:
    print(config.template_substitute(templates_dir + f'/hub/{common.app}.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block=interprocess_common))
