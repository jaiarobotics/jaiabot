#!/usr/bin/env python3
import glob
import os

devices_path = '/etc/jaiabot/dev/'
os.system(f'sudo mkdir -p {devices_path}')


def link(src, dest):
    os.system(f'sudo ln -sf {src} {dest}')
    print(f'Successfully linked {src} to {dest}')


def get_pi_model():
    for line in open ('/proc/cpuinfo'):
        d = line.split(':')
        if d[0].strip() == 'Model':
            return d[1].strip()
    return 'model not found'

pi_model = get_pi_model()


device_map = {
    'Raspberry Pi 3': [
        [ ['/dev/serial/by-id/usb-1a86_USB2.0-Serial-if00-port0', '/dev/serial/by-id/usb-FTDI_FT232R_USB_UART_AB0LMK0R-if00-port0'], 'arduino' ],
        [ ['/dev/serial/by-id/usb-FTDI_FT231X_USB_UART_D*-if00-port0', '/dev/serial/by-id/usb-SparkFun_XBee_Explorer_USB_SF3779M7-if00-port0'], 'xbee' ],
        [ ['/dev/ttyS0'], 'gps' ]
    ],
    'Raspberry Pi Compute Module 4': [
        [ ['/dev/ttyAMA1'], 'arduino' ],
        [ ['/dev/ttyAMA2'], 'xbee' ],
        [ ['/etc/jaiabot/dev/gps_i2c', '/dev/ttyAMA3'], 'gps' ]
    ],
    'Raspberry Pi 4': [
        [ ['/dev/ttyAMA1'], 'arduino' ],
        [ ['/dev/serial/by-id/usb-FTDI_FT231X_USB_UART_DN*-if00-port0', '/dev/serial/by-id/usb-SparkFun_XBee_Explorer_USB_SF3779M7-if00-port0'], 'xbee' ],
        [ ['/etc/jaiabot/dev/gps_i2c', '/dev/ttyAMA3'], 'gps' ]
    ],
}


for device_name in device_map:
    if pi_model.startswith(device_name):
        for sources, dest in device_map[device_name]:
            full_dest = devices_path + dest

            for source_pattern in sources:
                try:
                    source = glob.glob(source_pattern)[0]
                    link(source, full_dest)
                    break
                except IndexError:
                    pass
