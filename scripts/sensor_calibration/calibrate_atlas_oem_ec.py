#!/usr/bin/env python3

import datetime
import time
import sys

try:
    from smbus import SMBus
except:
    from smbus2 import SMBus
class AtlasOEM:

    def __init__(self, bus=1, address=0x64) -> None:
        self._bus = SMBus(bus)
        self._address = address

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, exc_traceback):
        self._bus.close()


    # Unsigned Byte
    def readUnsignedByte(self, offset):
        try:
            return self._bus.read_byte_data(self._address, offset)
        except IOError:
            print("IOError, continuing anyway...")
            return 0

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
        try:
            b = bytes(self._bus.read_i2c_block_data(self._address, offset, 4))
            i = int.from_bytes(b, 'big', signed=True)
            return i / 100.0
        except IOError:
            print("IOError, continuing anyway...")
            return 0

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


    # Probe Type
    def probeType(self) -> float:
        return self.readUnsignedWordFloat(0x08)

    def setProbeType(self, probeType: float):
        self.writeUnsignedWordFloat(0x08, probeType)


    # Calibration
    def calibration(self) -> float:
        return self.readSignedLongFloat(0x0a)

    def setCalibration(self, calibration: float):
        self.writeSignedLongFloat(0x0a, calibration)


    # Calibration request
    def setCalibrationRequest(self, value: int):
        self.writeUnsignedByte(0x0e, value)

    def calibrationRequest(self):
        return self.readUnsignedByte(0x0e)


    # Calibration confirmation
    def calibrationConfirmation(self):
        return self.readUnsignedByte(0x0f)


    # Temperature Compensation
    def setTemperatureCompensation(self, value: float):
        self.writeUnsignedLongFloat(0x10, value)

    def temperatureCompensation(self):
        return self.readUnsignedLongFloat(0x10)


    # Temperature Confirmation
    def temperatureConfirmation(self):
        return self.readUnsignedLongFloat(0x14)


    # EC
    def EC(self):
        return self.readSignedLongFloat(0x18)


    # TDS
    def TDS(self):
        return self.readSignedLongFloat(0x1c)


    # Salinity
    def salinity(self):
        return self.readSignedLongFloat(0x20)


    def dump(self):
        print(f'Device Type:              {self.deviceType():02x}')
        print(f'Firmware Version:         {self.firmwareVersion():02x}')
        print(f'Interrupt Control:        {self.interruptControlRegister():02x}')
        print(f'LED Control:              {self.ledControl():02x}')
        print(f'Active / Hibernate:       {self.activeHibernate():02x}')
        print(f'New reading available:    {self.newReadingAvailable():02x}')
        print(f'Probe Type:               {self.probeType():0.2f}')
        print(f'Calibration:              {self.calibration():0.2f}')
        print(f'Calibration Confirmation: {self.calibrationConfirmation():02x}')
        print(f'Temperature Compensation: {self.temperatureCompensation():0.2f}')
        print(f'Temperature Confirmation: {self.temperatureConfirmation():0.2f}')

        print(f'EC (μS/cm)                {self.EC():0.2f}')
        print(f'TDS (ppm):                {self.TDS():0.2f}')
        print(f'Salinity (PSU (ppt)):     {self.salinity():0.2f}')

while True:
    try:
        probe = AtlasOEM()
        probe.setActiveHibernate(1)
        break
    except Exception as e:
        print("Atlas Scientific OEM-EC conductivity sensor not found. Trying again.")

def checkCalibrationStatus():
    status = bin(probe.calibrationConfirmation())[2:]

    if status == 1:
        print("calibrated to atmosphere")
    elif status == 2:
        print("calibrated to 0 Dissolved Oxygen")
    elif status == 3:
        print("calibrated to both atmospheric and 0 Dissolved Oxygen")
    else:
        print(f"no calibration")    


def verifyCalibration():
    # Get calibration status in binary string to easier identify bits
    status = format(probe.calibrationConfirmation(), '04b')

    print(f"Calibration status: {status}")
    
    high_cal = status[0]
    low_cal = status[1]
    single_cal = status[2]
    dry_cal = status[3]

    cal_string = ""

    if high_cal == "1":
        print("✅ High calibration successfully completed.")
        cal_string += "✅ High calibration successfully completed.\n"
    else:
        print("❌ High calibration not completed.")
        cal_string += "❌ High calibration not completed.\n"
    if low_cal == "1":
        print("✅ Low calibration successfully completed.") 
        cal_string += "✅ Low calibration successfully completed.\n"
    else:
        print("❌ Low calibration not completed.")
        cal_string += "❌ Low calibration not completed.\n"
    
    if dry_cal == "1":
        print("✅ Dry calibration successfully completed.")
        cal_string += "✅ Dry calibration successfully completed.\n"
    else:
        print("❌ Dry calibration not completed.")
        cal_string += "❌ Dry calibration not completed.\n"
        
    if status == '1101':
        print("✅ All calibrations successfully completed.")    
        cal_string += "✅ All calibrations successfully completed.\n"
    else:
        print("❌ Calibration status not as expected.")
        cal_string += "❌ Calibration status not as expected.\n"

    return cal_string

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

