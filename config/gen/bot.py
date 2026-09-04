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
jaia_tail_serial_number = os.environ.get('jaia_tail_serial_number', default='unknown_serial_number')
jaia_bot_vin = os.environ.get('jaia_bot_vin', default='unknown_vin')

if "jaia_electronics_stack" in os.environ:
    jaia_electronics_stack=os.environ['jaia_electronics_stack']

jaia_temperature_sensor_type = os.environ.get('jaia_temperature_sensor_type', default='bar30')

jaia_additional_sensors = [sensor for sensor in
                           os.environ.get('jaia_additional_sensors', default='none').split(',')
                           if sensor]

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

if "jaia_imu_install_type" in os.environ:
    imu_install_type = os.environ["jaia_imu_install_type"]
else:
    # Default debian config option
    imu_install_type = "embedded"

if "jaia_arduino_type" in os.environ:
    jaia_arduino_type=os.environ['jaia_arduino_type']

if jaia_arduino_type == "spi":
    jaia_arduino_dev_location="/dev/ttyAMA1"
elif jaia_arduino_type == 'usb':
    jaia_arduino_dev_location="/dev/arduino"
else:
    jaia_arduino_dev_location="/dev/ttyAMA1"

if "jaia_pam_connection_type" in os.environ:
    jaia_pam_connection_type=os.environ['jaia_pam_connection_type']

jaia_data_offload_ignore_type="NONE"

if "jaia_data_offload_ignore_type" in os.environ:
    jaia_data_offload_ignore_type=os.environ['jaia_data_offload_ignore_type']

if common.CommsMode.IRIDIUM in common.jaia_comms_modes: 
    jaia_iridium_enabled=True
else:
    jaia_iridium_enabled=False
bot_type = os.environ.get("jaia_bot_type", default="HYDRO")

echo_enabled=(bot_type == "ECHO")
# Ignore health warnings from UDP gateway if data comes from BIO payload board
salinity_enabled=(bot_type != "BIO")
bar30_enabled=(bot_type != "BIO")

# Only enable TSYS01 driver if the Bot is not a BIO and the TSYS01 is the selected temperature sensor type
tsys01_enabled=(jaia_temperature_sensor_type == 'tsys01' and bot_type != 'BIO')

# The mirror of the above: on a BIO bot the TSYS01 is the payload board's job, so tell
# jaiabot_sensors it is expected. That stanza's presence (has_tsys01) is what lets the
# app warn when a bot configured for a TSYS01 never receives any TSYS01 data.
if jaia_temperature_sensor_type == 'tsys01' and bot_type == 'BIO':
    tsys01_config = ('tsys01 {\n'
                     '    sample_rate: 10\n'
                     '    report_timeout_seconds: 20\n'
                     '    resend_cfg_timeout_seconds: 20\n'
                     '}')
else:
    tsys01_config = ''

jaia_motor_harness_type="NONE"

if "jaia_motor_harness_type" in os.environ:
    jaia_motor_harness_type=os.environ['jaia_motor_harness_type']

bot_index = -1
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

liaison_load_block = config.template_substitute(templates_dir+'/bot/_liaison_load.pb.cfg.in')

# Milliseconds
bot_status_period=1000

node_id=common.bot.bot_index_to_node_id(bot_index)

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
                                                 platform='bot'+str(bot_index)+'_fleet' + str(fleet_index))

try:
    jaiabot_driver_arduino_bounds = 'bounds { \n' + open('/etc/jaiabot/bounds.pb.cfg').read() + '\n}\n'
except FileNotFoundError:
    jaiabot_driver_arduino_bounds = 'bounds {}'

try:
    xbee_info = 'xbee { \n' + open('/etc/jaiabot/xbee_info.pb.cfg').read() + '\n}\n'
except FileNotFoundError:
    xbee_info = 'xbee {}'

