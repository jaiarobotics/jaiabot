#!/usr/bin/env python3

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

        print(f'EC (μS/cm)                {self.EC():0.0f}')
        print(f'TDS (ppm):                {self.TDS():0.2f}')
        print(f'Salinity (PSU (ppt)):     {self.salinity():0.2f}')


if __name__ == '__main__':

    with AtlasOEM() as atlas:
        atlas.dump()
