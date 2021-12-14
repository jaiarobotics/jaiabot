#!/usr/bin/env python3

# Generates Goby3 protobuf configuration using definitions and text substitution
# Usage: python3 example.pb.cfg.py app_name

import sys
import os
from common import config
import common, common.vehicle, common.comms, common.sim, common.udp

try:
    number_of_bots=int(os.environ['jaia_n_bots'])
except:
    config.fail('Must set jaia_n_bots environmental variable, e.g. "jaia_n_bots=10 jaia_bot_index=0 ./bot.launch"')

try:
    bot_index=int(os.environ['jaia_bot_index'])
except:
    config.fail('Must set jaia_bot_index environmental variable, e.g. "jaia_n_bots=10 jaia_bot_index=0 ./bot.launch"')

log_file_dir = common.jaia_log_dir+ '/bot/' + str(bot_index)
debug_log_file_dir=log_file_dir 
os.makedirs(log_file_dir, exist_ok=True)
templates_dir=common.jaia_templates_dir

vehicle_id=common.vehicle.bot_index_to_vehicle_id(bot_index)

verbosities = \
{ 'gobyd':                                    { 'runtime': { 'tty': 'WARN', 'log': 'DEBUG1' }, 'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'goby_logger':                              { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'goby_frontseat_interface_basic_simulator': { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'jaiabot_simulator':                        { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'DEBUG2', 'log': 'QUIET' }},
  'jaiabot_bar30_publisher':                          { 'runtime': { 'tty': 'DEBUG2', 'log': 'DEBUG2' },  'simulation': { 'tty': 'DEBUG2', 'log': 'DEBUG2' }},
  'jaiabot_fusion':                        { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'DEBUG2', 'log': 'QUIET' }},
  'goby_gps':                                 { 'runtime': { 'tty': 'WARN', 'log': 'DEBUG2' },  'simulation': { 'tty': 'DEBUG2', 'log': 'QUIET' }},
  'jaiabot_mission_manager':                                 { 'runtime': { 'tty': 'WARN', 'log': 'DEBUG2' },  'simulation': { 'tty': 'DEBUG2', 'log': 'QUIET' }}
}

app_common = common.app_block(verbosities, debug_log_file_dir, geodesy='')

interprocess_common = config.template_substitute(templates_dir+'/_interprocess.pb.cfg.in',
                                                 platform='bot'+str(bot_index))

link_wifi_block = config.template_substitute(templates_dir+'/_link_wifi.pb.cfg.in',
                                             subnet_mask=common.comms.subnet_mask,                                            
                                             modem_id=common.comms.wifi_modem_id(vehicle_id),
                                             local_port=common.udp.wifi_udp_port(vehicle_id),
                                             remotes=common.comms.wifi_remotes(vehicle_id, number_of_bots),
                                             mac_slots=common.comms.wifi_mac_slots(vehicle_id))
                                        
link_block=link_wifi_block

liaison_jaiabot_config = config.template_substitute(templates_dir+'/_liaison_jaiabot_config.pb.cfg.in', mode='BOT')


if common.app == 'gobyd':    
    print(config.template_substitute(templates_dir+'/gobyd.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     link_block=link_block,
                                     persist_subscriptions='persist_subscriptions { name: "bot" dir: "' + debug_log_file_dir + '" }'))
elif common.app == 'goby_logger':    
    print(config.template_substitute(templates_dir+'/goby_logger.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     goby_logger_dir=log_file_dir))
elif common.app == 'goby_liaison':
    print(config.template_substitute(templates_dir+'/goby_liaison.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     http_port=30000+vehicle_id,
                                     jaiabot_config=liaison_jaiabot_config,
                                     load_protobufs=''))
elif common.app == 'goby_moos_gateway':
    print(config.template_substitute(templates_dir+'/bot/goby_moos_gateway.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     moos_port=common.vehicle.moos_port(vehicle_id)))
elif common.app == 'jaiabot_simulator':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_simulator.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     moos_port=common.vehicle.moos_simulator_port(vehicle_id),
                                     gpsd_simulator_udp_port=common.vehicle.gpsd_simulator_udp_port(vehicle_id)))
elif common.app == 'jaiabot_bar30-driver':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_bar30-driver.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common))
elif common.app == 'jaiabot_adafruit-BNO055-driver':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_adafruit-BNO055-driver.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common))
elif common.app == 'jaiabot_atlas-scientific-ezo-ec-driver':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_atlas-scientific-ezo-ec-driver.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common))
elif common.app == 'salinity-subscriber':
    print(config.template_substitute(templates_dir+'/bot/salinity-subscriber.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common))
elif common.app == 'jaiabot_fusion':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_fusion.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     bot_id=bot_index))
elif common.app == 'jaiabot_mission_manager':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_mission_manager.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     bot_id=bot_index))
elif common.app == 'goby_gps':
    print(config.template_substitute(templates_dir+'/goby_gps.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     gpsd_port=common.vehicle.gpsd_port(vehicle_id),
                                     gpsd_device=common.vehicle.gpsd_device(vehicle_id)))
elif common.app == 'gpsd':
    print('-S {} -N {}'.format(common.vehicle.gpsd_port(vehicle_id), common.vehicle.gpsd_device(vehicle_id)))
elif common.app == 'moos':
    print(config.template_substitute(templates_dir+'/bot/bot.moos.in',
                                     moos_port=common.vehicle.moos_port(vehicle_id),
                                     moos_community='BOT' + str(bot_index),
                                     warp=common.sim.warp,                                
                                     bhv_file='/tmp/jaiabot_' + str(bot_index) + '.bhv'))
elif common.app == 'bhv':
    print(config.template_substitute(templates_dir+'/bot/bot.bhv.in'))    
elif common.app == 'moos_sim':
    print(config.template_substitute(templates_dir+'/bot/bot-sim.moos.in',
                                     moos_port=common.vehicle.moos_simulator_port(vehicle_id),
                                     moos_community='SIM' + str(bot_index),
                                     warp=common.sim.warp))
elif common.app == 'moos_pmv':
    print(config.template_substitute(templates_dir+'/bot/marineviewer.moos.in',
                                     moos_port=common.vehicle.moos_port(vehicle_id),
                                     moos_community='BOT' + str(bot_index),
                                     warp=common.sim.warp))
elif common.app == 'frontseat_sim':
    print(common.vehicle.simulator_port(vehicle_id))
else:
    print(config.template_substitute(templates_dir+f'/auv/{common.app}.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common))