def read_fluorometer_coefficients(*paths):
    for path in paths:
        try:
            return 'fluorometer_coefficients { \n' + open(path).read() + '\n}\n'
        except FileNotFoundError:
            continue
    return 'fluorometer_coefficients {}'

# bots provisioned before dual fluorometer support have a single unnumbered file, which
# belongs to the first fluorometer
fluorometer_coefficients = read_fluorometer_coefficients('/etc/jaiabot/fluorometer_coefficients.pb.cfg')
fluorometer_coefficients_2 = read_fluorometer_coefficients('/etc/jaiabot/fluorometer_coefficients_2.pb.cfg')

# The payload board announces two fluorometer channels whether or not a second sensor is
# wired, and an unconnected channel reads as a valid zero rather than failing, so the
# firmware cannot tell us which bots actually have one. The presence of this stanza
# (has_fluorometer_2) is what lets jaiabot_sensors launch the second driver thread; without
# it the phantom instance is ignored instead of reported as data.
if 'turner_c_fluor_2' in jaia_additional_sensors:
    fluorometer_2_config = ('fluorometer_2 {\n'
                            '    sample_rate: 10\n'
                            '    report_timeout_seconds: 20\n'
                            '    resend_cfg_timeout_seconds: 20\n'
                            '    ' + fluorometer_coefficients_2 + '\n'
                            '}')
else:
    fluorometer_2_config = ''

ack_timeout=10
iridium_ack_timeout=120
sub_buffer_config = config.template_substitute(templates_dir+'/_sub_buffer.pb.cfg.in')
link_block=''
subscribes_block=''
if common.CommsMode.XBEE in common.jaia_comms_modes:
    if is_simulation():
        xbee_serial_port='/tmp/xbeebot' + str(bot_index)
    else:
        xbee_serial_port='/dev/xbee'

    try:
        xbee_encryption_password=os.environ['jaia_rf_encryption_password']
    except:    
        xbee_encryption_password=""

    subscribes_block+='''subscribe {
    link: LINK_XBEE
    subscribe_on_start: true
    resubscribe: true
    resubscribe_interval: 60
}\n'''

        
    link_block += config.template_substitute(templates_dir+'/link_xbee.pb.cfg.in',
                                            subnet_mask=common.comms.subnet_mask,                                            
                                            modem_id=common.comms.modem_id("xbee",node_id),
                                            mac_slots=common.comms.xbee_mac_slots(node_id),
                                            serial_port=xbee_serial_port,
                                            is_in_sim=is_simulation(),
                                            use_encryption='true' if xbee_encryption_password else 'false',
                                            encryption_password=xbee_encryption_password,
                                            fleet_id=fleet_index,
                                            sub_buffer=sub_buffer_config,
                                            ack_timeout=ack_timeout)

if common.CommsMode.WIFI in common.jaia_comms_modes:
    default_hub_id=1

    subscribes_block+='''subscribe {
    link: LINK_WIFI
    subscribe_on_start: true
    resubscribe: true
    resubscribe_interval: 60
}\n'''

    link_block += config.template_substitute(templates_dir+'/link_udp.pb.cfg.in',
                                             subnet_mask=common.comms.subnet_mask,                                            
                                             modem_id=common.comms.modem_id("wifi",node_id),
                                             local_port=common.udp.wifi_udp_port(node_id),
                                             remotes=common.comms.wifi_remotes(node_id, fleet_index, default_hub_id),
                                             hub_endpoints=common.comms.wifi_hub_remotes(node_id, fleet_index),
                                             mac_slots=common.comms.wifi_mac_slots(node_id),
                                             sub_buffer=sub_buffer_config,
                                             ack_timeout=ack_timeout,
                                             ipv6='')


if jaia_iridium_enabled:    
    if is_simulation():
        iridium_serial_port='/tmp/iridium' + str(bot_index)
    else:
        iridium_serial_port='/dev/iridium'

    subscribes_block+='''subscribe {
    link: LINK_IRIDIUM
    subscribe_on_start: true
    resubscribe: true
    resubscribe_interval: 150
}\n'''
        
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