def pollEC():
    print('Polling conductivity probe...')
    ec_old = None
    timestr = time.strftime("%Y%m%d-T%H%M%S")
    with open(f"EC_SENSOR-{timestr}.csv", "w") as new_file:
        cal_string = verifyCalibration()
        new_file.write(cal_string)
        while True:
            try:
                ec = probe.EC()
                if ec_old:
                    delta_percent = abs(ec - ec_old) / ec_old * 100
                else:
                    delta_percent = 0.0
                print(f'time: {datetime.datetime.now()}  EC: {ec: 6.0f}  delta: {delta_percent: 3.2f}%')
                new_file.write(f'time: {datetime.datetime.now()}  EC: {ec: 6.0f}  delta: {delta_percent: 3.2f}%\n')
                ec_old = ec
                time.sleep(1)
            except IOError:
                print("IO Error. Continuing anyway...")
                new_file.write(f'time: {datetime.datetime.now()} IO Error. Continuing anyway...')
                continue
    
def setProbeType():
    value = input('Enter probe type value (K value) > ')

    try:
        probe.setProbeType(float(value))
    except ValueError:
        input('K value must be a number [press enter to continue]')

def setTemperatureCompensation():
    value = float(input("Enter temperature of solution: "))

    try:
        probe.setTemperatureCompensation(value)
    except Exception as e:
        print(f'Error: {e}')

def setJaiaTemperatureCompensation():
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
    probe.setCalibrationRequest(1)
    input('Calibration data cleared.  Press enter.')


def doCalibration(description: str, type: int):
    if description != 'DRY':
        value = input(f'{description} calibration value: ')
    else:
        value = 0

    while True:
        print('Getting 10 seconds of data...')
        ec_old = None
        for i in range(0, 10):
            if probe.newReadingAvailable() == 1:
                ec = probe.EC()
                if ec_old:
                    delta_percent = abs(ec - ec_old) / ec_old * 100
                else:
                    delta_percent = 0.0
                print(f'time:{datetime.datetime.now()}  EC: {ec: 6.0f}  delta: {delta_percent: 3.2f}%')
                ec_old = ec
            else:
                print("No new reading")
                continue
            time.sleep(1)

        if input('Calibrate now (Y/n)?').lower() in ['', 'y']:
            break

    try:
        probe.setCalibration(float(value))
        probe.setCalibrationRequest(type)
        input(f'{description} calibration completed.  Press enter.')
    except ValueError:
        input('Value must be a number.  Press enter.')

def getTemperatureCalibratedSalinity(measured_conductivity, temperature, pressure):
    """
    Calculate salinity given measured conductivity, temperature, and pressure.

    Params:
        measured_conductivity: {float} measured conductivity in μS/cm
        temperature: {float} temperature in deg C
        pressure: {float} pressure in bar

    Returns:
        {float} salinity in PSU (ppt)
    """
    try:
        # Salinity constants
        a0 = 0.0080
        a1 = -0.1692
        a2 = 25.3851
        a3 = 14.0941
        a4 = -7.0261
        a5 = 2.7081

        b0 = 0.0005
        b1 = -0.0056
        b2 = -0.0066
        b3 = -0.0375
        b4 = 0.0636
        b5 = -0.0144

        c0 = 0.6766097
        c1 = 2.00564e-2
        c2 = 1.104259e-4
        c3 = -6.9698e-7
        c4 = 1.0031e-9

        d0 = 3.426e-2
        d1 = 4.464e-4
        d2 = 4.215e-1
        d3 = -3.107e-3

        e0 = 2.070e-5
        e1 = -6.370e-10
        e2 = 3.989e-15

        k = 0.0162

        standard_conductivity = 42914
        
        # Salinity calculations
        R = round(measured_conductivity / standard_conductivity, 2)
        t = temperature
        p = pressure

        Rp = 1 + (p * (e0 + (e1 * p) + (e2 *p**2))) / (1 + (d0 * t) + (d1 * t**2) + (d2 + (d3 * t)) * R)
        rt = c0 + (c1 * t) + (c2 * t**2) + (c3 * t**3) + (c4 * t**4)
        Rt = R / (Rp * rt)
        dS = (t - 15) * (b0 + (b1 * Rt**0.5) + (b2 * Rt) + (b3 * Rt**1.5) + (b4 * Rt**2) + (b5 * Rt**2.5)) / (1 + k * (t - 15))

        S = a0 + (a1 * Rt**0.5) + (a2 * Rt) + (a3 * Rt**1.5) + (a4 * Rt**2) + (a5 * Rt**2.5) + dS
        
        print(f"S: {S}")
        return S
    
    except ZeroDivisionError:
        # Dry calibration
        return 0
    
def getTemperatureCalibratedConductivity(ec25, t):
    # Constant for conductivity compensation
    a = 0.0187

    # Electrical conductance of solution at temperature t
    ect = round(ec25 * (1 + a * (t - 25)), 2)
    print(f"ECT: {ect}")

    return ect

