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
import subprocess

try:
    fleet_index=int(os.environ['jaia_fleet_index'])
except:
    config.fail('Must set jaia_fleet_index environmental variable, e.g. "jaia_fleet_index=0 ./hub.launch"')

try:
    hub_index=int(os.environ['jaia_hub_index'])
except:
    hub_index=0
cloudhub_index=30

try:
    user_role=os.environ['jaia_user_role'].upper()
except:
    user_role='USER'

try:
    cloudhub_type=os.environ['jaia_cloudhub_type'].upper()
except:
    cloudhub_type='SECONDARY'

is_cloudhub = hub_index == cloudhub_index
if not is_cloudhub:
    cloudhub_type=''

log_file_dir = common.jaia_log_dir + '/hub/'  + str(hub_index)
Path(log_file_dir).mkdir(parents=True, exist_ok=True)
debug_log_file_dir=log_file_dir

node_id = 0 
wifi_modem_id = common.comms.modem_id("wifi",node_id)
vehicle_type= 'HUB'

templates_dir=common.jaia_templates_dir

liaison_load_block = config.template_substitute(templates_dir+'/hub/_liaison_load.pb.cfg.in')

# omit so we don't shutdown the real system on a timeout
vfleet_shutdown_times=''
if common.is_vfleet:
    vfleet_shutdown_times='vfleet {  shutdown_after_last_command_seconds: 3600 hub_shutdown_delay_seconds: 300 }'
    
