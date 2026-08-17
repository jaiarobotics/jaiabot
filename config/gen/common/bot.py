from common import is_simulation
from common import config
import common.comms

def bot_id_to_node_id(bot_id):
    return bot_id+common.comms.hub_node_id+1

def moos_port(node_id):
    return 9000 + node_id

def moos_simulator_port(node_id):
    return 9100 + node_id

def gpsd_device(node_id):
    if is_simulation():
        return "udp://127.0.0.1:" + str(gpsd_simulator_udp_port(node_id))
    else:
        return '/dev/gps0'

def gpsd_simulator_udp_port(node_id):
    return 32100 + node_id

def gpsd_port(node_id):
    if is_simulation():
        return 32100 + node_id
    else:
        default_gpsd_port=2947
        return default_gpsd_port

def serial_camera_port(bot_id: int):
    """Get the device path to the serial port connected to the Pi Zero device running the camera driver.

    Args:
        bot_id (int): The bot id.

    Returns:
        str: Path to the serial port, i.e. "/dev/ttyAMA5"
    """
    if is_simulation():
        return f"/tmp/bot{bot_id}_camera_0"
    else:
        return '/dev/ttyAMA5' # TODO: Change to /dev/rpicam when camera udev rules are updated

def helm_tick_config(jaia_electronics_stack):
    if jaia_electronics_stack in ('1', '2'):
        return dict(helm_app_tick=5, helm_comms_tick=5, total_after_dive_gps_fix_checks=75)
    else:
        return dict(helm_app_tick=1, helm_comms_tick=4, total_after_dive_gps_fix_checks=15)

def arduino_dev_location(jaia_arduino_type):
    if jaia_arduino_type == 'usb':
        return '/dev/arduino'
    else:
        return '/dev/ttyAMA1'

def payload_flags(bot_type):
    return dict(
        pam_enabled=(bot_type == 'PAM'),
        # Ignore health warnings from UDP gateway if data comes from BIO payload board
        salinity_enabled=(bot_type != 'BIO'),
        bar30_enabled=(bot_type != 'BIO'),
    )

def imu_type(jaia_imu_type):
    return 'sim' if is_simulation() else jaia_imu_type

def total_imu_issue_checks(imu_install_type):
    # Retrofit IMUs are loosened based on test results gathered from Tiger Team
    return 10 if imu_install_type == 'retrofit' else 4

def pressure_sensor_type():
    return 'sim' if is_simulation() else 'bar30'

def arduino_bounds():
    return config.read_pb_cfg_block('/etc/jaiabot/bounds.pb.cfg', 'bounds')

def xbee_info():
    return config.read_pb_cfg_block('/etc/jaiabot/xbee_info.pb.cfg', 'xbee')

def fluorometer_coefficients():
    return config.read_pb_cfg_block('/etc/jaiabot/fluorometer_coefficients.pb.cfg', 'fluorometer_coefficients')
