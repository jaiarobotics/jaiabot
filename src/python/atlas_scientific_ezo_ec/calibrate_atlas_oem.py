#!/usr/bin/env python3

import atlas_oem
from time import sleep
from timedinput import timedinput

probe = atlas_oem.AtlasOEM()
probe.setActiveHibernate(1)


def clearScreen():
    print('\033[2J\033[H')


def presentMenu(menu, clear_screen = True, repeat = True):
    item_func_dict = { item['key'].lower(): item['func'] for item in menu['items'] }

    done = False
    while not done:
        if not repeat:
            done = True
        
        if clear_screen:
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


def printProbeStatus():
    clearScreen()
    probe.dump()
    input('Press enter to continue')


def clearCalibration():
    probe.setCalibrationRequest(1)
    input('Calibration data cleared.  Press enter.')


def doCalibration(description: str, type: int):
    if description != 'DRY':
        value = input(f'{description} calibration value (giving no input will assume standard values for dual point calibration): ')
        if value == "":
            if description == 'DUAL POINT HIGH':
                value = 80000
            if description == 'DUAL POINT LOW':
                value = 12880
    else:
        value = 0

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
    doCalibration('DUAL POINT HIGH', 4)


def lowCalibration():
    doCalibration('DUAL POINT LOW', 5)


def calibrate(clear_screen = True):
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
    }, clear_screen, False)


def updatingProbeValues():
    clearCalibration()

    done = False
    try:
        previous_EC = probe.EC()
    except:
        print("Error retrieving probe data.")
        previous_EC = 1

    threshold_for_plateau = 0.05 # In percent
    time_requirement_for_plateau = 20 # In seconds

    time_at_plateau_threshold = 0 # In seconds

    sleep_time = 5 # In seconds

    clearScreen()

    print("Press Enter to stop calibrating.")

    while not done:
        # clearScreen()
        
        try: 
            if previous_EC == 0:
                previous_EC = 1
            percent_change_in_EC = round(abs((probe.EC()-previous_EC)/previous_EC) * 100, 3)

            print("---------------")
            print("EC (μS/cm): ", probe.EC())
            print("% Change from previous input: ", percent_change_in_EC, "%")
            print("Temperature compensation: ", probe.temperatureCompensation())
            print("---------------")

            if (percent_change_in_EC < threshold_for_plateau or probe.EC() == 0) and probe.temperatureCompensation() == 25 and percent_change_in_EC != 0:
                time_at_plateau_threshold += sleep_time
            else: 
                time_at_plateau_threshold = 0

            if probe.temperatureCompensation() != 25:
                probe.setTemperatureCompensation(25)

            if time_at_plateau_threshold >= time_requirement_for_plateau:
                clearScreen()
                print("---------------\nProbe EC values deviated by less than 0.05% for 20 seconds. Continue calibration using the menu below.\n---------------\n")

                calibrate(False)
                break
            
            previous_EC = probe.EC()
        except:
            print("Error retrieving probe data.")
            time_at_plateau_threshold = 0

        try: 
            user_input = timedinput("", sleep_time)
        except: 
            user_input = "."

        if user_input != ".":
            done = True


presentMenu({
    'title': 'Main Menu',
    'items': [
        {
            'description': 'Calibrate',
            'key': 'c',
            'func': updatingProbeValues
        },
        {
            'description': 'Exit Program',
            'key': 'e',
            'func': None
        }
    ]
})
