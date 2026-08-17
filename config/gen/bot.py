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
jaia_pam_connection_type='none'

if "jaia_electronics_stack" in os.environ:
    jaia_electronics_stack=os.environ['jaia_electronics_stack']

jaia_temperature_sensor_type = os.environ.get('jaia_temperature_sensor_type', default='bar30')
tsys01_enabled = jaia_temperature_sensor_type == 'tsys01'

helm_tick_config = common.bot.helm_tick_config(jaia_electronics_stack)
helm_app_tick=helm_tick_config['helm_app_tick']
helm_comms_tick=helm_tick_config['helm_comms_tick']
total_after_dive_gps_fix_checks=helm_tick_config['total_after_dive_gps_fix_checks']

if "jaia_imu_type" in os.environ:
    jaia_imu_type = os.environ["jaia_imu_type"]

if "jaia_imu_install_type" in os.environ:
    imu_install_type = os.environ["jaia_imu_install_type"]
else:
    # Default debian config option
    imu_install_type = "embedded"

if "jaia_arduino_type" in os.environ:
    jaia_arduino_type=os.environ['jaia_arduino_type']

jaia_arduino_dev_location=common.bot.arduino_dev_location(jaia_arduino_type)

if "jaia_pam_connection_type" in os.environ:
    jaia_pam_connection_type=os.environ['jaia_pam_connection_type']

jaia_data_offload_ignore_type="NONE"

if "jaia_data_offload_ignore_type" in os.environ:
    jaia_data_offload_ignore_type=os.environ['jaia_data_offload_ignore_type']

bot_type = os.environ.get("jaia_bot_type", default="HYDRO")

payload_flags = common.bot.payload_flags(bot_type)
pam_enabled=payload_flags['pam_enabled']
salinity_enabled=payload_flags['salinity_enabled']
bar30_enabled=payload_flags['bar30_enabled']

jaia_motor_harness_type="NONE"

if "jaia_motor_harness_type" in os.environ:
    jaia_motor_harness_type=os.environ['jaia_motor_harness_type']

try:
    bot_id=int(os.environ['jaia_bot_id'])
except:
    config.fail('Must set jaia_bot_id environmental variable, e.g. "jaia_bot_id=0  jaia_fleet_id=0  ./bot.launch"')

try:
    fleet_id=int(os.environ['jaia_fleet_id'])
except:
    config.fail('Must set jaia_fleet_id environmental variable, e.g. "jaia_bot_id=0 jaia_fleet_id=0 ./bot.launch"')

log_file_dir = common.jaia_log_dir+ '/bot/' + str(bot_id)

Path(log_file_dir).mkdir(parents=True, exist_ok=True)
debug_log_file_dir=log_file_dir 
templates_dir=common.jaia_templates_dir

liaison_load_block = config.template_substitute(templates_dir+'/bot/_liaison_load.pb.cfg.in')

# Milliseconds
bot_status_period=1000

node_id=common.bot.bot_id_to_node_id(bot_id)

