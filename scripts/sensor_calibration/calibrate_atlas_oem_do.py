#!/usr/bin/env python3

import datetime
import time
#import python_AtlasOEM_lib

# Import utility class
#from i2c_utils import I2CUtils  

try:
    from smbus import SMBus
except:
    from smbus2 import SMBus

class AtlasOEMDO:
    def __init__(self, bus=0, address=0x67, devType=0x03):
            self._bus = SMBus(bus)
            self._address = address
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, exc_traceback):
        self._bus.close()


    # Unsigned Byte
    def readUnsignedByte(self, offset):
        return self._bus.read_byte_data(self._address, offset)

    def writeUnsignedByte(self, offset, value: int):
        self._bus.write_byte_data(self._address, offset, value)

    # Unsigned Word
    def readUnsignedWordFloat(self, offset):
        i = self._bus.read_byte_data(self._address, offset) << 8
        i |= self._bus.read_byte_data(self._address, offset + 1)
        return i / 100.0

    def writeUnsignedWordFloat(self, offset, value: float):
        i = int(value * 100)
        msb = (i >> 8) & 0xff
        lsb = i & 0xff
        self._bus.write_byte_data(self._address, offset, msb)
        self._bus.write_byte_data(self._address, offset + 1, lsb)

    # Signed Long Float
    def readSignedLongFloat(self, offset) -> float:
        b = bytes(self._bus.read_i2c_block_data(self._address, offset, 4))
        i = int.from_bytes(b, 'big', signed=True)
        return i / 100.0

    def writeSignedLongFloat(self, offset, value: float):
        i = int(value * 100)
        b = i.to_bytes(4, 'big', signed=True)
        l = [int(c) for c in b]
        self._bus.write_i2c_block_data(self._address, offset, l)

    # Unsigned Long Float
    def readUnsignedLongFloat(self, offset) -> float:
        b = bytes(self._bus.read_i2c_block_data(self._address, offset, 4))
        i = int.from_bytes(b, 'big', signed=False)
        return i / 100.0

    def writeUnsignedLongFloat(self, offset, value: float):
        i = int(value * 100)
        b = i.to_bytes(4, 'big', signed=False)
        l = [int(c) for c in b]
        self._bus.write_i2c_block_data(self._address, offset, l)


    # High-level device-specific functions
    def deviceType(self) -> int:
        return self.readUnsignedByte(0x00)        

    def firmwareVersion(self) -> int:
        return self.readUnsignedByte(0x01)

    def interruptControlRegister(self) -> int:
        return self.readUnsignedByte(0x04)

    def ledControl(self) -> int:
        return self.readUnsignedByte(0x05)

    def activeHibernate(self) -> int:
        return self.readUnsignedByte(0x06)

    def setActiveHibernate(self, value: int):
        self.writeUnsignedByte(0x06, value)

    def newReadingAvailable(self) -> int:
        return self.readUnsignedByte(0x07)

    def setCalibration(self, calibration: int):
        self.writeUnsignedByte(0x08, calibration)

    # Calibration confirmation
    def calibrationConfirmation(self):
        return self.readUnsignedByte(0x09)

    # Salinity compensation
    def setSalinityCompensation(self, value: float):
        self.writeUnsignedLongFloat(0x0A, value)

    def salinityCompensation(self):
        return self.readUnsignedLongFloat(0x0A)

    def salinityConfirmation(self):
        return self.readUnsignedLongFloat(0x16)

    # Pressure compensation
    def setPressureCompensation(self, value: float):
        self.writeUnsignedLongFloat(0x0E, value)

    def pressureCompensation(self):
        return self.readUnsignedLongFloat(0x0E)

    def pressureConfirmation(self):
        return self.readUnsignedLongFloat(0x1A)

    # Temperature Compensation
    def setTemperatureCompensation(self, value: float):
        self.writeUnsignedLongFloat(0x12, value)

    def temperatureCompensation(self):
        return self.readUnsignedLongFloat(0x12)

    def temperatureConfirmation(self):
        return self.readUnsignedLongFloat(0x1E)

    # DO Chip
    # DO in mg/L
    def DO(self):
        return self.readUnsignedLongFloat(0x22)

    # DO Saturation
    def DOSat(self):
        return self.readUnsignedLongFloat(0x26)

    def dump(self):
        time.sleep(0.5)
        """Prints device status."""
        print(f'Device Type:              {self.deviceType():02x}')
        print(f'Firmware Version:         {self.firmwareVersion():02x}')
        print(f'Interrupt Control:        {self.interruptControlRegister():02x}')
        print(f'LED Control:              {self.ledControl():02x}')
        print(f'Active / Hibernate:       {self.activeHibernate():02x}')
        print(f'New reading available:    {self.newReadingAvailable():02x}')
        print(f'Calibration Confirmation: {self.calibrationConfirmation():02x}\n')
        print(f'Temperature Compensation: {self.temperatureCompensation():0.2f}')
        print(f'Temperature Confirmation: {self.temperatureConfirmation():0.2f}\n')
        print(f'Salinity Compensation:    {self.salinityCompensation():0.2f}')
        print(f'Salinity Confirmation:    {self.salinityConfirmation():0.2f}\n')
        print(f'Pressure Compensation:    {self.pressureCompensation():0.2f}')
        print(f'Pressure Confirmation:    {self.pressureConfirmation():0.2f}\n')
        print(f'DO                        {self.DO():0.2f}')

