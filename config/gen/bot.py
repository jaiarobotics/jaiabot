#!/usr/bin/env python3

# Generates Goby3 protobuf configuration using definitions and text substitution
# Usage: python3 example.pb.cfg.py app_name

import sys
import os
from common import config
from common import logger
from common import is_simulation, is_runtime
import common, common.bot, common.comms, common.sim, common.udp
from pathlib import Path

jaia_electronics_stack='0'
jaia_imu_type='bno055'
jaia_arduino_type='spi'

if "jaia_electronics_stack" in os.environ:
    jaia_electronics_stack=os.environ['jaia_electronics_stack']

if jaia_electronics_stack == '0':
    helm_app_tick=1
    helm_comms_tick=4
    total_after_dive_gps_fix_checks=15
if jaia_electronics_stack == '1':
    helm_app_tick=5
    helm_comms_tick=5
    total_after_dive_gps_fix_checks=75
elif jaia_electronics_stack == '2':
    helm_app_tick=5
    helm_comms_tick=5
    total_after_dive_gps_fix_checks=75
else:
    helm_app_tick=1
    helm_comms_tick=4
    total_after_dive_gps_fix_checks=15

if "jaia_imu_type" in os.environ:
    jaia_imu_type = os.environ["jaia_imu_type"]

if jaia_imu_type == "bno055":
    imu_detection_solution='RESTART_IMU_PY'
elif jaia_imu_type == 'bno085':
    imu_detection_solution='RESTART_IMU_PY'
else:
    imu_detection_solution='RESTART_IMU_PY'

if "jaia_arduino_type" in os.environ:
    jaia_arduino_type=os.environ['jaia_arduino_type']

if jaia_arduino_type == "spi":
    jaia_arduino_dev_location="/dev/ttyAMA1"
elif jaia_arduino_type == 'usb':
    jaia_arduino_dev_location="/dev/ttyUSB0"
else:
    jaia_arduino_dev_location="/dev/ttyAMA1"

try:
    bot_index=int(os.environ['jaia_bot_index'])
except:
    config.fail('Must set jaia_bot_index environmental variable, e.g. "jaia_bot_index=0  jaia_fleet_index=0  ./bot.launch"')

try:
    fleet_index=int(os.environ['jaia_fleet_index'])
except:
    config.fail('Must set jaia_fleet_index environmental variable, e.g. "jaia_bot_index=0 jaia_fleet_index=0 ./bot.launch"')

log_file_dir = common.jaia_log_dir+ '/bot/' + str(bot_index)
Path(log_file_dir).mkdir(parents=True, exist_ok=True)
debug_log_file_dir=log_file_dir 
templates_dir=common.jaia_templates_dir

bot_status_period=(bot_index * 10) + 1000

node_id=common.bot.bot_index_to_node_id(bot_index)

verbosities = \
{ 'gobyd':                                        { 'runtime': { 'tty': 'WARN', 'log': 'WARN'  }, 'simulation': { 'tty': 'WARN', 'log': 'WARN' }},
  'goby_intervehicle_portal':                     { 'runtime': { 'tty': 'WARN', 'log': 'WARN'  }, 'simulation': { 'tty': 'WARN', 'log': 'DEBUG2' }},
  'goby_liaison':                                 { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'WARN' }},
  'goby_gps':                                     { 'runtime': { 'tty': 'WARN', 'log': 'WARN'  }, 'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'goby_logger':                                  { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'goby_coroner':                                 { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'QUIET', 'log': 'QUIET' }},
  'jaiabot_health':                               { 'runtime': { 'tty': 'WARN', 'log': 'WARN'  },  'simulation': {'tty': 'WARN', 'log': 'QUIET'}},
  'jaiabot_metadata':                             { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'QUIET', 'log': 'VERBOSE' }},
  'jaiabot_fusion':                               { 'runtime': { 'tty': 'WARN', 'log': 'DEBUG1' },  'simulation': { 'tty': 'WARN', 'log': 'DEBUG1' }},
  'goby_moos_gateway':                            { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'QUIET', 'log': 'QUIET' }},
  'jaiabot_mission_manager':                      { 'runtime': { 'tty': 'WARN', 'log': 'DEBUG1'  }, 'simulation': { 'tty': 'WARN', 'log': 'DEBUG1' }},
  'jaiabot_pid_control':                          { 'runtime': { 'tty': 'WARN', 'log': 'WARN'  },  'simulation': {'tty': 'WARN', 'log': 'WARN'}},
  'jaiabot_simulator':                            { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'jaiabot_bluerobotics_pressure_sensor_driver':  { 'runtime': { 'tty': 'WARN', 'log': 'WARN'  }, 'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'jaiabot_atlas_scientific_ezo_ec_driver':       { 'runtime': { 'tty': 'WARN', 'log': 'WARN'  }, 'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'jaiabot_adafruit_BNO055_driver':               { 'runtime': { 'tty': 'WARN', 'log': 'WARN'  }, 'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'jaiabot_adafruit_BNO085_driver':               { 'runtime': { 'tty': 'WARN', 'log': 'WARN'  }, 'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'jaiabot_driver_arduino':                       { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'QUIET', 'log': 'QUIET' }},
  'jaiabot_engineering':                          { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'QUIET', 'log': 'QUIET' }},
  'goby_terminate':                               { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'jaiabot_failure_reporter':                     { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }}
}

