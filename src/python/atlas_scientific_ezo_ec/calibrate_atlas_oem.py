#!/usr/bin/env python3

import atlas_oem
from time import sleep
from timedinput import timedinput
from sortedcontainers import SortedDict
import pandas as pd

probe = atlas_oem.AtlasOEM()
probe.setActiveHibernate(1)

probe_calibration_data = SortedDict({})
EC_values = pd.Series()

sleep_time = 5 # In seconds

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
                if menu['title'] == 'Main Menu':
                    dataToExcel()
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
    global probe_calibration_data
    global EC_values

    probe_df = pd.DataFrame(columns=['Time', 'EC values'])
    probe_df['Time'] = range(0, sleep_time*len(EC_values), sleep_time)[:len(EC_values)]
    probe_df['EC values'] = EC_values

    probe_calibration_data[description] = probe_df

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

    global EC_values

    done = False
    try:
        previous_EC = probe.EC()
    except:
        print("Error retrieving probe data.")
        previous_EC = 1

    threshold_for_plateau = 0.05 # In percent
    time_requirement_for_plateau = 20 # In seconds

    time_at_plateau_threshold = 0 # In seconds

    clearScreen()

    print("Press Enter to stop calibrating.")

    EC_values = pd.Series()

    while not done:
        # clearScreen()
        
        try: 
            if previous_EC == 0:
                previous_EC = 1
            percent_change_in_EC = round(abs((probe.EC()-previous_EC)/previous_EC) * 100, 3)

            EC_values[len(EC_values)-1] = probe.EC()

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
        except IOError as e:
            print("Error retrieving probe data.")
            print(f"Error {e}")
            time_at_plateau_threshold = 0

        try: 
            user_input = timedinput("", sleep_time)
        except: 
            user_input = "."

        if user_input != ".":
            done = True


def dataToExcel():
    global probe_calibration_data

    out_path = '/etc/jaiabot/EC_data.xlsx'

    with pd.ExcelWriter(out_path, mode='w') as writer: 
        for key in probe_calibration_data:
            probe_calibration_data[key].to_excel(writer, sheet_name=key)
        
        for sheet_name in writer.sheets:
            worksheet = writer.sheets[sheet_name]
            
            for col in worksheet.columns:
                max_length = 0
                column = col[0].column_letter # Get the column name
                for cell in col:
                    try: # Necessary to avoid error on empty cells
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = (max_length + 2) * 1.2
                worksheet.column_dimensions[column].width = adjusted_width


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
