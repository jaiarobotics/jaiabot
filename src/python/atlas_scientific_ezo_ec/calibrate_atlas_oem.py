#!/usr/bin/env python3
from dataclasses import dataclass
from typing import *
from time import sleep
from kbhit import KBHit

try:
    import atlas_oem
except ImportError:
    print('❗ WARNING: Could not import atlas_oem, using simulator ❗')
    input('Press ENTER')
    import atlas_oem_simulator as atlas_oem


def first(collection: list, where: Callable[[Any], bool]):
    """Returns the first item in collection where a condition is met.

    Args:
        collection (list): A list of items.
        where (Callable[[Any], bool]): Condition that has to be true.

    Returns:
        Any: The first item in the collection that meets the condition given.
    """
    for item in collection:
        if where(item):
            return item
    return None


def inputFloat(prompt: str):
    """Input a decimal number using a prompt, and re-prompt if a decimal number is not entered.

    Args:
        prompt (str): Prompt for the user.

    Returns:
        float: The float value of the entered number.
    """
    while True:
        s = input(prompt)
        try:
            value = float(s)
            return value
        except ValueError:
            print(f'INVALID INPUT!  Got {s}, but I need a number.')


def clearScreen():
    print('\033[2J\033[H')


def printProbeStatus():
    clearScreen()
    probe.dump()
    input('Press enter to continue')


def clearCalibration():
    probe.setCalibrationRequest(1)
    input('Calibration data cleared.  Press enter.')




# Calibration types
@dataclass
class CalibrationStep:
    description: str
    code: int


dry = CalibrationStep('Dry calibration', 2)
single = CalibrationStep('Single point calibration', 3)
dualLow = CalibrationStep('Dual point calibration, low-EC', 4)
dualHigh = CalibrationStep('Dual point calibration, high-EC', 5)


@dataclass
class CalibrationMode:
    selectionLetter: str
    description: str
    steps: List[CalibrationStep]


calibrationModes = [
    CalibrationMode('1', 'Single Point Calibration', [
        dry, single
    ]),

    CalibrationMode('2', 'Dual Point Calibration', [
        dry, dualLow, dualHigh
    ])

]


def inputCalibrationMode() -> CalibrationMode:
    """Ask the user for a calibration type to use.

    Returns:
        CalibrationType: The chosen calibration type.
    """
    while True:
        print('\nChoose a calibration type by entering its corresponding letter:')
        for calibrationMode in calibrationModes:
            print(f'{calibrationMode.selectionLetter}) {calibrationMode.description}')
        
        selectionLetter = input('Choose a calibration type: ').lower()
        try:
            calibrationMode: CalibrationMode = first(calibrationModes, where=lambda c: c.selectionLetter.lower() == selectionLetter)
            return calibrationMode
        except IndexError:
            print('Invalid choice, try again.')


def doCalibration(calibrationMode: CalibrationMode):
    def waitUntilCalibrationDone():
        # Wait until the calibration has completed
        while True:
            if probe.calibrationRequest() == 0:
                break
            else:
                sleep(0.5)

    # Clear calibration
    print('\n==> Clearing current calibration')
    probe.setCalibrationRequest(1)
    waitUntilCalibrationDone()

    for calibrationStep in calibrationMode.steps:
        print(f'\n==> Place the probe into the {calibrationStep.description} solution, and press enter when the reading has settled.')

        with KBHit() as keyboard:
            oldEc = None
            while True:
                ec = probe.EC()

                if oldEc is None:
                    print(f'\rEC: {ec}', end='')
                else:
                    delta = ec - oldEc
                    print(f'\rEC: {ec}, change={delta}', end='')

                oldEc = ec        
                sleep(0.5)

                if keyboard.kbhit():
                    # Clear out the keyboard buffer
                    while keyboard.kbhit():
                        keyboard.getch()
                    break

        if calibrationStep.code != 2: # DRY
            value = inputFloat(f'\nEnter the EC of the {calibrationStep.description} solution: ')
            probe.setCalibration(value)

        probe.setCalibrationRequest(calibrationStep.code)
        print(f'\n==> {calibrationStep.description} calibration in progress...')
        waitUntilCalibrationDone()

    print(f'==> Calibration procedure complete.')
    calibrationStatus = probe.calibrationConfirmation()
    print(f'  Dry calibration: {calibrationStatus & 1 == 1}')
    print(f'  Single-point calibration: {calibrationStatus & 2 == 2}')
    print(f'  Dual-point low calibration: {calibrationStatus & 4 == 1}')
    print(f'  Dual-point high calibration: {calibrationStatus & 8 == 8}')


def calculateTemperatureCompensation(temperature: float):
    """Calculates the temperature compensation, given an input temperature

    Args:
        temperature (float): Input temperature, in degrees C

    Returns:
        (float): The temperature compensation to send to the probe.
    """

    return 0.0


if __name__ == '__main__':
    probe = atlas_oem.AtlasOEM()
    probe.setActiveHibernate(1)

    # Configure probe type
    probeType = inputFloat('Enter probe type value (K value): ')
    probe.setProbeType(probeType)

    # Configure the temperature compensation
    T = inputFloat("Enter the temperature of the room (in degrees C): ")
    temperatureCompensation = calculateTemperatureCompensation(T)
    probe.setTemperatureCompensation(temperatureCompensation)

    # Calibrate using a standard solution
    calibrationMode = inputCalibrationMode()
    doCalibration(calibrationMode)
