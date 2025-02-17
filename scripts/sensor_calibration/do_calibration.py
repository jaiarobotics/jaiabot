#!/usr/bin/env python3

from python_AtlasOEM_lib import AtlasOEM_DO
import datetime
import time

from i2c_utils import I2CUtils

""" INIT """

# Find and activate the Atlas Scientific OEM-DO sensor
while True:
    try:
        probe = AtlasOEM_DO(bus=0, name="Atlas Scientific OEM-DO Probe")
        probe.write_active_hibernate(0x01)
        print("Atlas Scientific OEM-DO sensor detected and activated")
        break
    except Exception as e:
        print(f"Atlas Scientific OEM-DO sensor not found. Trying again. {e}")


def clearScreen():
    print('\033[2J\033[H')



""" SENSOR INTERACTION """

def dump():
    time.sleep(0.5)
    print(f"Device Name:              {probe.get_name()}")
    print(f"Device Type:              {probe.read_device_data():02x}")
    print(f"Firmware Version:         {probe.read_firmware_version():02x}")
    print(f"Interrupt Control:        {probe.read_interrrupt_control():02x}")
    print(f"LED Control:              {probe.read_led():02x}")
    print(f"Active / Hibernate:       {probe.read_active_hibernate():02x}")
    print(f"New reading available:    {probe.read_new_reading_available():02x}")
    print(f"Calibration Confirmation: {probe.read_calibration_confirm():02x}")
    print(f"Temperature Compensation: {probe.read_temperature_compensation():0.2f}")
    print(f"Temperature Confirmation: {probe.read_temperature_confirmation():02X}")
    print(f"Salinity Compensation:    {probe.read_salinity_compensation():0.2f}")
    print(f"Salinity Confirmation:    {probe.read_salinity_confirmation():02X}")
    print(f"Pressure Compensation:    {probe.read_pressure_compensation():0.2f}")
    print(f"Pressure Confirmation:    {probe.read_pressure_confirmation():02X}")
    print(f"DO:                       {probe.read_DO_reading():0.2f}")
    print(f"DO Saturation:            {probe.read_percent_saturation_reading():0.2f}")
    
    
def printProbeStatus():
    print(f"Probe Status: {probe.status()}")


### GETTERS ###
def get_new_reading_available():
    return probe.read_new_reading_available()

def get_calibration_confirm():
    return probe.read_calibration_confirm()

def get_salinity_compensation():
    return probe.read_salinity_compensation()

def get_pressure_compensation():
    return probe.read_pressure_compensation()

def get_temperature_compensation():
    return probe.read_temperature_compensation()

def get_salinity_confirmation():
    return probe.read_salinity_confirmation()

def get_pressure_confirmation():
    return probe.read_pressure_confirmation()

def get_temperature_confirmation():
    return probe.read_temperature_confirmation()

def get_DO_reading():
    return probe.read_DO_reading()

def get_percent_saturation_reading():
    return probe.read_percent_saturation_reading()


### SETTERS ###

# Set the new reading available flag to false for after using a reading
def set_new_reading_available():
    probe.write_new_reading_available(0x00)

def set_calibration_request(value):
    probe.write_calibration_request(value)

# Optional input parameter to set the value directly
def set_salinity_compensation(value=-1):
    if value == -1:
        value = float(input("Enter salinity compensation value: "))
    probe.write_salinity_compensation(value)

# Optional input parameter to set the value directly
def set_pressure_compensation(value=-1):
    if value == -1:
        value = float(input("Enter pressure compensation value: "))
    probe.write_pressure_compensation(value)

# Optional input parameter to set the value directly
def set_temperature_compensation(value=-1): 
    if value == -1:
        value = float(input("Enter temperature compensation value: "))
    probe.write_temperature_compensation(value)
    

# Poll the DO sensor at 1 Hz
def pollDO():
    while True:
        print(f"DO: {probe.read_DO_reading()}")
        time.sleep(1)


""" CALIBRATION """

# Clear all previous calibration data
def clearCalibration():
    probe.write_calibration_request(1)
    time.sleep(0.5)


# Atmospheric calibration
def atmosphericCalibration():
    while True:
        try:
            if get_new_reading_available() == 1:
                print(f"DO: {get_DO_reading()}, % Saturation: {get_percent_saturation_reading()}")
                time.sleep(1)
            else:
                continue
        except IOError as e:
            print(f"IO Error, continuing...")
            continue
        except KeyboardInterrupt:
            break

    input = input("Calibrate to atmospheric DO now? (y/n)")
    if input == 'y':
        probe.write_calibration_request(2)
        time.sleep(0.5)
    else:
        return
    



# Zero calibration
def zeroCalibration():
    while True:
        try:
            if get_new_reading_available() == 1:
                print(f"DO: {get_DO_reading()}, % Saturation: {get_percent_saturation_reading()}")
                time.sleep(1)
            else:
                continue
        except IOError as e:
            print(f"IO Error, continuing...")
            continue
        except KeyboardInterrupt:
            break

    input = input("Calibrate to zero DO now? (y/n)")
    if input == 'y':
        probe.write_calibration_request(3)
        time.sleep(0.5)
    else:
        return


""" UI MENUS """

# Present a menu to the user and await their input
def presentMenu(menu):
    item_func_dict = { item['key'].lower(): item['func'] for item in menu['items'] }

    done = False
    while not done:
        clearScreen()
        print(datetime.datetime.now())
        try:
            probe.dump()
        except Exception as e:
            print(f"{e}")
            continue

        print()
        print()
        print()
        print(menu['title'])
        print('============')
        print()

        for item in menu['items']:
            print(f'{item["key"]}) {item["description"]}')

        print()

        choice = input('Enter choice > ')

        if choice.lower() in item_func_dict:
            func = item_func_dict[choice]

            if func is None:
                return
            else:
                func()
        else:
            print('Invalid choice.')
            input()


# Calibration menu
def calibrate():
    presentMenu({
        'title': 'Calibrate',
        'items': [
            {
                'description': 'Clear Calibration Data',
                'key': 'c',
                'func': clearCalibration
            },
            {
                'description': '0 Dissolved Oxygen Calibration',
                'key': 'l',
                'func': zeroCalibration
            },
            {
                'description': 'Atmostpheric Calibration',
                'key': 'h',
                'func': atmosphereCalibration
            },
            {
                'description': 'Exit Menu',
                'key': 'e',
                'func': None
            }
        ]
    })


# Main menu
presentMenu({
    'title': 'Main Menu',
    'items': [
        {
            'description': 'Print probe status',
            'key': 's',
            'func': printProbeStatus
        },
        {
            'description': 'Poll DO @ 1Hz',
            'key': 'l',
            'func': pollDO
        },
        {
            'description': 'Set temperature compensation',
            'key': 't',
            'func': setTemperatureCompensation
        },
        {
            'description': 'Set salinity compensation',
            'key': 'k',
            'func': setSalinityCompensation
        },
        {
            'description': 'Set pressure compensation',
            'key': 'p',
            'func': setPressureCompensation
        },
        {
            'description': 'Calibrate',
            'key': 'c',
            'func': calibrate
        },
        {
            'description': 'Exit Program',
            'key': 'e',
            'func': None
        }
    ]
})