verbosities = \
{ 'gobyd':                                        { 'runtime': { 'tty': 'WARN', 'log': 'WARN'  }, 'simulation': { 'tty': 'WARN', 'log': 'WARN' }},
  'goby_intervehicle_portal':                     { 'runtime': { 'tty': 'WARN', 'log': 'WARN'  }, 'simulation': { 'tty': 'WARN', 'log': 'WARN' }},
  'goby_liaison':                                 { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'goby_gps':                                     { 'runtime': { 'tty': 'WARN', 'log': 'QUIET'  }, 'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'goby_logger':                                  { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'goby_coroner':                                 { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'jaiabot_health':                               { 'runtime': { 'tty': 'WARN', 'log': 'WARN'  },  'simulation': {'tty': 'WARN', 'log': 'WARN'}},
  'jaiabot_metadata':                             { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'jaiabot_fusion':                               { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'goby_moos_gateway':                            { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'jaiabot_mission_manager':                      { 'runtime': { 'tty': 'WARN', 'log': 'WARN'  }, 'simulation': { 'tty': 'WARN', 'log': 'WARN' }},
  'jaiabot_sensors':                              { 'runtime': { 'tty': 'WARN', 'log': 'WARN'  }, 'simulation': { 'tty': 'WARN', 'log': 'WARN' }},
  'jaiabot_pid_control':                          { 'runtime': { 'tty': 'WARN', 'log': 'QUIET'  },  'simulation': {'tty': 'WARN', 'log': 'QUIET'}},
  'jaiabot_simulator':                            { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'jaiabot_udp_gateway':                          { 'runtime': { 'tty': 'WARN', 'log': 'WARN'  }, 'simulation': { 'tty': 'WARN', 'log': 'WARN' }},
  'jaiabot_driver_arduino':                       { 'runtime': { 'tty': 'WARN', 'log': 'WARN' },  'simulation': { 'tty': 'WARN', 'log': 'WARN' }},
  'jaiabot_engineering':                          { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'goby_terminate':                               { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'jaiabot_failure_reporter':                     { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'jaiabot_driver_camera':                        { 'runtime': { 'tty': 'WARN', 'log': 'WARN' },  'simulation': { 'tty': 'WARN', 'log': 'WARN' }},
  'jaiabot_mission_repeater':                     { 'runtime': { 'tty': 'WARN', 'log': 'WARN' },  'simulation': { 'tty': 'WARN', 'log': 'WARN' }},
  'jaiabot_comms_manager':                        { 'runtime': { 'tty': 'WARN', 'log': 'WARN' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'jaiabot_turner_c_fluor_sensor_driver':         { 'runtime': { 'tty': 'WARN', 'log': 'WARN' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'jaiabot_aml_sensor_driver':                    { 'runtime': { 'tty': 'WARN', 'log': 'WARN' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'jaiabot_ctd_manager':                          { 'runtime': { 'tty': 'WARN', 'log': 'WARN' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
}

app_common = common.app_block(verbosities, debug_log_file_dir)

interprocess_common = config.template_substitute(templates_dir+'/_interprocess.pb.cfg.in',
                                                 platform='bot'+str(bot_id)+'_fleet' + str(fleet_id))

jaiabot_driver_arduino_bounds = common.bot.arduino_bounds()
xbee_info = common.bot.xbee_info()
fluorometer_coefficients = common.bot.fluorometer_coefficients()

ack_timeout=10
iridium_ack_timeout=120
sub_buffer_config = config.template_substitute(templates_dir+'/_sub_buffer.pb.cfg.in')
link_block=''
subscribes_block=''
if common.CommsMode.XBEE in common.jaia_comms_modes:
    subscribes_block+='''subscribe {
    link: LINK_XBEE
    subscribe_on_start: true
    resubscribe: true
    resubscribe_interval: 60
}\n'''
if common.CommsMode.WIFI in common.jaia_comms_modes:
    subscribes_block+='''subscribe {
    link: LINK_WIFI
    subscribe_on_start: true
    resubscribe: true
    resubscribe_interval: 60
}\n'''

if common.CommsMode.IRIDIUM in common.jaia_comms_modes:
    subscribes_block+='''subscribe {
    link: LINK_IRIDIUM
    subscribe_on_start: true
    resubscribe: true
    resubscribe_interval: 150
}\n'''

# link_block is only consumed by the goby_intervehicle_portal app below. Building it
# (in particular wifi_remotes/wifi_hub_remotes, which shell out to the 'jaia ip' tool
# once per possible node) is expensive, so skip it entirely for every other app.
if common.app == 'goby_intervehicle_portal':
    if common.CommsMode.XBEE in common.jaia_comms_modes:
        if is_simulation():
            xbee_serial_port='/tmp/xbeebot' + str(bot_id)
        else:
            xbee_serial_port='/dev/xbee'

        try:
            xbee_encryption_password=os.environ['jaia_rf_encryption_password']
        except:
            xbee_encryption_password=""

        link_block += config.template_substitute(templates_dir+'/link_xbee.pb.cfg.in',
                                                subnet_mask=common.comms.subnet_mask,
                                                modem_id=common.comms.modem_id("xbee",node_id),
                                                mac_slots=common.comms.xbee_mac_slots(node_id),
                                                serial_port=xbee_serial_port,
                                                is_in_sim=is_simulation(),
                                                use_encryption='true' if xbee_encryption_password else 'false',
                                                encryption_password=xbee_encryption_password,
                                                fleet_id=fleet_id,
                                                sub_buffer=sub_buffer_config,
                                                ack_timeout=ack_timeout)

    if common.CommsMode.WIFI in common.jaia_comms_modes:
        default_hub_id=1

        link_block += config.template_substitute(templates_dir+'/link_udp.pb.cfg.in',
                                                 subnet_mask=common.comms.subnet_mask,
                                                 modem_id=common.comms.modem_id("wifi",node_id),
                                                 local_port=common.udp.wifi_udp_port(node_id),
                                                 remotes=common.comms.wifi_remotes(node_id, fleet_id, default_hub_id),
                                                 hub_endpoints=common.comms.wifi_hub_remotes(node_id, fleet_id),
                                                 mac_slots=common.comms.wifi_mac_slots(node_id),
                                                 sub_buffer=sub_buffer_config,
                                                 ack_timeout=ack_timeout,
                                                 ipv6='')

    if common.CommsMode.IRIDIUM in common.jaia_comms_modes:
        if is_simulation():
            iridium_serial_port='/tmp/iridium' + str(bot_id)
        else:
            iridium_serial_port='/dev/iridium'

        link_block += config.template_substitute(templates_dir+'/link_iridium.pb.cfg.in',
                                                 subnet_mask=common.comms.subnet_mask,
                                                 modem_id=common.comms.modem_id("iridium",node_id),
                                                 serial_port=iridium_serial_port,
                                                 mac_slots=common.comms.iridium_mac_slots(node_id),
                                                 sub_buffer=sub_buffer_config,
                                                 ack_timeout=iridium_ack_timeout)
    
liaison_jaiabot_config = config.template_substitute(templates_dir+'/_liaison_jaiabot_config.pb.cfg.in', mode='BOT')

liaison_bind_addr='0.0.0.0'
if common.is_vfleet:
    liaison_bind_addr='0::0'

# IMU config
udp_gateway_port = common.udp.udp_gateway_port(node_id)
imu_detection_solution='REPORT_IMU'

imu_type = common.bot.imu_type(jaia_imu_type)
total_imu_issue_checks = common.bot.total_imu_issue_checks(imu_install_type)
pressure_sensor_type = common.bot.pressure_sensor_type()


if common.app == 'gobyd':    
    print(config.template_substitute(templates_dir+'/gobyd.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     required_clients='required_client: "gobyd" required_client: "jaiabot_comms_manager" required_client: "jaiabot_mission_manager" required_client: "jaiabot_engineering" required_client: "goby_intervehicle_portal"' # these are all required in the gobyd "hold" so that the initial subscribe request from jaiabot_comms_manager is received by all the intervehicle subscribers
                                     ))
elif common.app == 'goby_intervehicle_portal':    
    print(config.template_substitute(templates_dir+'/goby_intervehicle_portal.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     link_block=link_block))
elif common.app == 'goby_coroner':    
    print(config.template_substitute(templates_dir+'/goby_coroner.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common))
elif common.app == 'jaiabot_health':
    ignore_powerstate_changes=is_simulation() and not common.is_vfleet
    print(config.template_substitute(templates_dir+'/bot/jaiabot_health.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     bind_port=common.udp.motor_cpp_udp_port(),
                                     remote_port=common.udp.motor_py_udp_port(),
                                     # do not power off or restart the simulator computer unless we're a VirtualFleet
                                     ignore_powerstate_changes=ignore_powerstate_changes,
                                     is_in_sim=is_simulation(),
                                     motor_harness_type=jaia_motor_harness_type))
elif common.app == 'goby_logger':    
    print(config.template_substitute(templates_dir+'/goby_logger.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     goby_logger_dir=log_file_dir,
                                     goby_logger_group_regex=logger.group_regex,
                                     log_on_startup='true'))
elif common.app == 'goby_liaison':
    liaison_port=30000
    if is_simulation():
        liaison_port=30100+bot_id
    print(config.template_substitute(templates_dir+'/goby_liaison.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     http_port=liaison_port,
                                     http_address=liaison_bind_addr,
                                     jaiabot_config=liaison_jaiabot_config,
                                     load_protobufs=liaison_load_block))
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
                                     udp_gateway_port=udp_gateway_port))
elif common.app == 'jaiabot_udp_gateway':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_udp_gateway.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     in_simulation=is_simulation(),
                                     udp_gateway_port=udp_gateway_port,
                                     pam_enabled=str(pam_enabled).lower(),
                                     salinity_enabled=str(salinity_enabled).lower(),
                                     bar30_enabled=str(bar30_enabled).lower(),
                                     tsys01_enabled=str(tsys01_enabled).lower()))
elif common.app == 'jaiabot_fusion':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_fusion.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     bot_id=bot_id,
                                     bot_type=bot_type,
                                     fusion_in_simulation=is_simulation(),
                                     bot_status_period=bot_status_period,
                                     total_imu_issue_checks=total_imu_issue_checks,
                                     imu_detection_solution=imu_detection_solution,
                                     bot_gpsd_device=common.bot.gpsd_device(node_id)))
elif common.app == 'jaiabot_mission_manager':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_mission_manager.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     bot_id=bot_id,
                                     log_dir=log_file_dir,
                                     bot_log_staging_dir=common.bot_log_staging_dir,
                                     bot_log_archive_dir=common.bot_log_archive_dir,
                                     mission_manager_in_simulation=is_simulation(),
                                     total_after_dive_gps_fix_checks=total_after_dive_gps_fix_checks,
                                     fleet_id=fleet_id,
                                     jaia_data_offload_ignore_type=jaia_data_offload_ignore_type,
                                     subnet_mask=common.comms.subnet_mask,
                                     camera_available=common.camera_available))

elif common.app == 'jaiabot_sensors':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_sensors.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block=interprocess_common,
                                     port='/dev/ttyUSB0',
                                     baud=115200,
                                     fluorometer_coefficients=fluorometer_coefficients))
elif common.app == 'jaiabot_engineering':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_engineering.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     bot_id=bot_id,
                                     subnet_mask=common.comms.subnet_mask))
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
                                     gpsd_port=common.bot.gpsd_port(node_id)))
elif common.app == 'gpsd':
    print('-S {} -N {}'.format(common.bot.gpsd_port(node_id), common.bot.gpsd_device(node_id)))
elif common.app == 'moos':
    print(config.template_substitute(templates_dir+'/bot/bot.moos.in',
                                     moos_port=common.bot.moos_port(node_id),
                                     moos_community='BOT' + str(bot_id),
                                     warp=common.sim.warp,                                
                                     bhv_file='/tmp/jaiabot_' + str(bot_id) + '.bhv',
                                     helm_app_tick=helm_app_tick,
                                     helm_comms_tick=helm_comms_tick))
elif common.app == 'bhv':
    print(config.template_substitute(templates_dir+'/bot/bot.bhv.in'))    
elif common.app == 'moos_sim':
    print(config.template_substitute(templates_dir+'/bot/bot-sim.moos.in',
                                     moos_port=common.bot.moos_simulator_port(node_id),
                                     moos_community='SIM' + str(bot_id),
                                     warp=common.sim.warp))
elif common.app == 'moos_pmv':
    print(config.template_substitute(templates_dir+'/bot/marineviewer.moos.in',
                                     moos_port=common.bot.moos_port(node_id),
                                     moos_community='BOT' + str(bot_id),
                                     warp=common.sim.warp))
elif common.app == 'jaiabot_metadata':
    print(config.template_substitute(templates_dir+'/jaiabot_metadata.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     xbee_info=xbee_info,
                                     is_simulation=str(is_simulation()).lower(),
                                     node_id=f'bot_id: {bot_id}',
                                     fleet_id=fleet_id))
elif common.app == 'frontseat_sim':
    print(common.vehicle.simulator_port(vehicle_id))
elif common.app == 'log_file':
    print(log_file_dir)
elif common.app == 'jaiabot_mission_repeater':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_mission_repeater.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     bot_id=bot_id))
elif common.app == 'jaiabot_driver_camera':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_driver_camera.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     serial_camera_port=common.bot.serial_camera_port(bot_id)))
elif common.app == 'jaiabot_comms_manager':
    print(config.template_substitute(templates_dir+'/jaiabot_comms_manager.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     subscribes=subscribes_block,
                                     subnet_mask=common.comms.subnet_mask))
elif common.app == 'jaiabot_turner_c_fluor_sensor_driver':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_turner_c_fluor_sensor_driver.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block=interprocess_common,
                                     fluorometer_coefficients=fluorometer_coefficients))
elif common.app == 'jaiabot_aml_sensor_driver':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_aml_sensor_driver.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block=interprocess_common))
elif common.app == 'jaiabot_ctd_manager':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_ctd_manager.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     log_dir=log_file_dir))
else:
    print(config.template_substitute(templates_dir+f'/bot/{common.app}.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     bot_id=bot_id,
                                     fleet_id=fleet_id,
                                     jaiabot_driver_arduino_bounds=jaiabot_driver_arduino_bounds,
                                     jaia_arduino_dev_location=jaia_arduino_dev_location,
                                     udp_gateway_port=udp_gateway_port,
                                     imu_type=imu_type,
                                     pressure_sensor_type=pressure_sensor_type,
                                     log_file_dir=log_file_dir))
