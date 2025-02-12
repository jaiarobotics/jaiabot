#!/usr/bin/env python3

import datetime
import time

try:
    from smbus import SMBus
except:
    from smbus2 import SMBus
class AtlasOEM:

    def __init__(self, bus=0, address=0x67, devType=0x03) -> None:
        self._bus = SMBus(bus)
        self._address = address
        self._devType = devType

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
        return i

    def writeUnsignedWordFloat(self, offset, value: float):
        i = int(value)
        msb = (i >> 8) & 0xff
        lsb = i & 0xff
        self._bus.write_byte_data(self._address, offset, msb)
        self._bus.write_byte_data(self._address, offset + 1, lsb)

    # Signed Long Float
    def readSignedLongFloat(self, offset) -> float:
        b = bytes(self._bus.read_i2c_block_data(self._address, offset, 4))
        i = int.from_bytes(b, 'big', signed=True)
        return i

    def writeSignedLongFloat(self, offset, value: float):
        i = int(value)
        b = i.to_bytes(4, 'big', signed=True)
        l = [int(c) for c in b]
        self._bus.write_i2c_block_data(self._address, offset, l)

    # Unsigned Long Float
    def readUnsignedLongFloat(self, offset) -> float:
        b = bytes(self._bus.read_i2c_block_data(self._address, offset, 4))
        i = int.from_bytes(b, 'big', signed=False)
        return i

    def writeUnsignedLongFloat(self, offset, value: float):
        i = int(value)
        b = i.to_bytes(4, 'big', signed=False)
        l = [int(c) for c in b]
        self._bus.write_i2c_block_data(self._address, offset, l)


    def deviceType(self) -> int:
        return self.readUnsignedByte(0)

    def firmwareVersion(self) -> int:
        return self.readUnsignedByte(1)

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


    # Calibration
    def calibration(self) -> float:
        return self.readUnsignedByte(0x08)

    def setCalibration(self, calibration: float):
        self.writeUnsignedByte(0x08, calibration)


    # Calibration confirmation
    def calibrationConfirmation(self):
        return self.readUnsignedByte(0x09)


    # Salinity compensation
    def setSalinityCompensation(self, value: float):
        self.writeUnsignedLongFloat(0x0A, value * 100.0)

    def salinityCompensation(self):
        return self.readUnsignedLongFloat(0x0A) / 100.0
    
    def salinityConfirmation(self):
        return self.readUnsignedLongFloat(0x16) / 100.0


    # Pressure compensation
    def setPressureCompensation(self, value: float):
        self.writeUnsignedLongFloat(0x0E, value * 100.0)

    def pressureCompensation(self):
        return self.readUnsignedLongFloat(0x0E) / 100.0
    
    def pressureConfirmation(self):
        return self.readUnsignedLongFloat(0x1A) / 100.0


    # Temperature Compensation
    def setTemperatureCompensation(self, value: float):
        self.writeUnsignedLongFloat(0x12, value * 100.0)

    def temperatureCompensation(self):
        return self.readUnsignedLongFloat(0x12) / 100.0
    
    def temperatureConfirmation(self):
        return self.readUnsignedLongFloat(0x1E) / 100.0


    # DO Chip
        # DO in mg/L 
    def DO(self):
        return self.readUnsignedLongFloat(0x22) / 100.0

        # DO Saturation
    def DOSat(self):
        return self.readUnsignedLongFloat(0x26) / 100.0


    def dump(self):
        print(f'Device Type:              {self.deviceType():02x}')
        print(f'Firmware Version:         {self.firmwareVersion():02x}')
        print(f'Interrupt Control:        {self.interruptControlRegister():02x}')
        print(f'LED Control:              {self.ledControl():02x}')
        print(f'Active / Hibernate:       {self.activeHibernate():02x}')
        print(f'New reading available:    {self.newReadingAvailable():02x}')
        print(f'Calibration:              {self.calibration():0.2f}')
        print(f'Calibration Confirmation: {self.calibrationConfirmation():02x}\n')
        print(f'Temperature Compensation: {self.temperatureCompensation():0.2f}')
        print(f'Temperature Confirmation: {self.temperatureConfirmation():0.2f}\n`')
        print(f'Salinity Compensation:    {self.salinityCompensation():0.2f}')
        print(f'Salinity Confirmation:    {self.salinityConfirmation():0.2f}\n')
        print(f'Pressure Compensation:    {self.pressureCompensation():0.2f}')
        print(f'Pressure Confirmation:    {self.pressureConfirmation():0.2f}\n')

        print(f'DO                        {self.DO():0.2f}')
        

while True:
    try:
        probe = AtlasOEM(address=0x67, devType=0x03)
        probe.setActiveHibernate(1)
        break
    except Exception as e:
        print(f"Atlas Scientific OEM-DO sensor not found. Trying again. {e}")
        continue

if __name__ == '__main__':
    with AtlasOEM() as atlas:
        atlas.dump()


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
    DO_old = None
    timestr = time.strftime("%Y%m%d-T%H%M%S")
    with open(f"{timestr}.csv", "w") as new_file:
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
        input(f'{description} calibration completed.  Press enter.')
    except ValueError:
        input('Value must be a number.  Press enter.')


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
            'description': 'Exit Program',
            'key': 'e',
            'func': None
        }
    ]
})
