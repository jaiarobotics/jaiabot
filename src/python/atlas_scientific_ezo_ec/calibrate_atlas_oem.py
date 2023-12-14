#!/usr/bin/env python3

try:
    import atlas_oem
except ImportError:
    print('❗ WARNING: Could not import atlas_oem, using simulator ❗')
    input('Press ENTER')
    import atlas_oem_simulator as atlas_oem

probe = atlas_oem.AtlasOEM()
probe.setActiveHibernate(1)


def clearScreen():
    print('\033[2J\033[H')


def presentMenu(menu) -> bool:
    """Present a menu and execute the associated function.

    Args:
        menu (_type_): An array of dictionaries describing the menu entries

    Returns:
        bool: False if user chose an entry with func == None (exit to previous menu)
    """
    item_func_dict = { item['key'].lower(): item['func'] for item in menu['items'] }

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
            return False
        else:
            func()
            return True
    else:
        print('Invalid choice.')
        input()
        return True


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
        value = input(f'{description} calibration value: ')
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


def calibrate():
    shouldContinue = True

    while shouldContinue:
        calibrationConfirmation = probe.calibrationConfirmation()

        if calibrationConfirmation == 0:
            calibrationStatusString = 'Status: UNCALIBRATED'
        elif calibrationConfirmation == 1:
            calibrationStatusString = 'Status: ONE-POINT CALIBRATION COMPLETE'
        elif calibrationConfirmation == 2:
            calibrationStatusString = 'Status: TWO-POINT CALIBRATION COMPLETE'

        shouldContinue = presentMenu({
            'title': f'Calibrate\n{calibrationStatusString}',
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


while presentMenu({
    'title': 'Main Menu',
    'items': [
        {
            'description': 'Print probe status',
            'key': 'p',
            'func': printProbeStatus
        },
        {
            'description': 'Set probe type',
            'key': 't',
            'func': setProbeType
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
}):
    pass
