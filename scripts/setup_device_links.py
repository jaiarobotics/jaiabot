#!/usr/bin/env python3
import glob
import os

devices_path = '/opt/jaiabot/dev/'
os.system(f'sudo mkdir -p {devices_path}')

device_dict = {
    devices_path + 'arduino' : ['/dev/serial/by-id/usb-1a86_USB2.0-Serial-if00-port0'], 
    devices_path + 'xbee': ['/dev/serial/by-id/usb-FTDI_FT231X_USB_UART_DN*-if00-port0',
                  '/dev/serial/by-id/usb-SparkFun_XBee_Explorer_USB_SF3779M7-if00-port0']
            }
# Set the arduino and xbee links
for target_device, device_list in device_dict.items():
    for device in device_list:
        try:
            os.system(f'sudo ln -sf {glob.glob(device)[0]} {target_device}')
            print(f'Successfully linked {glob.glob(device)[0]} to {target_device}')
        except IndexError as e:
            pass

# Set the GPS link
def set_gps_device():
    def get_pi_model():
        for line in open ('/proc/cpuinfo'):
            d = line.split(':')
            if d[0].strip() == 'Model':
                return d[1].strip()
        return 'model not found'

    pi_dict = {
        'Raspberry Pi 3' : '/dev/ttyS0',
        'Raspberry Pi Compute Module 4' : '/dev/ttyAMA2'
    }

    pi_model = get_pi_model()
    for key, value in pi_dict.items():
        if pi_model.startswith(key):
            target = devices_path + 'gps'
            os.system(f'sudo ln -sf {value} {target}')
            print(f'Successfully linked {value} to {target}')

set_gps_device()