verbosities = \
{ 'gobyd':                     { 'runtime': { 'tty': 'WARN', 'log': 'WARN' }, 'simulation': { 'tty': 'WARN', 'log': 'WARN' }},
  'goby_intervehicle_portal':  { 'runtime': { 'tty': 'WARN', 'log': 'WARN'  },  'simulation': { 'tty': 'WARN', 'log': 'WARN' }},
  'goby_liaison':              { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'goby_liaison_prelaunch':    { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'goby_gps':                  { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'goby_logger':               { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'goby_coroner':              { 'runtime': { 'tty': 'WARN', 'log': 'WARN' },  'simulation': { 'tty': 'WARN', 'log': 'WARN' }},
  'jaiabot_health':            { 'runtime': { 'tty': 'WARN', 'log': 'WARN'},  'simulation': { 'tty': 'WARN', 'log': 'WARN'}},
  'jaiabot_metadata':          { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'jaiabot_hub_manager':       { 'runtime': { 'tty': 'WARN', 'log': 'WARN' },  'simulation': { 'tty': 'WARN', 'log': 'WARN' }},
  'jaiabot_web_portal':        { 'runtime': { 'tty': 'WARN', 'log': 'WARN' },  'simulation': { 'tty': 'WARN', 'log': 'WARN' }},
  'goby_opencpn_interface':    { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'goby_terminate':            { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'jaiabot_failure_reporter':  { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'jaiabot_simulator':         { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'WARN', 'log': 'QUIET' }},
  'jaiabot_comms_manager':        { 'runtime': { 'tty': 'WARN', 'log': 'QUIET' },  'simulation': { 'tty': 'QUIET', 'log': 'QUIET' }}
}

app_common = common.app_block(verbosities, debug_log_file_dir)

interprocess_common = config.template_substitute(templates_dir+'/_interprocess.pb.cfg.in',
                                                 platform='hub'+ str(hub_index) +'_fleet' + str(fleet_index))

try:
    xbee_info = 'xbee { \n' + open('/etc/jaiabot/xbee_info.pb.cfg').read() + '\n}\n'
except FileNotFoundError:
    xbee_info = 'xbee {}'

ack_timeout=10
iridium_ack_timeout=120
sub_buffer_config = config.template_substitute(templates_dir+'/_sub_buffer.pb.cfg.in')
link_block=''
if common.CommsMode.XBEE in common.jaia_comms_modes:
    if is_simulation():
        xbee_serial_port='/tmp/xbeehub' + str(hub_index)
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
                                            fleet_id=fleet_index,
                                            sub_buffer=sub_buffer_config,
                                            ack_timeout=ack_timeout)

if common.CommsMode.WIFI in common.jaia_comms_modes:
    link_block += config.template_substitute(templates_dir+'/link_udp.pb.cfg.in',
                                             subnet_mask=common.comms.subnet_mask,                                            
                                             modem_id=common.comms.modem_id("wifi",node_id),
                                             local_port=common.udp.wifi_udp_port(node_id, hub_index),
                                             remotes=common.comms.wifi_remotes(node_id, fleet_index, hub_index),
                                             hub_endpoints='',
                                             mac_slots=common.comms.wifi_mac_slots(node_id),
                                             sub_buffer=sub_buffer_config,
                                             ack_timeout=ack_timeout,
                                             ipv6='')

if common.CommsMode.IRIDIUM in common.jaia_comms_modes:
    sbd_type=common.comms.iridium_sbd_type()
    if sbd_type is None:
        sys.stderr.write('Warning: "comms_mode: iridium" is set but "/etc/jaiabot/iridium.json" does not exist. Continuing without Iridium comms.\n')
    else:
        if is_simulation():
            iridium_mt_server_address='127.0.0.1'
            iridium_mt_server_port=10800
        else:
            # By convention, we assign hub25 to iridium.jaia.tech on the CloudHub VPN
            iridium_jaia_tech_hub_id=25
            result = subprocess.run(['jaia', 'ip', f'h{iridium_jaia_tech_hub_id}cf{fleet_index}'], stdout=subprocess.PIPE, check=True)
            iridium_mt_server_address=result.stdout.decode().strip()
            iridium_mt_server_port=10800+fleet_index

        rockblock=''
        directip=''
        if sbd_type == "SBD_DIRECTIP":
            directip=f'mo_sbd_server_port: 11800 mt_sbd_server_address: "{iridium_mt_server_address}" mt_sbd_server_port: {iridium_mt_server_port}'
        elif sbd_type == "SBD_ROCKBLOCK":
            (rockblock_username, rockblock_password) = common.comms.iridium_rockblock_credentials()
            rockblock=f'mo_sbd_server_port: 12800 rockblock {{ username: "{rockblock_username}" password: "{rockblock_password}" }}'
        
        link_block += config.template_substitute(templates_dir+'/link_iridium_shore.pb.cfg.in',
                                                 subnet_mask=common.comms.subnet_mask,
                                                 modem_id=common.comms.modem_id("iridium",node_id),
                                                 mac_slots=common.comms.iridium_shore_mac_slots(node_id),
                                                 sub_buffer=sub_buffer_config,
                                                 ack_timeout=iridium_ack_timeout,
                                                 modem_imei_map=common.comms.iridium_modem_imei_mapping(),
                                                 sbd_type=sbd_type,
                                                 rockblock=rockblock,
                                                 directip=directip)
        
subscribes_block=''

if common.comms.has_cloudhub_vpn(fleet_index) or is_simulation():
    subscribes_block+='''subscribe {
    link: LINK_HUB2HUB
    subscribe_on_start: true
    resubscribe: true
    resubscribe_interval: 60
}\n'''

    # Hub2Hub comms
    link_block += config.template_substitute(templates_dir+'/link_udp.pb.cfg.in',
                                             subnet_mask=common.comms.subnet_mask,
                                             modem_id=common.comms.hub2hub_modem_id(hub_index),
                                             local_port=common.udp.hub2hub_udp_port(hub_index),
                                             remotes=common.comms.hub2hub_remotes(hub_index, fleet_index),
                                             hub_endpoints='',
                                             mac_slots=common.comms.hub2hub_mac_slots(hub_index),
                                             sub_buffer=sub_buffer_config,
                                             ack_timeout=ack_timeout,
                                             ipv6='ipv6: true')

    
liaison_jaiabot_config = config.template_substitute(templates_dir+'/_liaison_jaiabot_config.pb.cfg.in', mode='HUB')
liaison_bind_addr='0.0.0.0'
if common.is_vfleet or is_cloudhub:
    liaison_bind_addr='0::0'

if common.app == 'gobyd':
    if cloudhub_type == 'SECONDARY':
        required_clients=''
    else:
        required_clients='required_client: "goby_intervehicle_portal" required_client: "jaiabot_comms_manager"'

    print(config.template_substitute(templates_dir+'/gobyd.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     link_block=link_block,
                                     required_clients=required_clients))
elif common.app == 'goby_intervehicle_portal':
    print(config.template_substitute(templates_dir+'/goby_intervehicle_portal.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
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
    ignore_powerstate_changes=is_simulation() and not common.is_vfleet
    print(config.template_substitute(templates_dir+'/hub/jaiabot_health.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     # do not power off or restart the simulator computer
                                     ignore_powerstate_changes=ignore_powerstate_changes,
                                     is_in_sim=is_simulation()))
elif common.app == 'goby_liaison':
    liaison_port=30000
    if is_simulation():
        liaison_port=30010+hub_index
    print(config.template_substitute(templates_dir+'/goby_liaison.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     http_port=liaison_port,
                                     http_address=liaison_bind_addr,
                                     jaiabot_config=liaison_jaiabot_config,
                                     load_protobufs=liaison_load_block))
elif common.app == 'goby_liaison_prelaunch':
    liaison_port=9091
    this_hub='hub'+ str(hub_index) +'-fleet' + str(fleet_index)
    inventory='/etc/jaiabot/inventory.yml'
    if is_cloudhub:
        vfleet_playbooks=config.template_substitute(templates_dir+'/hub/_liaison_prelaunch_vfleet_playbooks.pb.cfg.in')
    else:
        vfleet_playbooks=''

    limit=''
    if cloudhub_type == 'PRIMARY':
        limit='limit: "all"'
    print(config.template_substitute(templates_dir+'/hub/goby_liaison_prelaunch.pb.cfg.in',
                                     app_block=app_common,
                                     http_port=liaison_port,
                                     http_address=liaison_bind_addr,
                                     this_hub=this_hub,
                                     user_role=user_role,
                                     inventory=inventory,
                                     vfleet_playbooks=vfleet_playbooks,
                                     this_hub_index=hub_index,
                                     limit=limit,
                                     ansible_log_dir=common.jaia_log_dir + '/ansible'))
elif common.app == 'goby_gps':
    print(config.template_substitute(templates_dir+'/goby_gps.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     gpsd_port=common.hub.gpsd_port(hub_index),
                                     gpsd_device=common.hub.gpsd_device()))
elif common.app == 'jaiabot_simulator':
    # start the hubs in a slightly offset location
    lat = 41.662680 + (hub_index-1) * 0.001
    lon = -71.273018 + (hub_index-1) * 0.001
    print(config.template_substitute(templates_dir+'/hub/jaiabot_simulator.pb.cfg.in',
                                     app_block=app_common,
                                     lat=lat,
                                     lon=lon,
                                     interprocess_block = interprocess_common,
                                     hub_gpsd_device=common.hub.gpsd_device())) 
elif common.app == 'goby_logger':
    log_on_startup='true'
    if is_cloudhub:
        # avoid running out of disk space
        log_on_startup='false'        
    
    print(config.template_substitute(templates_dir+'/goby_logger.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     goby_logger_dir=log_file_dir,
                                     goby_logger_group_regex=logger.group_regex,
                                     log_on_startup=log_on_startup))
elif common.app == 'jaiabot_hub_manager':
    print(config.template_substitute(templates_dir+'/hub/jaiabot_hub_manager.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     hub_id=hub_index,
                                     expected_hubs=f"id: {common.hub.expected_hubs_from_inventory()}",
                                     fleet_id=fleet_index,
                                     bot_log_staging_dir=common.bot_log_staging_dir,
                                     hub_log_offload_dir=common.hub_log_offload_dir,
                                     # if we're using localhost for wifi comms, use it for data offload as well
                                     use_localhost_for_data_offload=(common.comms.wifi_ip_addr(node_id, node_id, fleet_index, hub_index) == '127.0.0.1'),
                                     vfleet_shutdown_times=vfleet_shutdown_times,
                                     hub_gpsd_device=common.hub.gpsd_device(),
                                     subnet_mask=common.comms.subnet_mask,
                                      # do not hub subscribe automatically on Iridium to save data - let the bots subscribe as we only have one hub
                                     links_to_subscribe_on="[" + ", ".join(f"LINK_{mode.value.upper()}" for mode in common.jaia_comms_modes if mode != common.CommsMode.IRIDIUM) + "]"))
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
    print(config.template_substitute(templates_dir+'/jaiabot_metadata.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     xbee_info=xbee_info,
                                     is_simulation=str(is_simulation()).lower(),
                                     node_id=f'hub_id: {hub_index}',
                                     fleet_id=fleet_index))
elif common.app == 'jaiabot_comms_manager':
    print(config.template_substitute(templates_dir+'/jaiabot_comms_manager.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block = interprocess_common,
                                     subscribes=subscribes_block,
                                     subnet_mask=common.comms.subnet_mask))
elif common.app == 'gpsd':
    # Run for forwarding contacts
    devices_str = "-N " + " ".join([f"udp://0.0.0.0:{port}" for port in range(33001, 33004)])
    print('-S {} {}'.format(common.hub.gpsd_port(hub_index), devices_str))
elif common.app == 'jaiabot_web_portal':
    print(config.template_substitute(templates_dir + f'/hub/jaiabot_web_portal.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block=interprocess_common,
                                     port=common.udp.web_portal_udp_port(hub_index)))
elif common.app == 'log_file':
    print(log_file_dir)
else:
    print(config.template_substitute(templates_dir + f'/hub/{common.app}.pb.cfg.in',
                                     app_block=app_common,
                                     interprocess_block=interprocess_common))
