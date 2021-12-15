#!/usr/bin/env python3

# Generates Goby3 protobuf configuration using definitions and text substitution
# Usage: python3 example.pb.cfg.py app_name

import sys
import os
from common import config
import common, common.origin, common.vehicle, common.comms, common.sim

try:
    number_of_auvs=int(os.environ['jaia_n_auvs'])
except:
    config.fail('Must set jaia_n_auvs environmental variable, e.g. "jaia_n_auvs=10 jaia_auv_index=0 ./auv.launch"')

try:
    auv_index=int(os.environ['jaia_auv_index'])
except:
    config.fail('Must set jaia_auv_index environmental variable, e.g. "jaia_n_auvs=10 jaia_auv_index=0 ./auv.launch"')

log_file_dir = common.jaia_log_dir+ '/auv/' + str(auv_index)
debug_log_file_dir=log_file_dir 
os.makedirs(log_file_dir, exist_ok=True)
templates_dir=common.jaia_templates_dir

vehicle_id=auv_index+common.comms.topside_vehicle_id+1
wifi_modem_id = common.comms.wifi_modem_id(vehicle_id)
verbosities = \
{ 'gobyd':                                    { 'runtime': { 'tty': 'WARN', 'log': 'DEBUG1' }, 'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'goby_logger':                              { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'goby_frontseat_interface_basic_simulator': { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'jaiabot_simulator':                        { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'DEBUG2', 'log': 'QUIET' }},
  'jaiabot_bar30_publisher':                          { 'runtime': { 'tty': 'DEBUG2', 'log': 'DEBUG2' },  'simulation': { 'tty': 'DEBUG2', 'log': 'DEBUG2' }},
  'jaiabot_fusion':                        { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'DEBUG2', 'log': 'QUIET' }},
  'goby_gps':                                 { 'runtime': { 'tty': 'WARN', 'log': 'DEBUG2' },  'simulation': { 'tty': 'DEBUG2', 'log': 'QUIET' }}
}

app_common = common.app_block(verbosities, debug_log_file_dir, geodesy='')

interprocess_common = config.template_substitute(templates_dir+'/_interprocess.pb.cfg.in',
                                                 platform='auv'+str(auv_index))

link_wifi_block = config.template_substitute(templates_dir+'/_link_wifi.pb.cfg.in',
                                               subnet_mask=common.comms.subnet_mask,
                                               modem_id=wifi_modem_id,
                                               mac_slots=common.comms.wifi_mac_slots(vehicle_id))
link_block=link_wifi_block

liaison_jaiabot_config = config.template_substitute(templates_dir+'/_liaison_jaiabot_config.pb.cfg.in', mode='BOT')


if common.app == 'gobyd':    
    print(config.template_substitute(templates_dir+'/gobyd.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     link_block=link_block))
elif common.app == 'goby_logger':    
    print(config.template_substitute(templates_dir+'/goby_logger.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     goby_logger_dir=log_file_dir))
elif common.app == 'goby_frontseat_interface_basic_simulator':
    print(config.template_substitute(templates_dir+'/auv/frontseat.pb.cfg.in',
                                     moos_port=common.vehicle.moos_port(vehicle_id),
                                     app_block=common.app_block(verbosities,
                                                                debug_log_file_dir,
                                                                geodesy='geodesy { lat_origin: ' + str(common.origin.lat()) + ' lon_origin: ' + str(common.origin.lon()) + '}'),
                                     interprocess_block = interprocess_common,
                                     sim_start_lat = common.origin.lat(),
                                     sim_start_lon = common.origin.lon(),
                                     sim_port = common.vehicle.simulator_port(vehicle_id)))
elif common.app == 'goby_liaison':
    print(config.template_substitute(templates_dir+'/goby_liaison.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     http_port=30000+vehicle_id,
                                     jaiabot_config=liaison_jaiabot_config))
elif common.app == 'goby_moos_gateway':
    print(config.template_substitute(templates_dir+'/auv/goby_moos_gateway.pb.cfg.in',
                                     app_block=common.app_block(verbosities,
                                                                debug_log_file_dir,
                                                                geodesy='geodesy { lat_origin: ' + str(common.origin.lat()) + ' lon_origin: ' + str(common.origin.lon()) + '}'),
                                     interprocess_block = interprocess_common,
                                     moos_port=common.vehicle.moos_port(vehicle_id)))
elif common.app == 'jaiabot_simulator':
    print(config.template_substitute(templates_dir+'/auv/jaiabot_simulator.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     moos_port=common.vehicle.moos_simulator_port(vehicle_id),
                                     gpsd_simulator_udp_port=common.vehicle.gpsd_simulator_udp_port(vehicle_id)))
elif common.app == 'jaiabot_bar30-driver':
    print(config.template_substitute(templates_dir+'/auv/jaiabot_bar30-driver.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common))
elif common.app == 'jaiabot_adafruit-BNO055-driver':
    print(config.template_substitute(templates_dir+'/auv/jaiabot_adafruit-BNO055-driver.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common))
elif common.app == 'jaiabot_atlas-scientific-ezo-ec-driver':
    print(config.template_substitute(templates_dir+'/auv/jaiabot_atlas-scientific-ezo-ec-driver.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common))
elif common.app == 'salinity-subscriber':
    print(config.template_substitute(templates_dir+'/auv/salinity-subscriber.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common))
elif common.app == 'jaiabot_fusion':
    print(config.template_substitute(templates_dir+'/auv/jaiabot_fusion.pb.cfg.in',
                                     app_block=common.app_block(verbosities,
                                                                debug_log_file_dir,
                                                                geodesy='geodesy { lat_origin: ' + str(common.origin.lat()) + ' lon_origin: ' + str(common.origin.lon()) + '}'),
                                     interprocess_block = interprocess_common))
elif common.app == 'goby_gps':
    print(config.template_substitute(templates_dir+'/goby_gps.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     gpsd_port=common.vehicle.gpsd_port(vehicle_id),
                                     gpsd_device=common.vehicle.gpsd_device(vehicle_id)))
elif common.app == 'gpsd':
    print('-S {} -N {}'.format(common.vehicle.gpsd_port(vehicle_id), common.vehicle.gpsd_device(vehicle_id)))
elif common.app == 'moos':
    print(config.template_substitute(templates_dir+'/auv/auv.moos.in',
                                     moos_port=common.vehicle.moos_port(vehicle_id),
                                     moos_community='AUV' + str(auv_index),
                                     warp=common.sim.warp,
                                     lat_origin=common.origin.lat(),
                                     lon_origin=common.origin.lon(),
                                     bhv_file='/tmp/jaiabot_' + str(auv_index) + '.bhv'))
elif common.app == 'bhv':
    print(config.template_substitute(templates_dir+'/auv/auv.bhv.in'))    
elif common.app == 'moos_sim':
    print(config.template_substitute(templates_dir+'/auv/auv-sim.moos.in',
                                     moos_port=common.vehicle.moos_simulator_port(vehicle_id),
                                     moos_community='SIM' + str(auv_index),
                                     warp=common.sim.warp,
                                     lat_origin=common.origin.lat(),
                                     lon_origin=common.origin.lon()))
elif common.app == 'frontseat_sim':
    print(common.vehicle.simulator_port(vehicle_id))
else:
    sys.exit('App: {} not defined'.format(common.app))
