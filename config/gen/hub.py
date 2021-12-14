#!/usr/bin/env python3

# Generates Goby3 protobuf configuration using definitions and text substitution
# Usage: python3 example.pb.cfg.py app_name

import sys
import os
from common import config
import common, common.origin, common.hub, common.comms, common.sim

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
}

app_common = common.app_block(verbosities, debug_log_file_dir, geodesy='')

interprocess_common = config.template_substitute(templates_dir+'/_interprocess.pb.cfg.in',
                                                 platform='hub')


link_wifi_block = config.template_substitute(templates_dir+'/_link_wifi.pb.cfg.in',
                                                  subnet_mask=common.comms.subnet_mask,
                                                  modem_id=wifi_modem_id,
                                                  mac_slots=common.comms.wifi_mac_slots(vehicle_id))

liaison_jaiabot_config = config.template_substitute(templates_dir+'/_liaison_jaiabot_config.pb.cfg.in', mode='HUB')


if common.app == 'gobyd':    
    print(config.template_substitute(templates_dir+'/gobyd.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     link_block=link_wifi_block))
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
else:
    print(config.template_substitute(templates_dir+f'/hub/{common.app}.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common))