if is_simulation():
    imu_type = 'sim'
else:
    imu_type = jaia_imu_type

# We are loosening the imu detection code for retrofit
# IMU's based on test results gathered from Tiger Team
if imu_install_type == "retrofit":
    total_imu_issue_checks = 10
else:
    total_imu_issue_checks = 4


pressure_sensor_type = 'sim' if is_simulation() else 'bar30'


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
                                     bot_id=bot_index,
                                     fleet_id=fleet_index,
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     bind_port=common.udp.motor_cpp_udp_port(),
                                     remote_port=common.udp.motor_py_udp_port(bot_index),
                                     # do not power off or restart the simulator computer unless we're a VirtualFleet
                                     ignore_powerstate_changes=ignore_powerstate_changes,
                                     is_in_sim=is_simulation(),
                                     motor_harness_type=jaia_motor_harness_type,
                                     jaia_tail_serial_number=jaia_tail_serial_number,
                                     jaia_bot_vin=jaia_bot_vin))
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
        liaison_port=30100+bot_index
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
                                     echo_enabled=str(echo_enabled).lower(),
                                     salinity_enabled=str(salinity_enabled).lower(),
                                     bar30_enabled=str(bar30_enabled).lower(),
                                     tsys01_enabled=str(tsys01_enabled).lower()))
elif common.app == 'jaiabot_fusion':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_fusion.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     bot_id=bot_index,
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
                                     bot_id=bot_index,
                                     log_dir=log_file_dir,
                                     bot_log_staging_dir=common.bot_log_staging_dir,
                                     bot_log_archive_dir=common.bot_log_archive_dir,
                                     mission_manager_in_simulation=is_simulation(),
                                     total_after_dive_gps_fix_checks=total_after_dive_gps_fix_checks,
                                     fleet_id=fleet_index,
                                     jaia_data_offload_ignore_type=jaia_data_offload_ignore_type,
                                     subnet_mask=common.comms.subnet_mask,
                                     camera_available=common.camera_available))
elif common.app == 'jaiabot_sensors':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_sensors.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block=interprocess_common,
                                     port='/dev/bio-payload',
                                     baud=115200,
                                     fluorometer_coefficients=fluorometer_coefficients,
                                     fluorometer_2_config=fluorometer_2_config,
                                     tsys01_config=tsys01_config))
elif common.app == 'jaiabot_engineering':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_engineering.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     bot_id=bot_index,
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
    print(config.template_substitute(templates_dir+'/jaiabot_metadata.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     xbee_info=xbee_info,
                                     is_simulation=str(is_simulation()).lower(),
                                     node_id=f'bot_id: {bot_index}',
                                     fleet_id=fleet_index))
elif common.app == 'frontseat_sim':
    print(common.vehicle.simulator_port(vehicle_id))
elif common.app == 'log_file':
    print(log_file_dir)
elif common.app == 'jaiabot_mission_repeater':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_mission_repeater.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     bot_id=bot_index))
elif common.app == 'jaiabot_driver_camera':
    print(config.template_substitute(templates_dir+'/bot/jaiabot_driver_camera.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     serial_camera_port=common.bot.serial_camera_port(bot_index, jaia_iridium_enabled),))
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
                                     bot_id=bot_index,
                                     fleet_id=fleet_index,
                                     jaiabot_driver_arduino_bounds=jaiabot_driver_arduino_bounds,
                                     jaia_arduino_dev_location=jaia_arduino_dev_location,
                                     udp_gateway_port=udp_gateway_port,
                                     imu_type=imu_type,
                                     pressure_sensor_type=pressure_sensor_type,
                                     log_file_dir=log_file_dir,
                                     motor_py_udp_port=common.udp.motor_py_udp_port(bot_index)))