def doJaiaCalibration(description: str, type: int, value: int, temperature: float):
    repetitions = 0
    while True: 
        print(f"Running {description} calibration at {value} μS/cm.")
        ec_old = None
        delta_list = []
        for i in range(0,10):
            try:
                ec = probe.EC()
            except IOError:
                print("IOError, continuing anyway.")
                continue
            if ec_old:
                delta_percent = abs(ec - ec_old) / ec_old * 100
            else:
                delta_percent = 0.0
            delta_list.append(delta_percent)
            ec_old = ec
            salinity = getTemperatureCalibratedSalinity(ec, value, temperature, 0)
            print(f'Electrical Conductivity: {ec}, Salinity: {salinity}, Percent Change: {round(delta_percent, 2)}')

            #Wait 1 second between taking readings
            time.sleep(1)
        
        repetitions += 1

        if max(delta_list) < 0.15:
            break
    
    input(f"{description} calibration at {value} μS/cm complete. Press enter")
    probe.setCalibration(value)
    probe.setCalibrationRequest(type)

def jaiaCalibration():
    try:
        print(f"Starting calibration procedure...")
        time.sleep(1)
            
        # Start from a fresh calibration state
        clearCalibration()

        # Ensure temperature calibration is set to the default
        probe.setTemperatureCompensation(25)
        
        # Get temperature of solution from user
        temperature = setJaiaTemperatureCompensation()

        # Set the probe type to the Jaia default
        # This must be changed if the probe ever changes from K 1.0
        probe.setProbeType(1.0)

        # Dry calibration (0)
        print("\n==========\nTo begin calibrating, the probe must be completely dry.\n")
        time.sleep(1)
        input("Once you've ensured the probe is completely dry, press enter.\n")
        doJaiaCalibration('DRY', 2, 0, temperature)

        # Rough calibration
        print("==========\nBeginning the rough calibration portion.\n")
        time.sleep(1)

        # Dual Point Low calibration (12,880)
        print("\n==========\nWe will now begin the DUAL POINT LOW calibration. Submerge the probe in the 12,880 μS/cm solution and ensure the sampling window is fully submerged with no bubbles stuck inside. Allow the probe to sit in the solution for 5 minutes.")
        time.sleep(1)
        input("Once the probe has been fully submerged for 5 minutes, press enter.\n")
        doJaiaCalibration('DUAL POINT LOW', 4, getTemperatureCalibratedConductivity(12880, temperature), temperature)

        # Dual Point High calibration (80,000)
        print("\n==========\nWe will now begin the DUAL POINT HIGH calibration. Rinse and dry the probe, then put the probe in the 80,000 μS/cm solution. Ensure the sampling window is fully submerged with no bubbles stuck inside. Allow the probe to sit in the solution for 5 minutes.")
        time.sleep(1)
        input("Once the probe has been fully submerged for 5 minutes, press enter.\n")
        doJaiaCalibration('DUAL POINT HIGH', 5, getTemperatureCalibratedConductivity(80000, temperature), temperature)

        
        # Fine calibration 
        print("\n==========\nRough calibration procedure complete. Beginning the fine calibration procedure")

        # Dual Point Low calibration (12,880)
        print("\n==========\nWe will now begin the DUAL POINT LOW calibration. Submerge the probe in the 12,880 μS/cm solution and ensure the sampling window is fully submerged with no bubbles stuck inside. Allow the probe to sit in the solution for 5 minutes.")
        time.sleep(1)
        input("Once the probe has been fully submerged for 5 minutes, press enter.\n")
        doJaiaCalibration('DUAL POINT LOW', 4, getTemperatureCalibratedConductivity(12880, temperature), temperature)

        # Dual Point High calibration (80,000)
        print("\n==========\nWe will now begin the DUAL POINT HIGH calibration. Rinse and dry the probe, then put the probe in the 80,000 μS/cm solution. Ensure the sampling window is fully submerged with no bubbles stuck inside. Allow the probe to sit in the solution for 5 minutes.")
        time.sleep(1)
        input("Once the probe has been fully submerged for 5 minutes, press enter.\n")
        doJaiaCalibration('DUAL POINT HIGH', 5, getTemperatureCalibratedConductivity(80000, temperature), temperature)

        # Calibration complete
        input("Calibration procedure complete. Press enter to exit.")

        return 0
    
    except KeyboardInterrupt:
        return

def dryCalibration():
    doCalibration('DRY', 2)


def singlePointCalibration():
    doCalibration('SINGLE POINT', 3)


def lowCalibration():
    doCalibration('DUAL POINT LOW', 4)


def highCalibration():
    doCalibration('DUAL POINT HIGH', 5)


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
                'description': 'Jaia Calibration',
                'key': 'j',
                'func': jaiaCalibration
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
                'description': 'Dual Point Low Calibration',
                'key': 'l',
                'func': lowCalibration
            },
            {
                'description': 'Dual Point High Calibration',
                'key': 'h',
                'func': highCalibration
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
            'description': 'Continuously poll and log readings from EC',
            'key': 'l',
            'func': pollEC
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

if __name__ == "__main__":
    with AtlasOEM() as atlas:
        atlas.dump()
    