while True:
    try:
        probe = AtlasOEMDO(address=0x67, devType=0x03)
        probe.setActiveHibernate(1)
        break
    except Exception as e:
        print(f"Atlas Scientific OEM-DO sensor not found. Trying again. {e}")
        continue


def checkCalibrationStatus():
    """Reads and prints the calibration confirmation status."""
    status = probe.calibrationConfirmation()
    
    if status == 1:
        print("calibrated to atmosphere")
    elif status == 2:
        print("calibrated to 0 Dissolved Oxygen")
    elif status == 3:
        print("calibrated to both atmospheric and 0 Dissolved Oxygen")
    else:
        print(f"no calibration")

def verifyCalibration():
    """Checks the calibration status from register 0x09"""
    status = probe.calibrationConfirmation()

    if status == 1:
        print("✅ Calibrated to atmosphere.")
    elif status == 2:
        print("✅ Zero DO calibration successfully completed.")
    elif status == 3:
        print("✅ Atmospheric & Zero DO calibration successfully completed.")
    else:
        print(f"✅ Calibration has been cleared.")


if __name__ == '__main__':
    with AtlasOEMDO() as atlas:
        print("Starting Atlas Scientific OEM-DO sensor calibration script.")

def clearScreen():
    print('\033[2J\033[H')


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

def pollDO():
    print('Polling DO probe...')
    verifyCalibration()
    DO_old = None
    timestr = time.strftime("%Y%m%d-T%H%M%S")
    with open(f"DO_SENSOR-{timestr}.csv", "w") as new_file:
        while True:
            try: 
                if probe.newReadingAvailable():
                    DO = probe.DO()
                    DOSat = probe.DOSat()   
                else:
                    print("No new reading")
                    continue
                if DO_old:
                    delta_percent = abs(DO - DO_old) / DO_old * 100
                else:
                    delta_percent = 0.0
                print(f'time: {datetime.datetime.now()}  DO: {DO}  DOSat: {DOSat}  delta: {delta_percent}%')
                new_file.write(f'time: {datetime.datetime.now()}  DO: {DO: 6.0f}  DOSat: {DOSat: 6.0f}  delta: {delta_percent: 3.2f}%\n')
                DO_old = DO
                time.sleep(1)
            except IOError:
                print("IO Error: Continuing anyway...")
                continue
            except KeyboardInterrupt:
                print("User Interrupt")
                break
        

def setTemperatureCompensation():
    # Check that input is a number
    while True:
        try:
            value = float(input('Enter temperature of solution (deg C) > '))
        except ValueError:
            input('T value must be a number [press enter to continue]')
            continue
        else:
            print(f"Temperature compensation value set to {value}.")
            break

    probe.setTemperatureCompensation(value)

    return value


def setSalinityCompensation():
    while True:
        try:
            value = float(input('Enter salinity of solution (ppt) > '))
        except ValueError:
            input('S value must be a number [press enter to continue]')
            continue
        else:
            print(f"Salinity compensation value set to {value}.")
            break

    probe.setSalinityCompensation(value)

    return value


def setPressureCompensation():
    while True:
        try:
            value = float(input('Enter pressure of solution (bar) > '))
        except ValueError:
            input('P value must be a number [press enter to continue]')
            continue            
        else:
            print(f"Pressure compensation value set to {value}.")
            break

    probe.setPressureCompensation(value)

    return value


def printProbeStatus():
    try:
        clearScreen()
        print(datetime.datetime.now())
        probe.dump()
        input('Press enter to continue')
    except Exception as e:
        print(f'Error: {e}')


def clearCalibration():
    probe.setCalibration(1)
    input('Calibration data cleared.  Press enter.')


def doCalibration(description: str, type: int):
    DO_old = None
    while True:
        print('Getting 10 seconds of data...')
        for i in range(0, 10):
            if probe.newReadingAvailable() == 1:
                DO = probe.DO()
                DOSat = probe.DOSat()
                if DO_old:
                    delta_percent = abs(DO - DO_old) / DO_old * 100
                else:
                    delta_percent = 0.0
                print(f'time:{datetime.datetime.now()}  DO: {DO}  DOSat: {DOSat}  delta: {delta_percent: 3.2f}%')
                DO_old = DO
                time.sleep(1)
            else: 
                print("No new reading")
                continue
        if input('Calibrate now (Y/n)?').lower() in ['', 'y']:
            break

    try:
        probe.setCalibration(type)
        time.sleep(1)
        verifyCalibration()
        input(f'{description} calibration completed.  Press enter.')
    except ValueError:
        input('Value must be a number.  Press enter.')


def deactivate():
    probe.setActiveHibernate(0)


def atmosphereCalibration():
    doCalibration('Atmosphere', 2)


def zeroCalibration():
    doCalibration('Zero', 3)


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
            'description': 'Deactivate',
            'key': 'd',
            'func': deactivate
        },
        {
            'description': 'Exit Program',
            'key': 'e',
            'func': None
        }
    ]
})
