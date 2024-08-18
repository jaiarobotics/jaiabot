#!/usr/bin/env python3

import atlas_oem
import time

probe = atlas_oem.AtlasOEM()
probe.setActiveHibernate(1)


def clearScreen():
    print('\033[2J\033[H')


def presentMenu(menu):
    item_func_dict = { item['key'].lower(): item['func'] for item in menu['items'] }

    done = False
    while not done:
        clearScreen()
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


def setProbeType():
    value = input('Enter probe type value (K value) > ')

    try:
        probe.setProbeType(float(value))
    except ValueError:
        input('K value must be a number [press enter to continue]')


def setTemperatureCompensation():
    value = input('Enter temperature (deg C) > ')

    try:
        probe.setTemperatureCompensation(float(value))
    except ValueError:
        input('T value must be a number [press enter to continue]')


def printProbeStatus():
    try:
        clearScreen()
        probe.dump()
        input('Press enter to continue')
    except Exception as e:
        print(f'Error: {e}')


def clearCalibration():
    probe.setCalibrationRequest(1)
    input('Calibration data cleared.  Press enter.')


def doCalibration(description: str, type: int):
    if description is not 'DRY':
        value = input(f'{description} calibration value: ')
    else:
        value = 0

    while True:
        print('Getting 10 seconds of data...')
        ec_old = None
        for i in range(0, 10):
            ec = probe.EC()
            if ec_old:
                delta_percent = abs(ec - ec_old) / ec_old * 100
            else:
                delta_percent = 0.0
            print(f'EC: {ec: 6.2f}  delta: {delta_percent: 3.1f}%')
            ec_old = ec
            time.sleep(1)
        if input('Calibrate now (Y/n)?').lower() in ['', 'y']:
            break

    try:
        probe.setCalibration(float(value))
        probe.setCalibrationRequest(type)
        input(f'{description} calibration completed.  Press enter.')
    except ValueError:
        input('Value must be a number.  Press enter.')


def dryCalibration():
    doCalibration('DRY', 2)


def singlePointCalibration():
    doCalibration('SINGLE POINT', 3)


def highCalibration():
    doCalibration('DUAL POINT HIGH', 5)


def lowCalibration():
    doCalibration('DUAL POINT LOW', 4)


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
                'description': 'Dry Calibration',
                'key': 'd',
                'func': dryCalibration
            },
            {
                'description': 'Single Point Calibration',
                'key': 's',
                'func': singlePointCalibration
            },
            {
                'description': 'Dual Point High Calibration',
                'key': 'h',
                'func': highCalibration
            },
            {
                'description': 'Dual Point Low Calibration',
                'key': 'l',
                'func': lowCalibration
            },
            {
                'description': 'Exit Menu',
                'key': 'e',
                'func': None
            }
        ]
    })


presentMenu({
    'title': 'Main Menu',
    'items': [
        {
            'description': 'Print probe status',
            'key': 's',
            'func': printProbeStatus
        },
        {
            'description': 'Set probe type',
            'key': 'p',
            'func': setProbeType
        },
        {
            'description': 'Set temperature compensation',
            'key': 't',
            'func': setTemperatureCompensation
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