app_common = common.app_block(verbosities, debug_log_file_dir)

interprocess_common = config.template_substitute(templates_dir+'/_interprocess.pb.cfg.in',
                                                 platform='bot'+str(bot_index)+'_fleet' + str(fleet_index))

try:
    jaiabot_driver_arduino_bounds = 'bounds { \n' + open('/etc/jaiabot/bounds.pb.cfg').read() + '\n}\n'
except FileNotFoundError:
    jaiabot_driver_arduino_bounds = 'bounds {}'

try:
    xbee_info = 'xbee { \n' + open('/etc/jaiabot/xbee_info.pb.cfg').read() + '\n}\n'
except FileNotFoundError:
    xbee_info = 'xbee {}'

if common.jaia_comms_mode == common.CommsMode.XBEE:
    subscribe_to_hub_on_start=''
    if is_simulation():
        xbee_serial_port='/tmp/xbeebot' + str(bot_index)
    else:
        xbee_serial_port='/dev/xbee'

    link_block = config.template_substitute(templates_dir+'/link_xbee.pb.cfg.in',
                                            subnet_mask=common.comms.subnet_mask,                                            
                                            modem_id=common.comms.xbee_modem_id(node_id),
                                            mac_slots=common.comms.xbee_mac_slots(node_id),
                                            serial_port=xbee_serial_port,
                                            xbee_config=common.comms.xbee_config(),
                                            xbee_hub_id='')

elif common.jaia_comms_mode == common.CommsMode.WIFI:
    subscribe_to_hub_on_start='subscribe_to_hub_on_start { hub_id: 0 modem_id: ' + str(common.comms.wifi_modem_id(common.comms.hub_node_id)) + ' changed: true }'
    link_block = config.template_substitute(templates_dir+'/link_udp.pb.cfg.in',
                                             subnet_mask=common.comms.subnet_mask,                                            
                                             modem_id=common.comms.wifi_modem_id(node_id),
                                             local_port=common.udp.wifi_udp_port(node_id),
                                             remotes=common.comms.wifi_remotes(node_id, common.comms.number_of_bots_max, fleet_index),
                                             mac_slots=common.comms.wifi_mac_slots(node_id))
    
liaison_jaiabot_config = config.template_substitute(templates_dir+'/_liaison_jaiabot_config.pb.cfg.in', mode='BOT')


if common.app == 'gobyd':    
    print(config.template_substitute(templates_dir+'/gobyd.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     required_clients='required_client: "gobyd" required_client: "jaiabot_fusion" required_client: "jaiabot_mission_manager" required_client: "jaiabot_engineering" required_client: "goby_intervehicle_portal"' # these are all required in the gobyd "hold" so that the initial hub info isn't published before they're ready (allowing persist to disk of last hub in use)
                                     ))
elif common.app == 'goby_intervehicle_portal':    
    print(config.template_substitute(templates_dir+'/goby_intervehicle_portal.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     persist_subscriptions='', # no persistent subscriptions on the bot as we get our subscriptions from the hub whenever we subscribe to the hub
                                     link_block=link_block))
elif common.app == 'goby_coroner':    
    print(config.template_substitute(templates_dir+'/goby_coroner.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common))
elif common.app == 'jaiabot_health':    
    print(config.template_substitute(templates_dir+'/bot/jaiabot_health.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     # do not power off or restart the simulator computer
                                     ignore_powerstate_changes=is_simulation(),
                                     is_in_sim=is_simulation()))
elif common.app == 'goby_logger':    
    print(config.template_substitute(templates_dir+'/goby_logger.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     goby_logger_dir=log_file_dir,
                                     goby_logger_group_regex=logger.group_regex))
elif common.app == 'goby_liaison' or common.app == 'goby_liaison_jaiabot':
    liaison_port=30000
    if is_simulation():
        liaison_port=30000+node_id
    print(config.template_substitute(templates_dir+'/goby_liaison.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     http_port=liaison_port,
                                     jaiabot_config=liaison_jaiabot_config,
                                     load_protobufs=''))
elif common.app == 'goby_moos_gateway':
    print(config.template_substitute(templates_dir+'/bot/goby_moos_gateway.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     moos_port=common.bot.moos_port(node_id)))
elif common.app == 'jaiabot_simulator':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_simulator.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     moos_port=common.bot.moos_simulator_port(node_id),
                                     gpsd_simulator_udp_port=common.bot.gpsd_simulator_udp_port(node_id),
                                     pressure_udp_port=common.udp.bar30_cpp_udp_port(node_id),
                                     salinity_udp_port=common.udp.atlas_ezo_cpp_udp_port(node_id)))
elif common.app == 'jaiabot_bluerobotics_pressure_sensor_driver':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_bluerobotics_pressure_sensor_driver.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     bind_port=common.udp.bar30_cpp_udp_port(node_id),
                                     remote_port=common.udp.bar30_py_udp_port(node_id),
                                     blue_robotics_pressure_report_in_simulation=is_simulation()))
