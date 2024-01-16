#!/usr/bin/env python3

class AtlasOEM:

    def __init__(self, bus=1, address=0x64) -> None:
        self._deviceType = 1
        self._firmwareVersion = 1
        self._interruptControlRegister = 1
        self._ledControl = 1
        self._activeHibernate = 1
        self._newReadingAvailable = 1
        self._probeType = 1
        self._calibrationRequest = 1
        self._calibrationRequest = 1
        self._calibrationTable = [None, None, None, None]
        self._calibration = 1
        self._temperatureCompensation = 1
        self._temperatureConfirmation = 1
        self._EC = 1
        self._TDS = 1
        self._salinity = 1

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, exc_traceback):
        pass


    def deviceType(self) -> int:
        return self._deviceType

    def firmwareVersion(self) -> int:
        return self._firmwareVersion

    def interruptControlRegister(self) -> int:
        return self._interruptControlRegister

    def ledControl(self) -> int:
        return self._ledControl

    def activeHibernate(self) -> int:
        return self._activeHibernate

    def setActiveHibernate(self, value: int):
        self._activeHibernate = value

    def newReadingAvailable(self) -> int:
        return self._newReadingAvailable


    # Probe Type
    def probeType(self) -> float:
        return self._probeType

    def setProbeType(self, probeType: float):
        self._probeType = probeType


    # Calibration
    def calibration(self) -> float:
        return self._calibration

    def setCalibration(self, calibration: float):
        self._calibration = calibration


    # Calibration request
    def setCalibrationRequest(self, value: int):
        if value == 1:
            self._calibrationTable = [None, None, None, None]
            return

        self._calibrationRequest = value
        self._calibrationTable[value - 2] = self._calibration

    def calibrationRequest(self):
        return 0


    # Calibration confirmation
    def calibrationConfirmation(self):
        t = self._calibrationTable

        if t[0] is None: # no dry calibration done yet
            return 0

        if t[2] is not None and t[3] is not None: # two-point calibration has values
            return 2
        if t[1] is not None: # one-point calibration has a value
            return 1
        
        return 0


    # Temperature Compensation
    def setTemperatureCompensation(self, value: float):
        self._temperatureCompensation = value

    def temperatureCompensation(self):
        return self._temperatureCompensation


    # Temperature Confirmation
    def temperatureConfirmation(self):
        return self._temperatureConfirmation


    # EC
    def EC(self):
        return self._EC


    # TDS
    def TDS(self):
        return self._TDS


    # Salinity
    def salinity(self):
        return self._salinity


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


if __name__ == '__main__':

    with AtlasOEM() as atlas:
        atlas.dump()
