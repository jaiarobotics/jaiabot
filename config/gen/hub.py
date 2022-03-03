#!/usr/bin/env python3

# Generates Goby3 protobuf configuration using definitions and text substitution
# Usage: python3 example.pb.cfg.py app_name

import sys
import os
from common import config
from common import is_simulation, is_runtime
import common, common.hub, common.comms, common.sim, common.vehicle, common.udp

try:
    number_of_bots=int(os.environ['jaia_n_bots'])
except:
    config.fail('Must set jaia_n_bots environmental variable, e.g. "jaia_n_bots=10 jaia_fleet_index=0 ./hub.launch"')

try:
    fleet_index=int(os.environ['jaia_fleet_index'])
except:
    config.fail('Must set jaia_fleet_index environmental variable, e.g. "jaia_n_bots=10 jaia_fleet_index=0 ./hub.launch"')

log_file_dir = common.jaia_log_dir+ '/hub'
os.makedirs(log_file_dir, exist_ok=True)
debug_log_file_dir=log_file_dir 

vehicle_id = 0 
wifi_modem_id = common.comms.wifi_modem_id(vehicle_id)
vehicle_type= 'HUB'

templates_dir=common.jaia_templates_dir

liaison_load_block = config.template_substitute(templates_dir+'/hub/_liaison_load.pb.cfg.in')

verbosities = \
{ 'gobyd':                  { 'runtime': { 'tty': 'WARN', 'log': 'DEBUG1' }, 'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'goby_opencpn_interface': { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'goby_liaison':           { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'goby_logger':            { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'goby_gps':               { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'DEBUG2', 'log': 'QUIET' }},
  'jaiabot_hub_manager':     { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'QUIET', 'log': 'DEBUG2' }},
  'jaiabot_web_portal':     { 'runtime': { 'tty': 'DEBUG1', 'log': 'DEBUG1' },  'simulation': { 'tty': 'QUIET', 'log': 'DEBUG2' }},
}

app_common = common.app_block(verbosities, debug_log_file_dir, geodesy='')

interprocess_common = config.template_substitute(templates_dir+'/_interprocess.pb.cfg.in',
                                                 platform='hub'+'_fleet' + str(fleet_index))


if is_runtime():
    link_block = config.template_substitute(templates_dir+'/link_xbee.pb.cfg.in',
                                             subnet_mask=common.comms.subnet_mask,                                            
                                             modem_id=common.comms.xbee_modem_id(vehicle_id),
                                             mac_slots=common.comms.xbee_mac_slots(vehicle_id))

if is_simulation():
    link_block = config.template_substitute(templates_dir+'/link_udp.pb.cfg.in',
                                             subnet_mask=common.comms.subnet_mask,                                            
                                             modem_id=common.comms.wifi_modem_id(vehicle_id),
                                             local_port=common.udp.wifi_udp_port(vehicle_id),
                                             remotes=common.comms.wifi_remotes(vehicle_id, number_of_bots),
                                             mac_slots=common.comms.wifi_mac_slots(vehicle_id))

liaison_jaiabot_config = config.template_substitute(templates_dir+'/_liaison_jaiabot_config.pb.cfg.in', mode='HUB')


if common.app == 'gobyd':    
    print(config.template_substitute(templates_dir+'/gobyd.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     link_block=link_block,
                                     persist_subscriptions='persist_subscriptions { name: "hub" dir: "' + debug_log_file_dir + '" }'))
elif common.app == 'goby_opencpn_interface':
    print(config.template_substitute(templates_dir+'/hub/goby_opencpn_interface.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common))
elif common.app == 'goby_liaison':
    print(config.template_substitute(templates_dir+'/goby_liaison.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     http_port=30000+vehicle_id,
                                     jaiabot_config=liaison_jaiabot_config,
                                     load_protobufs=liaison_load_block))
elif common.app == 'goby_gps':
    print(config.template_substitute(templates_dir+'/goby_gps.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     gpsd_port=common.hub.gpsd_port(vehicle_id),
                                     gpsd_device=common.hub.gpsd_device(vehicle_id)))   
elif common.app == 'goby_logger':    
    print(config.template_substitute(templates_dir+'/goby_logger.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     goby_logger_dir=log_file_dir))
elif common.app == 'jaiabot_hub_manager':
    start_modem_id=common.comms.wifi_modem_id(common.vehicle.bot_index_to_vehicle_id(0))
    end_modem_id=common.comms.wifi_modem_id(common.vehicle.bot_index_to_vehicle_id(number_of_bots))
    all_bot_ids='managed_bot_modem_id: ' + str(list(range(start_modem_id, end_modem_id)))
    print(config.template_substitute(templates_dir+'/hub/jaiabot_hub_manager.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common, managed_bot_ids=all_bot_ids))
else:
    print(config.template_substitute(templates_dir + f'/hub/{common.app}.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block=interprocess_common))