elif common.app == 'jaiabot_adafruit_BNO055_driver':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_adafruit_BNO055_driver.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     adafruit_bno055_report_in_simulation=is_simulation()))
elif common.app == 'jaiabot_adafruit_BNO085_driver':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_adafruit_BNO085_driver.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     adafruit_bno085_report_in_simulation=is_simulation()))
elif common.app == 'jaiabot_atlas_scientific_ezo_ec_driver':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_atlas_scientific_ezo_ec_driver.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     bind_port=common.udp.atlas_ezo_cpp_udp_port(node_id),
                                     remote_port=common.udp.atlas_ezo_py_udp_port(node_id),
                                     atlas_salinity_report_in_simulation=is_simulation()))
elif common.app == 'salinity-subscriber':
    print(config.template_substitute(templates_dir+'/bot/salinity-subscriber.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common))
elif common.app == 'jaiabot_fusion':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_fusion.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     bot_id=bot_index,
                                     fusion_in_simulation=is_simulation(),
                                     bot_status_period=bot_status_period,
                                     imu_detection_solution=imu_detection_solution))
elif common.app == 'jaiabot_mission_manager':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_mission_manager.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     bot_id=bot_index,
                                     log_dir=log_file_dir,
                                     mission_manager_in_simulation=is_simulation(),
                                     subscribe_to_hub_on_start=subscribe_to_hub_on_start,
                                     total_after_dive_gps_fix_checks=total_after_dive_gps_fix_checks,
                                     fleet_id=fleet_index))
elif common.app == 'jaiabot_engineering':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_engineering.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     bot_id=bot_index,
                                     subscribe_to_hub_on_start=subscribe_to_hub_on_start))
elif common.app == 'jaiabot_failure_reporter':
    print(config.template_substitute(templates_dir+'/jaiabot_failure_reporter.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     goby_logger_dir=log_file_dir))
elif common.app == 'goby_terminate':
    print(config.template_substitute(templates_dir+'/goby_terminate.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common))
elif common.app == 'goby_gps':
    print(config.template_substitute(templates_dir+'/goby_gps.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     gpsd_port=common.bot.gpsd_port(node_id),
                                     gpsd_device=common.bot.gpsd_device(node_id)))
elif common.app == 'gpsd':
    print('-S {} -N {}'.format(common.bot.gpsd_port(node_id), common.bot.gpsd_device(node_id)))
elif common.app == 'moos':
    print(config.template_substitute(templates_dir+'/bot/bot.moos.in',
                                     moos_port=common.bot.moos_port(node_id),
                                     moos_community='BOT' + str(bot_index),
                                     warp=common.sim.warp,                                
                                     bhv_file='/tmp/jaiabot_' + str(bot_index) + '.bhv',
                                     helm_app_tick=helm_app_tick,
                                     helm_comms_tick=helm_comms_tick))
elif common.app == 'bhv':
    print(config.template_substitute(templates_dir+'/bot/bot.bhv.in'))    
elif common.app == 'moos_sim':
    print(config.template_substitute(templates_dir+'/bot/bot-sim.moos.in',
                                     moos_port=common.bot.moos_simulator_port(node_id),
                                     moos_community='SIM' + str(bot_index),
                                     warp=common.sim.warp))
elif common.app == 'moos_pmv':
    print(config.template_substitute(templates_dir+'/bot/marineviewer.moos.in',
                                     moos_port=common.bot.moos_port(node_id),
                                     moos_community='BOT' + str(bot_index),
                                     warp=common.sim.warp))
elif common.app == 'jaiabot_metadata':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_metadata.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     xbee_info=xbee_info))
elif common.app == 'frontseat_sim':
    print(common.vehicle.simulator_port(vehicle_id))
elif common.app == 'log_file':
    print(log_file_dir)
else:
    print(config.template_substitute(templates_dir+f'/bot/{common.app}.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     bot_id=bot_index,
                                     jaiabot_driver_arduino_bounds=jaiabot_driver_arduino_bounds,
                                     jaia_arduino_dev_location=jaia_arduino_dev_location))
